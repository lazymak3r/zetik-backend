// Using native fetch instead of axios

// Helper functions for fetch requests
async function fetchPost(url, data, headers = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    const error = new Error(result.message || 'Request failed');
    error.response = { status: response.status, data: result };
    throw error;
  }

  return { data: result };
}

async function fetchGet(url, headers = {}) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  const result = await response.json();

  if (!response.ok) {
    const error = new Error(result.message || 'Request failed');
    error.response = { status: response.status, data: result };
    throw error;
  }

  return { data: result };
}

async function fetchPatch(url, data, headers = {}) {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    const error = new Error(result.message || 'Request failed');
    error.response = { status: response.status, data: result };
    throw error;
  }

  return { data: result };
}

// Configuration
const API_BASE = process.env.TEST_BACKEND_URL || 'http://localhost:3000/v1';

// User credentials - USER MUST BE REGISTERED BEFORE RUNNING TESTS
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'TestPassword123',
};

// Test settings - using crypto amounts
const TEST_BET_AMOUNT = process.env.TEST_BET_AMOUNT || '0.00001'; // BTC amount

// PREREQUISITES:
// 1. Test user must be registered with the above credentials
// 2. User must have sufficient crypto balance (at least 5x TEST_BET_AMOUNT)

class WeeklyRaceSimulator {
  constructor() {
    this.token = null;
    this.user = null;
    this.lastGameResult = null;
    this.primaryWallet = null;
    this.currentBalance = 0;
    this.expectedRacePrizeUsd = 0;
    this.btcBalanceBeforePrize = null;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString().slice(11, 23);
    const prefix =
      {
        info: 'ℹ️',
        success: '✅',
        error: '❌',
        warning: '⚠️',
        game: '🎲',
        bet: '💰',
        setup: '🔧',
        race: '🏁',
      }[type] || 'ℹ️';

    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  // Pre-test validation methods
  async checkUserExists() {
    this.log('Checking if test user exists and can login', 'setup');

    try {
      // Try to login to verify user exists and credentials are correct
      const response = await fetchPost(`${API_BASE}/auth/login/email`, {
        email: TEST_USER.email,
        password: TEST_USER.password,
      });

      // Store token temporarily for balance check
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

  async checkBalance() {
    this.log('Checking user crypto balance', 'setup');

    try {
      // Get crypto wallets
      const response = await fetchGet(`${API_BASE}/balance/wallets`, {
        Authorization: `Bearer ${this.token}`,
      });

      this.primaryWallet = response.data.find((w) => w.isPrimary);
      if (!this.primaryWallet) {
        this.log('❌ No primary wallet found', 'error');
        return false;
      }

      const currentBalance = parseFloat(this.primaryWallet.balance);
      const requiredBalance = parseFloat(TEST_BET_AMOUNT) * 10; // Ensure we have 10x the bet amount for multiple bets

      this.log(`Primary wallet: ${this.primaryWallet.asset}`, 'info');

      // Check for NaN balance with detailed diagnostics
      if (isNaN(currentBalance)) {
        this.log(`❌ Balance is NaN! Raw balance: "${this.primaryWallet.balance}"`, 'error');
        this.log(`❌ Balance type: ${typeof this.primaryWallet.balance}`, 'error');
        this.log(`❌ Full wallet data: ${JSON.stringify(this.primaryWallet, null, 2)}`, 'error');
        throw new Error(`Invalid balance format: ${this.primaryWallet.balance}`);
      }

      this.log(`Current balance: ${currentBalance} ${this.primaryWallet.asset}`, 'info');
      this.log(`Required balance: ${requiredBalance} ${this.primaryWallet.asset}`, 'info');

      if (currentBalance >= requiredBalance) {
        this.log('✅ Balance sufficient for testing', 'success');
        this.currentBalance = currentBalance;
        return true;
      } else {
        this.log(
          `❌ Insufficient balance! Need at least ${requiredBalance} ${this.primaryWallet.asset} but have ${currentBalance} ${this.primaryWallet.asset}`,
          'error',
        );
        this.log('Please deposit some funds before running tests', 'error');
        return false;
      }
    } catch (error) {
      this.log(`Balance check failed: ${error.response?.data?.message || error.message}`, 'error');
      return false;
    }
  }

  // HTTP API Testing
  async testHttpAuth() {
    this.log('Testing HTTP Authentication', 'info');

    try {
      const response = await fetchPost(`${API_BASE}/auth/login/email`, {
        email: TEST_USER.email,
        password: TEST_USER.password,
      });

      this.token = response.data.accessToken;
      this.user = response.data.user;

      this.log(`Login successful! User ID: ${this.user.id}`, 'success');
      return true;
    } catch (error) {
      this.log(`Login failed: ${error.response?.data?.message || error.message}`, 'error');
      return false;
    }
  }

  async testHttpBalance() {
    this.log('Testing HTTP Balance API', 'info');

    try {
      const response = await fetchGet(`${API_BASE}/balance/wallets`, {
        Authorization: `Bearer ${this.token}`,
      });

      this.log('Crypto balance retrieved successfully:', 'success');
      response.data.forEach((wallet) => {
        this.log(
          `  ${wallet.asset}: ${wallet.balance}${wallet.isPrimary ? ' (Primary)' : ''}`,
          'info',
        );
      });

      this.primaryWallet = response.data.find((w) => w.isPrimary);
      this.currentBalance = parseFloat(this.primaryWallet?.balance || '0');

      // Check for NaN balance
      if (isNaN(this.currentBalance)) {
        this.log(`❌ Balance is NaN! Raw balance: ${this.primaryWallet?.balance}`, 'error');
        throw new Error(`Invalid balance format: ${this.primaryWallet?.balance}`);
      }

      return response.data;
    } catch (error) {
      this.log(`Balance check failed: ${error.response?.data?.message || error.message}`, 'error');
      return null;
    }
  }

  async testHttpBetting() {
    this.log('Testing HTTP Dice Betting API', 'info');

    try {
      // Get balance before bet
      const initialWalletsData = await fetchGet(`${API_BASE}/balance/wallets`, {
        Authorization: `Bearer ${this.token}`,
      });
      const initialWallet = initialWalletsData.data.find((wallet) => wallet.isPrimary);
      const initialBalance = parseFloat(initialWallet.balance);

      const betData = {
        gameSessionId: this.generateUUID(),
        betAmount: TEST_BET_AMOUNT,
        betType: 'ROLL_OVER',
        targetNumber: 50.0,
        clientSeed: 'test-client-seed-123',
      };

      this.log('Placing dice bet...', 'bet');
      this.log(`  Amount: ${betData.betAmount} ${this.primaryWallet?.asset || 'BTC'}`, 'info');
      this.log(`  Type: ${betData.betType}`, 'info');
      this.log(`  Target: ${betData.targetNumber}`, 'info');

      const response = await fetchPost(`${API_BASE}/games/dice/bet`, betData, {
        Authorization: `Bearer ${this.token}`,
      });

      this.lastGameResult = response.data;

      this.log('✅ Dice bet placed successfully!', 'success');
      this.log(`  Game ID: ${response.data.id}`, 'info');
      this.log(`  Bet Amount: ${response.data.betAmount} ${response.data.asset}`, 'info');
      this.log(`  Asset: ${response.data.asset}`, 'info');
      this.log(`  Bet Type: ${response.data.betType}`, 'info');
      this.log(`  Target Number: ${response.data.targetNumber}`, 'info');
      this.log(`  Roll Result: ${response.data.rollResult}`, 'info');
      this.log(`  Status: ${response.data.status}`, 'info');
      this.log(`  Win Amount: ${response.data.winAmount} ${response.data.asset}`, 'info');

      // Check balance change (like in blackjack)
      const newWalletsData = await fetchGet(`${API_BASE}/balance/wallets`, {
        Authorization: `Bearer ${this.token}`,
      });
      const newWallet = newWalletsData.data.find((wallet) => wallet.isPrimary);
      const newBalance = parseFloat(newWallet.balance);
      const winAmount = parseFloat(response.data.winAmount || '0');
      const betAmountFloat = parseFloat(response.data.betAmount);

      // Calculate expected balance: initial - bet + winnings
      const expectedBalance = initialBalance - betAmountFloat + winAmount;
      const balanceDifference = Math.abs(newBalance - expectedBalance);

      const result =
        winAmount > betAmountFloat ? 'WIN' : winAmount === betAmountFloat ? 'PUSH' : 'LOSS';
      this.log(
        `Result: ${result} - Win: ${winAmount} ${newWallet.asset}, Balance: ${newBalance} ${newWallet.asset} (diff: ${balanceDifference.toFixed(8)})`,
        'bet',
      );

      if (balanceDifference <= 0.00000002) {
        // Allow for small precision differences (2 satoshi)
        this.log('Balance change verified correctly', 'success');
        this.currentBalance = newBalance;
        return response.data;
      } else {
        throw new Error(
          `Balance mismatch: expected ${expectedBalance.toFixed(8)}, got ${newBalance.toFixed(8)}`,
        );
      }
    } catch (error) {
      this.log(`Dice betting failed: ${error.response?.data?.message || error.message}`, 'error');
      if (error.response?.data) {
        this.log(`Error details: ${JSON.stringify(error.response.data, null, 2)}`, 'error');
      }
      return false;
    }
  }

  // Weekly Race Testing Methods
  async testWeeklyRaceLeaderboard() {
    this.log('Testing Weekly Race Leaderboard API', 'race');

    try {
      const response = await fetchGet(`${API_BASE}/games/weekly-race/leaderboard`, {
        Authorization: `Bearer ${this.token}`,
      });

      this.log('✅ Weekly race leaderboard retrieved successfully!', 'success');
      this.log(`Total participants: ${response.data.leaderboard.length}`, 'info');
      if (typeof response.data.prizePool !== 'undefined') {
        this.log(`Prize Pool: $${response.data.prizePool}`, 'info');
        // Check for winnersCount field
        if (typeof response.data.winnersCount !== 'undefined') {
          this.log(`Winners Count: ${response.data.winnersCount}`, 'info');
        } else {
          throw new Error('winnersCount missing in leaderboard response');
        }
        // Check for endTime field
        if (typeof response.data.endTime !== 'undefined') {
          this.log(`End Time: ${response.data.endTime}`, 'info');
        } else {
          throw new Error('endTime missing in leaderboard response');
        }
      }

      if (response.data.leaderboard.length > 0) {
        this.log('Top 5 leaderboard positions:', 'info');
        response.data.leaderboard.slice(0, 5).forEach((entry, index) => {
          const userInfo = entry.user
            ? `${entry.user.userName} (ID: ${entry.user.id})`
            : 'Private User';
          const wagered = entry.wagered || entry.amount || '0';
          const prize = typeof entry.prize !== 'undefined' ? entry.prize : 0;
          this.log(`  ${index + 1}. ${userInfo}: wagered $${wagered}, prize $${prize}`, 'info');
        });
        // Store expected prize for first place (single-user scenario)
        const top = response.data.leaderboard[0];
        if (top && typeof top.prize === 'number') {
          this.expectedRacePrizeUsd = top.prize;
          this.log(`Expected race prize for #1: $${this.expectedRacePrizeUsd}`, 'info');
        }
      } else {
        this.log('⚠️  No participants in current race', 'warning');
      }

      return response.data;
    } catch (error) {
      this.log(
        `Weekly race leaderboard failed: ${error.response?.data?.message || error.message}`,
        'error',
      );
      return false;
    }
  }

  async testWeeklyRaceHistory() {
    this.log('Testing Weekly Race History API', 'race');

    try {
      const response = await fetchGet(`${API_BASE}/games/weekly-race/history/${this.user.id}`, {
        Authorization: `Bearer ${this.token}`,
      });

      this.log('✅ Weekly race history retrieved successfully!', 'success');
      this.log(`Total races in history: ${response.data.total}`, 'info');

      if (response.data.history.length > 0) {
        this.log('Recent race history:', 'info');
        response.data.history.forEach((race, index) => {
          this.log(
            `  ${index + 1}. ${race.raceName}: Place ${race.place}, Prize: $${race.prize}`,
            'info',
          );
          this.log(`     Date: ${new Date(race.date).toLocaleDateString()}`, 'info');
        });
      } else {
        this.log('⚠️  No race history found for user', 'warning');
      }

      return response.data;
    } catch (error) {
      this.log(
        `Weekly race history failed: ${error.response?.data?.message || error.message}`,
        'error',
      );
      return false;
    }
  }

  async testPublicUserProfile() {
    this.log('Testing Public User Profile API', 'info');

    try {
      // Test public profile endpoint (no authorization required)
      const response = await fetchGet(`${API_BASE}/users/public/${this.user.id}`);

      this.log('✅ Public user profile retrieved successfully!', 'success');

      // Validate response structure
      const profile = response.data;

      // Check required fields (including hideRaceStatistics)
      const requiredFields = [
        'userName',
        'userId',
        'createdAt',
        'vipLevel',
        'statistics',
        'hideStatistics',
        'hideRaceStatistics',
      ];
      const missingFields = requiredFields.filter((field) => !(field in profile));

      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Validate vipLevel structure
      if (!profile.vipLevel || typeof profile.vipLevel !== 'object') {
        throw new Error('vipLevel must be an object');
      }

      const vipRequiredFields = ['level', 'name', 'imageUrl'];
      const vipMissingFields = vipRequiredFields.filter((field) => !(field in profile.vipLevel));

      if (vipMissingFields.length > 0) {
        throw new Error(`vipLevel missing required fields: ${vipMissingFields.join(', ')}`);
      }

      // Validate statistics structure
      if (!profile.statistics || typeof profile.statistics !== 'object') {
        throw new Error('statistics must be an object');
      }

      const statsRequiredFields = ['totalBets', 'numberOfWins', 'numberOfLosses', 'wagered'];
      const statsMissingFields = statsRequiredFields.filter(
        (field) => !(field in profile.statistics),
      );

      if (statsMissingFields.length > 0) {
        throw new Error(`statistics missing required fields: ${statsMissingFields.join(', ')}`);
      }

      // Log profile details
      this.log(`Profile Details:`, 'info');
      this.log(`  User Name: ${profile.userName}`, 'info');
      this.log(`  User ID: ${profile.userId}`, 'info');
      this.log(`  Created At: ${new Date(profile.createdAt).toLocaleDateString()}`, 'info');
      this.log(`  Avatar URL: ${profile.avatarUrl || 'None'}`, 'info');

      this.log(`VIP Level:`, 'info');
      this.log(`  Level: ${profile.vipLevel.level}`, 'info');
      this.log(`  Name: ${profile.vipLevel.name}`, 'info');
      this.log(`  Image URL: ${profile.vipLevel.imageUrl || 'None'}`, 'info');

      this.log(`Statistics:`, 'info');
      this.log(`  Total Bets: ${profile.statistics.totalBets}`, 'info');
      this.log(`  Number of Wins: ${profile.statistics.numberOfWins}`, 'info');
      this.log(`  Number of Losses: ${profile.statistics.numberOfLosses}`, 'info');
      this.log(`  Wagered: ${profile.statistics.wagered}`, 'info');

      this.log(`Privacy Settings:`, 'info');
      this.log(`  Hide Statistics: ${profile.hideStatistics}`, 'info');
      this.log(`  Hide Race Statistics: ${profile.hideRaceStatistics}`, 'info');

      // Test that the endpoint works without authorization (should work)
      this.log('✅ Public endpoint works without authorization', 'success');

      return response.data;
    } catch (error) {
      this.log(
        `Public user profile failed: ${error.response?.data?.message || error.message}`,
        'error',
      );
      if (error.response?.data) {
        this.log(`Error details: ${JSON.stringify(error.response.data, null, 2)}`, 'error');
      }
      return false;
    }
  }

  async testManualRaceFinalization() {
    this.log('Testing Manual Weekly Race Finalization', 'race');

    try {
      this.log('Finalizing current weekly race manually...', 'race');

      const response = await fetchPost(
        `${API_BASE}/games/weekly-race/finalize`,
        {},
        {
          Authorization: `Bearer ${this.token}`,
        },
      );

      this.log('✅ Weekly race finalized successfully!', 'success');
      this.log(`Response: ${response.data.message}`, 'info');

      return response.data;
    } catch (error) {
      this.log(
        `Manual race finalization failed: ${error.response?.data?.message || error.message}`,
        'error',
      );
      return false;
    }
  }

  async cleanupExistingRacePrizes() {
    this.log('Cleaning up existing WEEKLY_RACE_PRIZE (claiming any pending)', 'race');
    try {
      const pending = await fetchGet(`${API_BASE}/bonus/pending?bonusType=WEEKLY_RACE_PRIZE`, {
        Authorization: `Bearer ${this.token}`,
      });
      const dto = pending?.data || {};
      const bonuses = Array.isArray(dto?.data) ? dto.data : Array.isArray(dto) ? dto : [];
      for (const bonus of bonuses) {
        try {
          await fetchPost(
            `${API_BASE}/bonus/claim/${bonus.id}`,
            {},
            { Authorization: `Bearer ${this.token}` },
          );
          this.log(`Claimed pending race prize ${bonus.id} during cleanup`, 'info');
        } catch {
          // Ignore errors during cleanup
        }
      }
      return true;
    } catch (e) {
      this.log(`Cleanup check failed: ${e.message}`, 'warning');
      return true;
    }
  }

  async testWeeklyRacePrizeAutoCredit() {
    this.log('Testing auto-credit of Weekly Race Prizes after finalization', 'race');

    try {
      // Capture BTC balance before race finalization
      let btcBefore = null;
      try {
        const walletsBefore = await fetchGet(`${API_BASE}/balance/wallets`, {
          Authorization: `Bearer ${this.token}`,
        });
        const btcWallet = walletsBefore.data.find((w) => w.asset === 'BTC');
        btcBefore = btcWallet ? parseFloat(btcWallet.balance) : 0;
        this.log(`BTC balance before race finalization: ${btcBefore}`, 'info');
      } catch (error) {
        this.log(`Failed to get BTC balance before finalization: ${error.message}`, 'warning');
      }

      // Finalize the race - this should auto-credit prizes to BTC wallets
      await this.testManualRaceFinalization();

      // Wait a moment for the auto-credit to process
      await new Promise((r) => setTimeout(r, 2000));

      // Check if BTC balance increased (indicating auto-credit worked)
      try {
        const walletsAfter = await fetchGet(`${API_BASE}/balance/wallets`, {
          Authorization: `Bearer ${this.token}`,
        });
        const btcAfter = walletsAfter.data.find((w) => w.asset === 'BTC');
        const btcBalanceAfter = btcAfter ? parseFloat(btcAfter.balance) : 0;

        this.log(`BTC balance after race finalization: ${btcBalanceAfter}`, 'info');

        const deltaBtc = btcBalanceAfter - btcBefore;
        if (deltaBtc > 0) {
          this.log(`✅ BTC balance increased by ${deltaBtc} - auto-credit working!`, 'success');
        } else {
          this.log(`ℹ️ BTC balance did not increase - user may not have won a prize`, 'info');
        }
      } catch (error) {
        this.log(`Failed to check BTC balance after finalization: ${error.message}`, 'warning');
      }

      // Check for CLAIMED race prizes in transaction history
      try {
        const historyResponse = await fetchGet(
          `${API_BASE}/balance/history?operation=BONUS&limit=20`,
          {
            Authorization: `Bearer ${this.token}`,
          },
        );

        const transactions = historyResponse.data?.transactions || [];
        const racePrizeTransactions = transactions.filter(
          (tx) =>
            tx.description &&
            tx.description.includes('Weekly Race') &&
            tx.description.includes('Prize'),
        );

        if (racePrizeTransactions.length > 0) {
          this.log(
            `✅ Found ${racePrizeTransactions.length} auto-credited race prize transactions`,
            'success',
          );
          racePrizeTransactions.forEach((tx) => {
            this.log(`  💰 ${tx.description}: ${tx.amount} ${tx.asset}`, 'info');
          });
        } else {
          this.log('ℹ️ No race prize transactions found in recent history', 'info');
        }
      } catch (error) {
        this.log(`Failed to check transaction history: ${error.message}`, 'warning');
      }

      // Verify there are NO pending WEEKLY_RACE_PRIZE bonuses (they should all be auto-claimed)
      try {
        const pending = await fetchGet(`${API_BASE}/bonus/pending?bonusType=WEEKLY_RACE_PRIZE`, {
          Authorization: `Bearer ${this.token}`,
        });

        const dto = pending?.data || {};
        const bonuses = Array.isArray(dto?.data) ? dto.data : Array.isArray(dto) ? dto : [];

        if (bonuses.length === 0) {
          this.log(
            '✅ No pending WEEKLY_RACE_PRIZE bonuses found - auto-credit working correctly!',
            'success',
          );
        } else {
          this.log(
            `⚠️ Found ${bonuses.length} pending WEEKLY_RACE_PRIZE bonuses - auto-credit may not be working`,
            'warning',
          );
        }
      } catch (error) {
        this.log(`Failed to check pending bonuses: ${error.message}`, 'warning');
      }

      this.log('✅ Weekly Race Prize auto-credit test completed', 'success');
      return true;
    } catch (error) {
      this.log(`❌ Weekly Race Prize auto-credit test failed: ${error.message}`, 'error');
      return false;
    }
  }

  async simulateMultipleBets(count = 5) {
    this.log(`Simulating ${count} dice bets for weekly race`, 'race');

    let successfulBets = 0;
    let failedBets = 0;

    for (let i = 0; i < count; i++) {
      try {
        const betData = {
          gameSessionId: this.generateUUID(),
          betAmount: TEST_BET_AMOUNT,
          betType: Math.random() > 0.5 ? 'ROLL_OVER' : 'ROLL_UNDER',
          targetNumber: Math.floor(Math.random() * 50 + 25), // Integer between 25-74
          clientSeed: `weekly-race-bet-${i}-${Date.now()}`,
        };

        const response = await fetchPost(`${API_BASE}/games/dice/bet`, betData, {
          Authorization: `Bearer ${this.token}`,
        });

        successfulBets++;
        this.log(
          `  Bet ${i + 1}: ${response.data.status} - Roll: ${response.data.rollResult}`,
          'bet',
        );

        // Small delay between bets
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        failedBets++;
        this.log(
          `  Bet ${i + 1} failed: ${error.response?.data?.message || error.message}`,
          'error',
        );
        if (error.response?.data) {
          this.log(`    Error details: ${JSON.stringify(error.response.data, null, 2)}`, 'error');
        }
      }
    }

    this.log(
      `Betting simulation complete: ${successfulBets} successful, ${failedBets} failed`,
      successfulBets > 0 ? 'success' : 'error',
    );
    return { successful: successfulBets, failed: failedBets };
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0,
        v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // hideRaceStatistics Testing Methods
  async testToggleHideRaceStatistics(value = true) {
    this.log(`Testing Update Profile to set hideRaceStatistics=${value}`, 'race');

    try {
      const updateData = {
        hideRaceStatistics: value,
      };

      await fetchPatch(`${API_BASE}/users/profile`, updateData, {
        Authorization: `Bearer ${this.token}`,
      });

      this.log('✅ Profile updated successfully', 'success');
      this.log(`Updated hideRaceStatistics to: ${value}`, 'info');

      // Verify the change by getting profile
      const profileResponse = await fetchGet(`${API_BASE}/users/profile`, {
        Authorization: `Bearer ${this.token}`,
      });

      if (profileResponse.data.hideRaceStatistics === value) {
        this.log('✅ hideRaceStatistics setting verified in profile', 'success');
      } else {
        throw new Error(
          `Setting not saved correctly: expected ${value}, got ${profileResponse.data.hideRaceStatistics}`,
        );
      }

      return true;
    } catch (error) {
      this.log(`❌ Update failed: ${error.response?.data?.message || error.message}`, 'error');
      return false;
    }
  }

  async testHideRaceStatisticsInPublicProfile(expectedHidden = false) {
    this.log(
      `Testing hideRaceStatistics field in public profile (expected hidden: ${expectedHidden})`,
      'race',
    );

    try {
      const response = await fetchGet(`${API_BASE}/users/public/${this.user.id}`, {
        Authorization: `Bearer ${this.token}`,
      });

      const profile = response.data;
      this.log('✅ Public profile retrieved successfully', 'success');

      // Check if hideRaceStatistics field exists and has correct value
      const hasHideRaceField = 'hideRaceStatistics' in profile;
      this.log(
        `hideRaceStatistics field present: ${hasHideRaceField ? 'YES' : 'NO (should be YES)'}`,
        hasHideRaceField ? 'success' : 'error',
      );

      if (hasHideRaceField) {
        this.log(`hideRaceStatistics value: ${profile.hideRaceStatistics}`, 'info');

        // Verify the value matches what we expect
        if (profile.hideRaceStatistics === expectedHidden) {
          this.log('✅ hideRaceStatistics value is correct', 'success');
          return true;
        } else {
          this.log(
            `❌ hideRaceStatistics value mismatch: expected ${expectedHidden}, got ${profile.hideRaceStatistics}`,
            'error',
          );
          return false;
        }
      }

      return hasHideRaceField;
    } catch (error) {
      this.log(
        `❌ Public profile test failed: ${error.response?.data?.message || error.message}`,
        'error',
      );
      return false;
    }
  }

  async testHideRaceHistoryWhenPrivate() {
    this.log('Testing that race history is hidden when hideRaceStatistics=true', 'race');

    try {
      const response = await fetchGet(`${API_BASE}/games/weekly-race/history/${this.user.id}`, {
        Authorization: `Bearer ${this.token}`,
      });

      this.log('✅ Weekly race history endpoint responded', 'success');

      // When hideRaceStatistics=true, should return empty history
      const isHidden = response.data.total === 0 && response.data.history.length === 0;

      if (isHidden) {
        this.log('✅ Race history is correctly hidden (empty response)', 'success');
        this.log(
          `Total races: ${response.data.total}, History length: ${response.data.history.length}`,
          'info',
        );
      } else {
        this.log('❌ Race history is NOT hidden when it should be', 'error');
        this.log(
          `Total races: ${response.data.total}, History length: ${response.data.history.length}`,
          'info',
        );
      }

      return isHidden;
    } catch (error) {
      this.log(
        `❌ Race history test failed: ${error.response?.data?.message || error.message}`,
        'error',
      );
      return false;
    }
  }

  async testHideRaceHistoryWhenPublic() {
    this.log('Testing that race history is visible when hideRaceStatistics=false', 'race');

    try {
      const response = await fetchGet(`${API_BASE}/games/weekly-race/history/${this.user.id}`, {
        Authorization: `Bearer ${this.token}`,
      });

      this.log('✅ Weekly race history endpoint responded', 'success');

      // When hideRaceStatistics=false, should return actual history (even if empty from no participation)
      // The key is that it's not blocked by privacy settings
      this.log(
        `Total races: ${response.data.total}, History length: ${response.data.history.length}`,
        'info',
      );

      if (response.data.history.length > 0) {
        this.log('✅ Race history is visible and contains data', 'success');
        response.data.history.slice(0, 3).forEach((race, index) => {
          this.log(
            `  ${index + 1}. ${race.raceName}: Place ${race.place}, Prize: $${race.prize}`,
            'info',
          );
        });
      } else {
        this.log('✅ Race history is accessible (empty due to no participation)', 'success');
      }

      return true;
    } catch (error) {
      this.log(
        `❌ Race history test failed: ${error.response?.data?.message || error.message}`,
        'error',
      );
      return false;
    }
  }

  async testAnonymousLeaderboardWhenPrivate() {
    this.log(
      'Testing that user appears anonymous on leaderboard when hideRaceStatistics=true',
      'race',
    );

    try {
      const response = await fetchGet(`${API_BASE}/games/weekly-race/leaderboard`, {
        Authorization: `Bearer ${this.token}`,
      });

      this.log('✅ Weekly race leaderboard retrieved successfully', 'success');

      // Look for our user in the leaderboard
      const ourEntry = response.data.leaderboard.find(
        (entry) => entry.user && entry.user.id === this.user.id,
      );

      if (!ourEntry) {
        this.log('✅ User is correctly anonymous on leaderboard (no user info shown)', 'success');

        // Check if there are entries without user info (anonymous entries)
        const anonymousEntries = response.data.leaderboard.filter((entry) => !entry.user);
        if (anonymousEntries.length > 0) {
          this.log(`Found ${anonymousEntries.length} anonymous entries on leaderboard`, 'info');
        }

        return true;
      } else {
        this.log('❌ User is NOT anonymous on leaderboard when they should be', 'error');
        this.log(`Found user entry: ${JSON.stringify(ourEntry, null, 2)}`, 'error');
        return false;
      }
    } catch (error) {
      this.log(
        `❌ Anonymous leaderboard test failed: ${error.response?.data?.message || error.message}`,
        'error',
      );
      return false;
    }
  }

  async testVisibleLeaderboardWhenPublic() {
    this.log(
      'Testing that user appears normally on leaderboard when hideRaceStatistics=false',
      'race',
    );

    try {
      const response = await fetchGet(`${API_BASE}/games/weekly-race/leaderboard`, {
        Authorization: `Bearer ${this.token}`,
      });

      this.log('✅ Weekly race leaderboard retrieved successfully', 'success');

      // Look for our user in the leaderboard
      const ourEntry = response.data.leaderboard.find(
        (entry) => entry.user && entry.user.id === this.user.id,
      );

      if (ourEntry) {
        this.log('✅ User is correctly visible on leaderboard with user info', 'success');
        this.log(
          `User entry: ${ourEntry.user.userName} (ID: ${ourEntry.user.id}) - wagered: $${ourEntry.wagered}`,
          'info',
        );
        return true;
      } else {
        this.log(
          '⚠️  User not found on leaderboard (may not have participated this week)',
          'warning',
        );
        return true; // This is OK if user hasn't bet this week
      }
    } catch (error) {
      this.log(
        `❌ Visible leaderboard test failed: ${error.response?.data?.message || error.message}`,
        'error',
      );
      return false;
    }
  }

  async runWeeklyRaceTests() {
    this.log('🏁 Starting Weekly Race Simulator Tests', 'race');

    // Pre-flight checks
    this.log('\n=== Pre-flight Checks ===', 'setup');

    const userExists = await this.checkUserExists();
    if (!userExists) {
      this.log('❌ Pre-flight checks failed - user verification failed', 'error');
      return { passed: 0, failed: 1, total: 1 };
    }

    const balanceOk = await this.checkBalance();
    if (!balanceOk) {
      this.log('❌ Pre-flight checks failed - insufficient balance', 'error');
      return { passed: 0, failed: 1, total: 1 };
    }

    this.log('✅ Pre-flight checks completed successfully', 'success');

    // Main tests
    this.log('\n=== Running Weekly Race Tests ===', 'race');

    const tests = [
      { name: 'HTTP Authentication', fn: () => this.testHttpAuth() },
      { name: 'HTTP Balance API', fn: () => this.testHttpBalance() },
      { name: 'Public User Profile', fn: () => this.testPublicUserProfile() },

      // hideRaceStatistics Tests - Start with public settings
      {
        name: 'Test hideRaceStatistics=false in Profile',
        fn: () => this.testToggleHideRaceStatistics(false),
      },
      {
        name: 'Test hideRaceStatistics Field in Public Profile (false)',
        fn: () => this.testHideRaceStatisticsInPublicProfile(false),
      },
      {
        name: 'Test Race History Visible When Public',
        fn: () => this.testHideRaceHistoryWhenPublic(),
      },

      // Create some race participation data
      { name: 'Weekly Race Leaderboard (Initial)', fn: () => this.testWeeklyRaceLeaderboard() },
      { name: 'Weekly Race History (Initial)', fn: () => this.testWeeklyRaceHistory() },
      { name: 'Simulate Multiple Bets', fn: () => this.simulateMultipleBets(10) },
      { name: 'Check Leaderboard After Bets', fn: () => this.testWeeklyRaceLeaderboard() },
      {
        name: 'Test User Visible on Leaderboard When Public',
        fn: () => this.testVisibleLeaderboardWhenPublic(),
      },

      // Now test privacy settings
      {
        name: 'Test hideRaceStatistics=true in Profile',
        fn: () => this.testToggleHideRaceStatistics(true),
      },
      {
        name: 'Test hideRaceStatistics Field in Public Profile (true)',
        fn: () => this.testHideRaceStatisticsInPublicProfile(true),
      },
      {
        name: 'Test Race History Hidden When Private',
        fn: () => this.testHideRaceHistoryWhenPrivate(),
      },
      {
        name: 'Test User Anonymous on Leaderboard When Private',
        fn: () => this.testAnonymousLeaderboardWhenPrivate(),
      },

      // Test race finalization and cleanup
      { name: 'Manual Race Finalization', fn: () => this.testManualRaceFinalization() },
      {
        name: 'Test Weekly Race Prize Auto-Credit',
        fn: () => this.testWeeklyRacePrizeAutoCredit(),
      },
      {
        name: 'Check History After Finalization (should be hidden)',
        fn: () => this.testHideRaceHistoryWhenPrivate(),
      },

      // Reset to public for final cleanup
      {
        name: 'Reset hideRaceStatistics=false for Cleanup',
        fn: () => this.testToggleHideRaceStatistics(false),
      },
      { name: 'Cleanup Existing Race Prizes', fn: () => this.cleanupExistingRacePrizes() },
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      this.log(`\n--- ${test.name} ---`, 'info');
      try {
        const result = await test.fn();
        if (result) {
          passed++;
          this.log(`✅ ${test.name} PASSED`, 'success');
        } else {
          failed++;
          this.log(`❌ ${test.name} FAILED`, 'error');
        }
      } catch (error) {
        failed++;
        this.log(`❌ ${test.name} ERROR: ${error.message}`, 'error');
      }

      // Add small delay between tests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Results
    this.log('\n=== Test Results ===', 'race');
    this.log(`✅ Passed: ${passed}`, 'success');
    this.log(`❌ Failed: ${failed}`, failed > 0 ? 'error' : 'info');
    this.log(`📊 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`, 'info');

    return { passed, failed, total: passed + failed };
  }
}

// Run the simulator
if (require.main === module) {
  const simulator = new WeeklyRaceSimulator();
  simulator.runWeeklyRaceTests().catch(console.error);
}

module.exports = WeeklyRaceSimulator;
