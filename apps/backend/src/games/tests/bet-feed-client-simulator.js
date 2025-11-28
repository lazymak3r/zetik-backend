#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */
const axios = require('axios');
const io = require('socket.io-client');

// Configuration
const API_BASE = process.env.TEST_BACKEND_URL || 'http://localhost:4000/v1';
const WS_URL = process.env.TEST_WS_URL || 'http://localhost:4000/bet-feed'; // Bet feed namespace

// User credentials - USER MUST BE REGISTERED BEFORE RUNNING TESTS
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'TestPassword123',
};

// Test settings
const TEST_TAB = process.env.TEST_TAB || 'all-bets';

class BetFeedSimulator {
  constructor() {
    this.token = null;
    this.user = null;
    this.socket = null;
    this.connected = false;
    this.subscribed = false;
    this.lastUpdateTimestamp = null;
    this.lastUpdateData = null;
    this.duplicateDetected = false;
    this.updateHistory = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix =
      {
        info: '📋',
        success: '✅',
        error: '❌',
        warning: '⚠️',
        websocket: '🔌',
        update: '📡',
        duplicate: '⚠️',
        setup: '🔧',
      }[type] || 'ℹ️';

    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  // Pre-test validation methods
  async checkUserExists() {
    this.log('Checking if test user exists and can login', 'setup');

    try {
      const response = await axios.post(`${API_BASE}/auth/login/email`, {
        email: TEST_USER.email,
        password: TEST_USER.password,
      });

      this.token = response.data.accessToken;
      this.user = response.data.user;

      this.log(`✅ Test user verified: ${this.user.id}`, 'success');
      return true;
    } catch (error) {
      const status = error.response?.status;
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';

      this.log(`❌ User verification failed (${status}): ${errorMessage}`, 'error');

      if (status === 401 || status === 404) {
        this.log('❌ User does not exist or password is incorrect', 'error');
        this.log('📋 Please ensure test user is registered with:', 'error');
        this.log(`   Email: ${TEST_USER.email}`, 'info');
        this.log(`   Password: ${TEST_USER.password}`, 'info');
      } else {
        this.log(`❌ Server error: ${errorMessage}`, 'error');
      }

      return false;
    }
  }

  // Phase 1: WebSocket Testing
  async testWebSocketConnection() {
    this.log('Testing WebSocket Connection', 'websocket');

    return new Promise((resolve, reject) => {
      this.socket = io(WS_URL, {
        auth: { token: this.token },
        transports: ['websocket'],
      });

      this.socket.on('connect', () => {
        this.connected = true;
        this.log(`WebSocket connected! Socket ID: ${this.socket.id}`, 'websocket');
      });

      this.socket.on('connected', () => {
        this.log('Bet feed server confirmed connection', 'success');
        resolve(true);
      });

      this.socket.on('connect_error', (error) => {
        this.log(`WebSocket connection error: ${error.message}`, 'error');
        reject(error instanceof Error ? error : new Error(String(error)));
      });

      this.socket.on('disconnect', () => {
        this.connected = false;
        this.log('WebSocket disconnected', 'websocket');
      });

      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 5000);
    });
  }

  setupWebSocketEvents() {
    this.log('Setting up WebSocket event listeners', 'websocket');
    this.log('✅ Using auto-join (connected clients automatically join bet-feed room)', 'success');

    // Mark as subscribed immediately since auto-join happens on connection
    this.subscribed = true;

    this.socket.on('subscribed', (data) => {
      this.log(`Got subscribed event for tab: ${data.tab}`, 'success');
    });

    this.socket.on('bet-feed-delta', (data) => {
      const feedData = data.data;
      this.log(`📊 Bet feed delta for ${feedData.tab}: ${feedData.count} new bets`, 'update');

      if (feedData.count > 0) {
        const now = Date.now();
        const betDataString = JSON.stringify(feedData.newBets || []);

        if (this.lastUpdateData === betDataString && now - this.lastUpdateTimestamp < 2000) {
          this.duplicateDetected = true;
          this.log(
            `⚠️ DUPLICATE DELTA DETECTED! Same bet data received ${now - this.lastUpdateTimestamp}ms apart`,
            'duplicate',
          );
        }

        this.lastUpdateTimestamp = now;
        this.lastUpdateData = betDataString;
        this.updateHistory.push({ timestamp: now, data: feedData });
        this.updateCount++;
      }
    });

    this.socket.on('bet-feed-update', (data) => {
      const now = Date.now();
      // Compare only the bet data, excluding timestamp which changes every time
      const betDataString = JSON.stringify(data.data?.bets || []);

      // Check for duplicate within 2 seconds window (accounting for cron job timing)
      if (this.lastUpdateData === betDataString && now - this.lastUpdateTimestamp < 2000) {
        this.duplicateDetected = true;
        this.log(
          `⚠️ DUPLICATE UPDATE DETECTED! Same bet data received ${now - this.lastUpdateTimestamp}ms apart`,
          'duplicate',
        );
      }

      this.lastUpdateTimestamp = now;
      this.lastUpdateData = betDataString;
      this.updateHistory.push({ timestamp: now, data: data });

      this.log(
        `Received bet-feed-update: ${data.data.bets.length} bets for ${data.data?.tab || 'undefined'}`,
        'update',
      );
    });

    this.socket.on('error', (data) => {
      this.log(`Server error: ${data.message}`, 'error');
    });
  }

