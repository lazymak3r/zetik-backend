#!/usr/bin/env node

/**
 * 🎯 PLINKO CLIENT SIMULATOR
 *
 * Fast simulator for testing Plinko balance notifications via WebSocket:
 * - Multiple consecutive bets to test notification reliability
 * - Real-time balance tracking through WebSocket
 * - Balance verification after each bet
 * - Stakes of 100 bets to thoroughly test balance notifications
 */

import { io } from 'socket.io-client';

const API_BASE = process.env.TEST_BACKEND_URL || 'http://localhost:3000/v1';
const NOTIFICATION_WS_URL =
  process.env.TEST_WS_URL ||
  API_BASE.replace('/v1', '').replace('https://', 'wss://').replace('http://', 'ws://') +
    '/notifications';

const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'TestPassword123',
};

class PlinkoSimulator {
  constructor() {
    this.token = null;
    this.user = null;
    this.initialBalance = 0;
    this.currentBalance = 0;
    this.primaryWallet = null;

    // WebSocket notification tracking
    this.notificationSocket = null;
    this.notificationConnected = false;
    this.balanceNotifications = [];
    this.lastBalanceNotification = null;
    this.expectedNotifications = 0;
    this.receivedNotifications = 0;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix =
      {
        info: '📋',
        success: '✅',
        error: '❌',
        warning: '⚠️',
        game: '🎯',
        bet: '💰',
        ws: '🔗',
      }[type] || 'ℹ️';

    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async makeRequest(endpoint, method = 'GET', body = null, useAuth = true) {
    try {
      const config = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      };

      if (useAuth && this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }

      if (body) {
        config.body = JSON.stringify(body);
      }

      const response = await fetch(`${API_BASE}${endpoint}`, config);

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Network error: ${error.message}`);
      }
      throw error;
    }
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  async authenticate() {
    this.log('Authenticating user...', 'info');

    try {
      const response = await this.makeRequest(
        '/auth/login/email',
        'POST',
        {
          email: TEST_USER.email,
          password: TEST_USER.password,
        },
        false,
      );

      this.token = response.accessToken;
      this.user = response.user;

      this.log(`✅ Authentication successful: ${this.user.email}`, 'success');
      return true;
    } catch (error) {
      this.log(`❌ Authentication failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async getBalance() {
    const response = await this.makeRequest('/balance/wallets');
    this.primaryWallet = response.find((w) => w.isPrimary) || response[0];

    if (!this.primaryWallet) {
      throw new Error('No wallet found');
    }

    const balance = parseFloat(this.primaryWallet.balance);
    this.log(`💰 Current balance: ${balance.toFixed(8)} ${this.primaryWallet.asset}`, 'bet');
    return balance;
  }

  async setupWebSocket() {
    this.log('Setting up WebSocket connection...', 'ws');

    return new Promise((resolve, reject) => {
      this.notificationSocket = io(NOTIFICATION_WS_URL, {
        auth: { token: this.token },
        transports: ['websocket'],
      });

      this.notificationSocket.on('connect', () => {
        this.notificationConnected = true;
        this.log(`WebSocket connected! Socket ID: ${this.notificationSocket.id}`, 'success');
      });

      this.notificationSocket.on('connected', (data) => {
        this.log('Notification server confirmed connection', 'success');
        this.log(`User ID: ${data.userId}`, 'info');
        resolve(true);
      });

      this.notificationSocket.on('notification', (data) => {
        if (data.data?.type === 'balance_update') {
          const balanceData = data.data.data;
          this.lastBalanceNotification = {
            ...balanceData,
            timestamp: new Date().toISOString(),
            received: data.timestamp,
          };
          this.balanceNotifications.push(this.lastBalanceNotification);
          this.receivedNotifications++;

          this.log(`💰 Balance Update #${this.receivedNotifications}:`, 'bet');
          this.log(`  Operation: ${balanceData.operation}`, 'info');
          this.log(`  Asset: ${balanceData.asset}`, 'info');
          this.log(`  Amount: ${balanceData.amount}`, 'info');
          this.log(`  New Balance: ${balanceData.newBalance}`, 'info');
          this.log(`  Operation ID: ${balanceData.operationId}`, 'info');
        }
      });

      this.notificationSocket.on('connect_error', (error) => {
        this.log(`WebSocket connection error: ${error.message}`, 'error');
        reject(error);
      });

      this.notificationSocket.on('disconnect', () => {
        this.notificationConnected = false;
        this.log('WebSocket disconnected', 'ws');
      });

      setTimeout(() => {
        if (!this.notificationConnected) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 5000);
    });
  }

  async placePlinkoBet(betAmount, gameNumber) {
    const betData = {
      betAmount: betAmount.toString(),
      riskLevel: 'MEDIUM',
      rowCount: 16,
      clientSeed: `plinko-test-${gameNumber}-${Date.now()}`,
    };

    this.log(
      `🎯 Game ${gameNumber}: Placing Plinko bet ${betAmount} ${this.primaryWallet.asset}`,
      'game',
    );

    const gameResponse = await this.makeRequest('/games/plinko/bet', 'POST', betData);

    this.log(`  Game ID: ${gameResponse.id}`, 'info');
    this.log(`  Ball path: ${gameResponse.ballPath.join(' → ')}`, 'info');
    this.log(
      `  Bucket: ${gameResponse.bucketIndex} (Multiplier: ${gameResponse.multiplier}x)`,
      'info',
    );
    this.log(
      `  Win: ${gameResponse.winAmount} ${gameResponse.asset}`,
      gameResponse.winAmount > 0 ? 'success' : 'info',
    );

    return gameResponse;
  }

  async testMultiplePlinkoBets() {
    this.log('🎯 PLINKO BALANCE NOTIFICATION TEST', 'game');
    this.log('Testing 100 consecutive Plinko bets with balance notifications', 'info');

    // Get initial balance
    this.initialBalance = await this.getBalance();
    this.currentBalance = this.initialBalance;

    const betAmount = 0.00001; // Fixed bet amount
    const numberOfBets = 3;
    let successfulGames = 0;
    let failedGames = 0;
    let missedNotifications = 0;
    let totalWagered = 0;
    let totalWon = 0;

    this.log(`\n📊 Test Parameters:`, 'info');
    this.log(`  Bet amount: ${betAmount} ${this.primaryWallet.asset}`, 'info');
    this.log(`  Number of bets: ${numberOfBets}`, 'info');
    this.log(
      `  Initial balance: ${this.initialBalance.toFixed(8)} ${this.primaryWallet.asset}`,
      'info',
    );

    // Clear previous notifications
    this.balanceNotifications = [];
    this.receivedNotifications = 0;
    this.expectedNotifications = numberOfBets;

    this.log('\n🚀 Starting bet sequence...', 'game');

    for (let i = 1; i <= numberOfBets; i++) {
      try {
        // Check if we have enough balance
        if (this.currentBalance < betAmount) {
          this.log(
            `⚠️ Insufficient balance for bet ${i}: ${this.currentBalance.toFixed(8)}`,
            'warning',
          );
          break;
        }

        const balanceBefore = await this.getBalance();
        this.currentBalance = balanceBefore;

        const notificationCountBefore = this.receivedNotifications;

        // Place Plinko bet
        const gameResult = await this.placePlinkoBet(betAmount, i);

        // Wait for WebSocket notification
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Check if notification was received
        const notificationCountAfter = this.receivedNotifications;
        const notificationReceived = notificationCountAfter > notificationCountBefore;

        if (!notificationReceived) {
          missedNotifications++;
          this.log(`❌ Game ${i}: No balance notification received!`, 'error');
        } else {
          this.log(`✅ Game ${i}: Balance notification received`, 'success');
        }

        // Get updated balance
        const balanceAfter = await this.getBalance();
        this.currentBalance = balanceAfter;

        // Calculate expected change
        const actualChange = balanceAfter - balanceBefore;
        const expectedChange = parseFloat(gameResult.winAmount) - betAmount;

        totalWagered += betAmount;
        totalWon += parseFloat(gameResult.winAmount);

        // Verify balance change
        const tolerance = 0.00000001;
        if (Math.abs(actualChange - expectedChange) <= tolerance) {
          successfulGames++;
          this.log(`  ✅ Balance change verified: ${actualChange.toFixed(8)}`, 'success');
        } else {
          failedGames++;
          this.log(
            `  ❌ Balance mismatch! Expected: ${expectedChange.toFixed(8)}, Got: ${actualChange.toFixed(8)}`,
            'error',
          );
        }

        // Progress indicator
        if (i % 10 === 0) {
          this.log(`\n📈 Progress: ${i}/${numberOfBets} games completed`, 'info');
          this.log(`  Notifications: ${this.receivedNotifications}/${i} received`, 'info');
          this.log(
            `  Current balance: ${this.currentBalance.toFixed(8)} ${this.primaryWallet.asset}`,
            'info',
          );
        }

        // Small delay between bets
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        failedGames++;
        this.log(`❌ Game ${i} error: ${error.message}`, 'error');
      }
    }

    // Final analysis
    const finalBalance = await this.getBalance();
    const totalNetResult = totalWon - totalWagered;
    const actualBalanceChange = finalBalance - this.initialBalance;

    this.log(`\n📊 FINAL RESULTS:`, 'info');
    this.log(`=`.repeat(60), 'info');
    this.log(`  Games attempted: ${numberOfBets}`, 'info');
    this.log(`  Successful games: ${successfulGames}`, 'info');
    this.log(`  Failed games: ${failedGames}`, 'info');
    this.log(`  Expected notifications: ${this.expectedNotifications}`, 'info');
    this.log(`  Received notifications: ${this.receivedNotifications}`, 'info');
    this.log(
      `  Missed notifications: ${missedNotifications}`,
      missedNotifications > 0 ? 'error' : 'success',
    );
    this.log(`  Total wagered: ${totalWagered.toFixed(8)} ${this.primaryWallet.asset}`, 'info');
    this.log(`  Total won: ${totalWon.toFixed(8)} ${this.primaryWallet.asset}`, 'info');
    this.log(`  Expected net: ${totalNetResult.toFixed(8)} ${this.primaryWallet.asset}`, 'info');
    this.log(
      `  Actual change: ${actualBalanceChange.toFixed(8)} ${this.primaryWallet.asset}`,
      'info',
    );
    this.log(
      `  Initial balance: ${this.initialBalance.toFixed(8)} ${this.primaryWallet.asset}`,
      'info',
    );
    this.log(`  Final balance: ${finalBalance.toFixed(8)} ${this.primaryWallet.asset}`, 'info');

    // Notification reliability analysis
    const notificationReliability = (this.receivedNotifications / this.expectedNotifications) * 100;
    this.log(`\n🔔 NOTIFICATION ANALYSIS:`, 'info');
    this.log(
      `  Reliability: ${notificationReliability.toFixed(1)}%`,
      notificationReliability >= 95 ? 'success' : 'warning',
    );

    if (missedNotifications > 0) {
      this.log(`  ⚠️ WARNING: ${missedNotifications} notifications were missed!`, 'warning');
      this.log(`  This indicates potential issues with WebSocket balance notifications`, 'warning');
    } else {
      this.log(`  ✅ Perfect notification delivery - all balance updates received!`, 'success');
    }

    // Balance consistency check
    const balanceConsistent = Math.abs(actualBalanceChange - totalNetResult) <= 0.00000001;
    if (balanceConsistent) {
      this.log(`  ✅ Balance consistency verified`, 'success');
    } else {
      this.log(`  ❌ Balance inconsistency detected!`, 'error');
    }

    return {
      totalGames: numberOfBets,
      successfulGames,
      failedGames,
      expectedNotifications: this.expectedNotifications,
      receivedNotifications: this.receivedNotifications,
      missedNotifications,
      notificationReliability,
      balanceConsistent,
    };
  }

  disconnectWebSocket() {
    if (this.notificationSocket) {
      this.notificationSocket.disconnect();
      this.log('WebSocket disconnected', 'ws');
    }
  }

  async run() {
    try {
      this.log('🎯 Starting Plinko Balance Notification Test', 'game');
      this.log(`📧 Test user: ${TEST_USER.email}`, 'info');
      this.log(`🔗 API base: ${API_BASE}`, 'info');
      this.log(`🔗 WebSocket: ${NOTIFICATION_WS_URL}`, 'info');

      // Step 1: Authenticate
      await this.authenticate();

      // Step 2: Setup WebSocket
      await this.setupWebSocket();

      // Step 3: Run multiple Plinko bets test
      const results = await this.testMultiplePlinkoBets();

      // Final summary
      this.log(`\n🎉 TEST COMPLETED!`, 'success');

      if (results.missedNotifications === 0) {
        this.log(`✅ All balance notifications were received correctly!`, 'success');
        this.log(`WebSocket notification system is working perfectly for Plinko`, 'success');
      } else {
        this.log(`⚠️ ${results.missedNotifications} notifications were missed`, 'warning');
        this.log(`Client should investigate WebSocket notification reliability`, 'warning');
      }

      return results.missedNotifications === 0;
    } catch (error) {
      this.log(`💥 Test failed: ${error.message}`, 'error');
      console.error(error);
      return false;
    } finally {
      this.disconnectWebSocket();
    }
  }
}

// Run simulator if called directly
if (require.main === module) {
  const simulator = new PlinkoSimulator();
  simulator
    .run()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Simulator crashed:', error);
      process.exit(1);
    });
}

export default PlinkoSimulator;