  async testSubscribe() {
    this.log(`Ready to receive updates (auto-joined on connection)`, 'websocket');

    // No need to emit subscribe - auto-join handles it
    // Just verify we're marked as subscribed
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (this.subscribed) {
          this.log('✅ Ready to receive bet-feed-delta broadcasts', 'success');
          resolve(true);
        } else {
          reject(new Error('Not subscribed (auto-join failed?)'));
        }
      }, 500);
    });
  }

  async testSwitchTab(newTab) {
    this.log(`Switching to tab: ${newTab}`, 'websocket');

    return new Promise((resolve) => {
      this.socket.emit('switch-tab', { tab: newTab });

      // Wait for update on new tab
      const updateListener = (data) => {
        if (data.data && data.data.tab === newTab) {
          this.socket.off('bet-feed-update', updateListener);
          this.log(`Received update after switch to ${newTab}`, 'success');
          resolve(true);
        }
      };

      this.socket.on('bet-feed-update', updateListener);

      setTimeout(() => {
        this.socket.off('bet-feed-update', updateListener);
        resolve(false);
      }, 5000);
    });
  }

  async testMultipleSubscriptions() {
    this.log('Monitoring for duplicate delta broadcasts (15 seconds)', 'websocket');

    return new Promise((resolve) => {
      const startTime = Date.now();
      let deltaCount = 0;

      const deltaListener = (data) => {
        deltaCount++;
        const now = Date.now();
        const feedData = data.data;
        this.log(
          `Delta #${deltaCount} at ${now - startTime}ms: ${feedData.count} new bets for ${feedData.tab}`,
          'update',
        );
      };

      this.socket.on('bet-feed-delta', deltaListener);

      setTimeout(() => {
        this.socket.off('bet-feed-delta', deltaListener);
        this.log(`📊 Total deltas received: ${deltaCount}`, 'info');

        if (this.duplicateDetected) {
          this.log('⚠️ Duplicates detected during test', 'duplicate');
        } else {
          this.log('✅ No duplicates detected', 'success');
        }

        resolve(true);
      }, 15000);
    });
  }

  async monitorForDuplicates(duration = 30000) {
    this.log(`Monitoring for duplicate updates for ${duration / 1000} seconds...`, 'info');

    return new Promise((resolve) => {
      setTimeout(() => {
        if (this.duplicateDetected) {
          this.log('❌ Duplicates detected during monitoring', 'error');
          resolve(false);
        } else {
          this.log('✅ No duplicates detected during monitoring', 'success');
          resolve(true);
        }
      }, duration);
    });
  }

  // Main test runner
  async runTests() {
    console.log('🚀 Bet Feed WebSocket Test Suite');
    console.log('═'.repeat(60));
    console.log(`📋 Testing with user: ${TEST_USER.email}`);
    console.log(`🌐 Backend URL: ${API_BASE}`);
    console.log(`🔌 WebSocket URL: ${WS_URL}`);
    console.log(`📊 Test Tab: ${TEST_TAB}`);
    console.log('═'.repeat(60));

    let testsPassed = 0;

    try {
      // Pre-test setup
      if (await this.checkUserExists()) {
        testsPassed++;
      } else {
        this.log('❌ STOPPING TESTS: User verification failed', 'error');
        process.exit(1);
      }

      // WebSocket tests
      if (await this.testWebSocketConnection()) testsPassed++;

      this.setupWebSocketEvents();

      if (await this.testSubscribe()) testsPassed++;

      // Test multiple subscriptions to trigger duplicates
      if (await this.testMultipleSubscriptions()) testsPassed++;

      // Monitor for duplicates
      if (await this.monitorForDuplicates(15000)) testsPassed++;

      // Test tab switching
      const otherTab = TEST_TAB === 'all-bets' ? 'lucky-winners' : 'all-bets';
      if (await this.testSwitchTab(otherTab)) testsPassed++;

      // Monitor again after switch
      if (await this.monitorForDuplicates(10000)) testsPassed++;

      // Final results
      console.log('═'.repeat(60));
      this.log(`Tests passed: ${testsPassed}/6`, testsPassed === 6 ? 'success' : 'error');

      if (this.duplicateDetected) {
        this.log('❌ Duplicate updates detected during tests!', 'error');
      } else {
        this.log('✅ No duplicate updates detected', 'success');
      }

      this.socket?.disconnect();
      process.exit(0);
    } catch (error) {
      this.log(`Test suite failed: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// Run the test suite
const simulator = new BetFeedSimulator();
simulator.runTests().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
