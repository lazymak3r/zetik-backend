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

class DiceClientSimulator {
  constructor() {
    this.token = null;
    this.user = null;
    this.lastGameResult = null;
    this.primaryWallet = null;
    this.currentBalance = 0;
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
      const requiredBalance = parseFloat(TEST_BET_AMOUNT) * 5; // Ensure we have 5x the bet amount

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

  async testBalanceChanges() {
    this.log('Testing Balance Change Verification', 'info');

    try {
      // Add delay to avoid rapid requests
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Get balance before bet
      const balanceBeforeResponse = await fetchGet(`${API_BASE}/balance/wallets`, {
        Authorization: `Bearer ${this.token}`,
      });
      const balanceBefore = parseFloat(
        balanceBeforeResponse.data.find((w) => w.isPrimary)?.balance || '0',
      );

      // Check for NaN balance
      if (isNaN(balanceBefore)) {
        const rawBalance = balanceBeforeResponse.data.find((w) => w.isPrimary)?.balance;
        this.log(`❌ Balance before bet is NaN! Raw balance: ${rawBalance}`, 'error');
        throw new Error(`Invalid balance format before bet: ${rawBalance}`);
      }

      this.log(
        `Balance before bet: ${balanceBefore} ${this.primaryWallet?.asset || 'BTC'}`,
        'info',
      );

      const betAmount = parseFloat(TEST_BET_AMOUNT);
      const betData = {
        gameSessionId: this.generateUUID(),
        betAmount: TEST_BET_AMOUNT,
        betType: 'ROLL_UNDER',
        targetNumber: 75.0, // 75% chance to win
        clientSeed: 'balance-test-seed',
      };

      // Place bet
      this.log(`Placing bet of ${betAmount} ${this.primaryWallet?.asset || 'BTC'}...`, 'bet');
      const betResponse = await fetchPost(`${API_BASE}/games/dice/bet`, betData, {
        Authorization: `Bearer ${this.token}`,
      });

      // Add delay before checking balance
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Get balance after bet
      const balanceAfterResponse = await fetchGet(`${API_BASE}/balance/wallets`, {
        Authorization: `Bearer ${this.token}`,
      });
      const balanceAfter = parseFloat(
        balanceAfterResponse.data.find((w) => w.isPrimary)?.balance || '0',
      );

      // Check for NaN balance
      if (isNaN(balanceAfter)) {
        const rawBalance = balanceAfterResponse.data.find((w) => w.isPrimary)?.balance;
        this.log(`❌ Balance after bet is NaN! Raw balance: ${rawBalance}`, 'error');
        throw new Error(`Invalid balance format after bet: ${rawBalance}`);
      }

      const winAmount = parseFloat(betResponse.data.winAmount);

      // Check for NaN win amount
      if (isNaN(winAmount)) {
        this.log(`❌ Win amount is NaN! Raw winAmount: ${betResponse.data.winAmount}`, 'error');
        throw new Error(`Invalid win amount format: ${betResponse.data.winAmount}`);
      }
      const expectedBalance = balanceBefore - betAmount + winAmount;
      const tolerance = 0.00000002; // 2 satoshi tolerance for crypto

      this.log('📊 Balance Change Analysis:', 'info');
      this.log(`   Before bet: ${balanceBefore} ${this.primaryWallet?.asset || 'BTC'}`, 'info');
      this.log(`   Bet amount: ${betAmount} ${this.primaryWallet?.asset || 'BTC'}`, 'info');
      this.log(`   Win amount: ${winAmount} ${this.primaryWallet?.asset || 'BTC'}`, 'info');
      this.log(
        `   Expected after: ${expectedBalance} ${this.primaryWallet?.asset || 'BTC'}`,
        'info',
      );
      this.log(`   Actual after: ${balanceAfter} ${this.primaryWallet?.asset || 'BTC'}`, 'info');
      this.log(
        `   Difference: ${Math.abs(balanceAfter - expectedBalance)} ${this.primaryWallet?.asset || 'BTC'}`,
        'info',
      );

      if (Math.abs(balanceAfter - expectedBalance) <= tolerance) {
        this.log('✅ Balance change verification PASSED', 'success');
        return true;
      } else {
        this.log('❌ Balance change verification FAILED', 'error');
        return false;
      }
    } catch (error) {
      this.log(
        `Balance change test failed: ${error.response?.data?.message || error.message}`,
        'error',
      );
      if (error.response?.data) {
        this.log(`Error details: ${JSON.stringify(error.response.data, null, 2)}`, 'error');
      }
      return false;
    }
  }

  async testHttpGameHistory() {
    this.log('Testing HTTP Game History API', 'info');

    try {
      const response = await fetchGet(`${API_BASE}/games/dice/history?limit=5`, {
        Authorization: `Bearer ${this.token}`,
      });

      this.log(`✅ Game history retrieved: ${response.data.length} games`, 'success');

      if (response.data.length > 0) {
        const latestGame = response.data[0];
        this.log('Latest game details:', 'info');
        this.log(`  ID: ${latestGame.id}`, 'info');
        this.log(`  Bet Amount: ${latestGame.betAmount} ${latestGame.asset}`, 'info');
        this.log(`  Asset: ${latestGame.asset}`, 'info');
        this.log(`  Status: ${latestGame.status}`, 'info');
      }

      return true;
    } catch (error) {
      this.log(`Game history failed: ${error.response?.data?.message || error.message}`, 'error');
      return false;
    }
  }

  async testHttpGameDetails() {
    this.log('Testing HTTP Game Details API', 'info');

    try {
      // First get a game from history
      const historyResponse = await fetchGet(`${API_BASE}/games/dice/history?limit=1`, {
        Authorization: `Bearer ${this.token}`,
      });

      if (historyResponse.data.length === 0) {
        this.log('⚠️  No games found for details test, skipping', 'warning');
        return true;
      }

      const gameId = historyResponse.data[0].id;
      this.log(`Retrieving details for game: ${gameId}`, 'info');

      const response = await fetchGet(`${API_BASE}/games/dice/bet/${gameId}`, {
        Authorization: `Bearer ${this.token}`,
      });

      this.log('✅ Game details retrieved successfully', 'success');
      this.log(`  ID: ${response.data.id}`, 'info');
      this.log(`  Bet Amount: ${response.data.betAmount} ${response.data.asset}`, 'info');
      this.log(`  Asset: ${response.data.asset}`, 'info');
      this.log(`  Status: ${response.data.status}`, 'info');

      return true;
    } catch (error) {
      this.log(`Game details failed: ${error.response?.data?.message || error.message}`, 'error');
      return false;
    }
  }

  async testUserBetHistory() {
    this.log('Testing User Bet History API (user_bets table)', 'info');

    try {
      // Get user bet history from the new user_bets table
      const response = await fetchGet(`${API_BASE}/games/bets/history?limit=10`, {
        Authorization: `Bearer ${this.token}`,
      });

      this.log(`✅ User bet history retrieved: ${response.data.length} bets`, 'success');

      if (response.data.length > 0) {
        const latestBet = response.data[0];
        this.log('Latest bet from user_bets table:', 'info');
        this.log(`  Game: ${latestBet.game}`, 'info');
        this.log(`  Bet ID: ${latestBet.betId}`, 'info');
        this.log(`  Bet Amount: ${latestBet.betAmount} ${latestBet.asset}`, 'info');
        this.log(`  Multiplier: ${latestBet.multiplier}`, 'info');
        this.log(`  Payout: ${latestBet.payout} ${latestBet.asset}`, 'info');
        this.log(`  Created At: ${latestBet.createdAt}`, 'info');

        // Verify the bet structure
        const requiredFields = [
          'game',
          'betId',
          'betAmount',
          'asset',
          'multiplier',
          'payout',
          'createdAt',
        ];
        const missingFields = requiredFields.filter(
          (field) => !Object.prototype.hasOwnProperty.call(latestBet, field),
        );

        if (missingFields.length > 0) {
          this.log(`❌ Missing fields in user bet: ${missingFields.join(', ')}`, 'error');
          return false;
        }

        // Verify that game is DICE
        if (latestBet.game !== 'DICE') {
          this.log(`❌ Expected game to be DICE, got: ${latestBet.game}`, 'error');
          return false;
        }

        // Verify bet amount is a valid number string
        if (isNaN(parseFloat(latestBet.betAmount))) {
          this.log(`❌ Invalid bet amount format: ${latestBet.betAmount}`, 'error');
          return false;
        }

        // Verify multiplier is a valid number string
        if (isNaN(parseFloat(latestBet.multiplier))) {
          this.log(`❌ Invalid multiplier format: ${latestBet.multiplier}`, 'error');
          return false;
        }

        // Verify payout is a valid number string
        if (isNaN(parseFloat(latestBet.payout))) {
          this.log(`❌ Invalid payout format: ${latestBet.payout}`, 'error');
          return false;
        }

        this.log('✅ User bet data structure validation passed', 'success');
      } else {
        this.log('⚠️  No bets found in user_bets table', 'warning');
      }

      return true;
    } catch (error) {
      this.log(
        `User bet history failed: ${error.response?.data?.message || error.message}`,
        'error',
      );
      return false;
    }
  }

  async testUserBetRecording() {
    this.log('Testing User Bet Recording in user_bets Table', 'info');

    try {
      // For simplicity, we'll just check if a bet gets recorded correctly
      this.log(`Checking bet recording by placing a test bet`, 'info');

      // Place a new bet
      const betData = {
        gameSessionId: this.generateUUID(),
        betAmount: TEST_BET_AMOUNT,
        betType: 'ROLL_OVER',
        targetNumber: 75.0, // Low win chance for testing
        clientSeed: 'test-user-bet-recording-seed',
      };

      this.log(`Placing test bet: ${JSON.stringify(betData)}`, 'bet');

      const betResponse = await fetchPost(`${API_BASE}/games/dice/bet`, betData, {
        Authorization: `Bearer ${this.token}`,
      });

      const betResult = betResponse.data;
      this.log(`Bet placed! ID: ${betResult.id}, Status: ${betResult.status}`, 'game');
      this.log(`Roll Result: ${betResult.rollResult}, Win Amount: ${betResult.winAmount}`, 'game');

      // Wait a short moment for the bet to be recorded
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get the latest bet from user_bets table
      const latestBetsResponse = await fetchGet(`${API_BASE}/games/bets/history?limit=1`, {
        Authorization: `Bearer ${this.token}`,
      });

      if (latestBetsResponse.data.length === 0) {
        this.log('❌ No bets found in user_bets table after placing bet', 'error');
        return false;
      }

      const latestUserBet = latestBetsResponse.data[0];

      // Verify the recorded bet matches our placed bet
      if (latestUserBet.betId !== betResult.id) {
        this.log(
          `❌ Bet ID mismatch. Expected: ${betResult.id}, Got: ${latestUserBet.betId}`,
          'error',
        );
        return false;
      }

      // Compare bet amounts as numbers to handle formatting differences
      if (parseFloat(latestUserBet.betAmount) !== parseFloat(TEST_BET_AMOUNT)) {
        this.log(
          `❌ Bet amount mismatch. Expected: ${TEST_BET_AMOUNT}, Got: ${latestUserBet.betAmount}`,
          'error',
        );
        return false;
      }

      if (latestUserBet.game !== 'DICE') {
        this.log(`❌ Game type mismatch. Expected: DICE, Got: ${latestUserBet.game}`, 'error');
        return false;
      }

      // Verify payout matches the bet result
      // For wins: payout = total winnings amount
      // For losses: payout = negative bet amount (showing the loss)
      const expectedPayout =
        betResult.status === 'WON' ? betResult.winAmount : `-${TEST_BET_AMOUNT}`;

      // Compare payouts as numbers to handle formatting differences
      if (parseFloat(latestUserBet.payout) !== parseFloat(expectedPayout)) {
        this.log(
          `❌ Payout mismatch. Expected: ${expectedPayout}, Got: ${latestUserBet.payout}`,
          'error',
        );
        return false;
      }

      // Verify multiplier format (should be 4 decimal places)
      const expectedMultiplier =
        betResult.status === 'WON'
          ? parseFloat(betResult.winAmount) / parseFloat(TEST_BET_AMOUNT)
          : 0.0;

      if (Math.abs(parseFloat(latestUserBet.multiplier) - expectedMultiplier) > 0.0001) {
        this.log(
          `❌ Multiplier mismatch. Expected: ${expectedMultiplier.toFixed(4)}, Got: ${latestUserBet.multiplier}`,
          'error',
        );
        return false;
      }

      this.log('✅ User bet recording validation passed', 'success');
      this.log(
        `✅ Bet correctly recorded in user_bets table with ID: ${latestUserBet.betId}`,
        'success',
      );

      return true;
    } catch (error) {
      this.log(
        `User bet recording test failed: ${error.response?.data?.message || error.message}`,
        'error',
      );
      return false;
    }
  }

  async testProvablyFairSeedInfo() {
    this.log('Testing Provably Fair Seed Info Endpoint', 'info');

    try {
      // First, place a bet to get a bet ID
      const betData = {
        gameSessionId: this.generateUUID(),
        betAmount: TEST_BET_AMOUNT,
        betType: 'ROLL_OVER',
        targetNumber: 75.0,
        clientSeed: 'test-seed-info-verification',
      };

      this.log(`Placing test bet for seed info verification: ${JSON.stringify(betData)}`, 'bet');

      const betResponse = await fetchPost(`${API_BASE}/games/dice/bet`, betData, {
        Authorization: `Bearer ${this.token}`,
      });

      const betResult = betResponse.data;
      this.log(`Bet placed! ID: ${betResult.id}, Roll: ${betResult.rollResult}`, 'game');

      // Wait a moment for the bet to be processed
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Test the seed info endpoint
      const seedInfoResponse = await fetchGet(
        `${API_BASE}/games/provably-fair/seed-info/bet?game=DICE&betId=${betResult.id}`,
        {
          Authorization: `Bearer ${this.token}`,
        },
      );

      const seedInfo = seedInfoResponse.data;
      this.log(`Seed info retrieved: ${JSON.stringify(seedInfo)}`, 'game');

      // Validate response structure
      if (!seedInfo.serverSeed || !seedInfo.clientSeed || typeof seedInfo.nonce !== 'number') {
        this.log('❌ Seed info missing required fields', 'error');
        return false;
      }

      if (typeof seedInfo.outcome !== 'number' || typeof seedInfo.isValid !== 'boolean') {
        this.log('❌ Seed info missing verification fields', 'error');
        return false;
      }

      // Verify the client seed matches what we sent
      if (seedInfo.clientSeed !== betData.clientSeed) {
        this.log(
          `❌ Client seed mismatch. Expected: ${betData.clientSeed}, Got: ${seedInfo.clientSeed}`,
          'error',
        );
        return false;
      }

      // Verify the outcome matches the roll result
      const expectedOutcome = parseFloat(betResult.rollResult);
      if (Math.abs(seedInfo.outcome - expectedOutcome) > 0.01) {
        this.log(
          `❌ Outcome mismatch. Expected: ${expectedOutcome}, Got: ${seedInfo.outcome}`,
          'error',
        );
        return false;
      }

      // Verify the calculated outcome matches the actual outcome (provably fair verification)
      if (Math.abs(seedInfo.calculatedOutcome - expectedOutcome) > 0.01) {
        this.log(
          `❌ Calculated outcome mismatch. Expected: ${expectedOutcome}, Got: ${seedInfo.calculatedOutcome}`,
          'error',
        );
        return false;
      }

      // The verification should be valid
      if (!seedInfo.isValid) {
        this.log('❌ Provably fair verification failed - isValid is false', 'error');
        return false;
      }

      // Verify hash is present
      if (!seedInfo.hash || typeof seedInfo.hash !== 'string') {
        this.log('❌ Hash missing or invalid', 'error');
        return false;
      }

      this.log('✅ Provably fair seed info verification passed', 'success');
      this.log(`✅ Server seed: ${seedInfo.serverSeed.substring(0, 16)}...`, 'success');
      this.log(`✅ Client seed: ${seedInfo.clientSeed}`, 'success');
      this.log(`✅ Nonce: ${seedInfo.nonce}`, 'success');
      this.log(`✅ Outcome verified: ${seedInfo.outcome} (valid: ${seedInfo.isValid})`, 'success');

      return true;
    } catch (error) {
      this.log(
        `Seed info verification test failed: ${error.response?.data?.message || error.message}`,
        'error',
      );
      return false;
    }
  }

  async testSetupValidation() {
    this.log('Testing Setup Validation', 'info');

    try {
      // Test invalid bet type
      try {
        await fetchPost(
          `${API_BASE}/games/dice/bet`,
          {
            gameSessionId: this.generateUUID(),
            betAmount: '1.0',
            betType: 'INVALID_TYPE',
            targetNumber: 50.0,
          },
          {
            Authorization: `Bearer ${this.token}`,
          },
        );
        this.log('❌ Should have failed with invalid bet type', 'error');
        return false;
      } catch (error) {
        if (error.response?.status === 400) {
          this.log('✅ Invalid bet type properly rejected', 'success');
        } else {
          throw error;
        }
      }

      // Test invalid amount (since we removed currency validation)
      try {
        await fetchPost(
          `${API_BASE}/games/dice/bet`,
          {
            gameSessionId: this.generateUUID(),
            betAmount: 'invalid_amount',
            betType: 'ROLL_OVER',
            targetNumber: 50.0,
          },
          {
            Authorization: `Bearer ${this.token}`,
          },
        );
        this.log('❌ Should have failed with invalid amount', 'error');
        return false;
      } catch (error) {
        if (error.response?.status === 400) {
          this.log('✅ Invalid currency properly rejected', 'success');
        } else {
          throw error;
        }
      }

      this.log('✅ Setup validation tests passed', 'success');
      return true;
    } catch (error) {
      this.log(
        `Setup validation failed: ${error.response?.data?.message || error.message}`,
        'error',
      );
      return false;
    }
  }

  async testNonceUniqueness() {
    this.log('Testing Nonce Uniqueness Across Multiple Bets', 'info');

    try {
      const numberOfBets = 5;
      const betIds = [];
      const nonces = [];

      this.log(`Placing ${numberOfBets} consecutive bets to test nonce uniqueness...`, 'info');

      // Use same clientSeed for all bets to avoid creating new seed pairs
      const testClientSeed = `nonce-uniqueness-test-${Date.now()}`;

      // Place multiple bets consecutively
      for (let i = 0; i < numberOfBets; i++) {
        const betData = {
          gameSessionId: this.generateUUID(),
          betAmount: TEST_BET_AMOUNT,
          betType: 'ROLL_OVER',
          targetNumber: 50.0 + i, // Vary target slightly to ensure different cache keys
          clientSeed: testClientSeed, // Same clientSeed for all bets
        };

        this.log(
          `🎲 Placing bet ${i + 1}/${numberOfBets} (target: ${betData.targetNumber})`,
          'bet',
        );

        const betResponse = await fetchPost(`${API_BASE}/games/dice/bet`, betData, {
          Authorization: `Bearer ${this.token}`,
        });

        const betResult = betResponse.data;
        betIds.push(betResult.id);

        this.log(
          `✅ Bet ${i + 1} placed! ID: ${betResult.id}, Roll: ${betResult.rollResult}`,
          'game',
        );

        // Small delay between bets to ensure proper sequencing
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Wait for all bets to be fully processed
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get seed info for each bet and collect nonces
      for (let i = 0; i < betIds.length; i++) {
        const betId = betIds[i];

        this.log(`🔍 Getting seed info for bet ${i + 1}: ${betId}`, 'info');

        const seedInfoResponse = await fetchGet(
          `${API_BASE}/games/provably-fair/seed-info/bet?game=DICE&betId=${betId}`,
          { Authorization: `Bearer ${this.token}` },
        );

        const seedInfo = seedInfoResponse.data;
        nonces.push(seedInfo.nonce);

        this.log(`📊 Bet ${i + 1}: Nonce = ${seedInfo.nonce}`, 'info');
      }

      // Validate nonce uniqueness
      const uniqueNonces = new Set(nonces);

      this.log(`\n🔢 Nonce Analysis:`, 'info');
      this.log(`   Total bets: ${numberOfBets}`, 'info');
      this.log(`   Nonces collected: [${nonces.join(', ')}]`, 'info');
      this.log(`   Unique nonces: ${uniqueNonces.size}`, 'info');
      this.log(`   Expected unique: ${numberOfBets}`, 'info');

      if (uniqueNonces.size !== numberOfBets) {
        this.log(
          `❌ Nonce uniqueness FAILED! Found ${uniqueNonces.size} unique nonces, expected ${numberOfBets}`,
          'error',
        );
        return false;
      }

      // Validate nonce sequence (should be increasing)
      let isSequential = true;
      for (let i = 1; i < nonces.length; i++) {
        if (nonces[i] <= nonces[i - 1]) {
          isSequential = false;
          break;
        }
      }

      this.log(`🔢 Nonce sequence validation:`, 'info');
      this.log(
        `   Is sequential: ${isSequential ? 'YES' : 'NO'}`,
        isSequential ? 'success' : 'error',
      );

      if (!isSequential) {
        this.log(
          `⚠️  Warning: Nonces are not sequential, but uniqueness is still valid`,
          'warning',
        );
      }

      this.log(`✅ All ${numberOfBets} bets have unique nonces!`, 'success');
      this.log(`✅ Nonce uniqueness validation passed`, 'success');

      return true;
    } catch (error) {
      this.log(`❌ Nonce uniqueness test error: ${error.message}`, 'error');
      return false;
    }
  }

  async testBetFeedAPI() {
    this.log('Testing VIP Status and User Profile', 'info');

    try {
      // Get user profile to check VIP level
      const profileResponse = await fetchGet(`${API_BASE}/users/profile`, {
        Authorization: `Bearer ${this.token}`,
      });

      const profile = profileResponse.data;
      this.log('User Profile:', 'info');
      this.log(`  User ID: ${profile.id}`, 'info');
      this.log(`  Username: ${profile.username}`, 'info');
      this.log(`  Display Name: ${profile.displayName || 'N/A'}`, 'info');
      this.log(`  VIP Level: ${profile.vipLevel}`, 'info');
      this.log(`  VIP Level Image: ${profile.vipLevelImage || 'EMPTY'}`, 'info');
      this.log(`  Is Private: ${profile.isPrivate}`, 'info');

      if (profile.vipLevelImage) {
        this.log('✅ VIP Level Image found in user profile!', 'success');
        this.log(`  VIP Image Path: ${profile.vipLevelImage}`, 'info');
      } else {
        this.log('⚠️  VIP Level Image is empty in user profile', 'warning');
      }

      // Check user bet history to see if records exist
      const betsResponse = await fetchGet(`${API_BASE}/games/bets/history?limit=3`, {
        Authorization: `Bearer ${this.token}`,
      });

      const bets = betsResponse.data;
      this.log(`User Bets History: ${bets.length} bets found`, 'info');

      if (bets.length > 0) {
        const latestBet = bets[0];
        this.log('Latest bet info:', 'info');
        this.log(`  Game: ${latestBet.game}`, 'info');
        this.log(`  Bet ID: ${latestBet.betId}`, 'info');
        this.log(`  Bet Amount: ${latestBet.betAmount} ${latestBet.asset}`, 'info');
        this.log(`  Multiplier: ${latestBet.multiplier}`, 'info');
        this.log(`  Payout: ${latestBet.payout} ${latestBet.asset}`, 'info');
        this.log(`  Created At: ${latestBet.createdAt}`, 'info');

        this.log('✅ User has bet history - bet-feed should work', 'success');
      } else {
        this.log('⚠️  No bets found in user history', 'warning');
      }

      // Summary
      const hasVipImage = profile.vipLevelImage && profile.vipLevelImage.length > 0;
      const hasBets = bets.length > 0;
      const isPrivate = profile.isPrivate;

      this.log('=== VIP Status Summary ===', 'info');
      this.log(`  VIP Level: ${profile.vipLevel}`, 'info');
      this.log(
        `  Has VIP Image: ${hasVipImage ? 'YES' : 'NO'}`,
        hasVipImage ? 'success' : 'warning',
      );
      this.log(`  Has Bet History: ${hasBets ? 'YES' : 'NO'}`, hasBets ? 'success' : 'warning');
      this.log(`  Is Private: ${isPrivate ? 'YES' : 'NO'}`, isPrivate ? 'warning' : 'success');

      if (hasVipImage && hasBets && !isPrivate) {
        this.log('🎉 User should appear in bet-feed with VIP image!', 'success');
      } else {
        this.log('⚠️  User may not appear properly in bet-feed', 'warning');
        if (isPrivate) {
          this.log('  → User is private, will not show in bet-feed', 'info');
        }
        if (!hasVipImage) {
          this.log('  → User has no VIP image', 'info');
        }
        if (!hasBets) {
          this.log('  → User has no bet history', 'info');
        }
      }

      return true;
    } catch (error) {
      this.log(`VIP Status test failed: ${error.message}`, 'error');
      if (error.response) {
        this.log(`Response status: ${error.response.status}`, 'error');
        this.log(`Response data: ${JSON.stringify(error.response.data, null, 2)}`, 'error');
      }
      return false;
    }
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0,
        v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  async runTests() {
    this.log('🎲 Starting Dice Game Client Simulator Tests', 'game');

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
    this.log('\n=== Running Tests ===', 'info');

    const tests = [
      { name: 'HTTP Authentication', fn: () => this.testHttpAuth() },
      { name: 'HTTP Balance API', fn: () => this.testHttpBalance() },
      { name: 'HTTP Dice Betting', fn: () => this.testHttpBetting() },
      { name: 'Balance Change Verification', fn: () => this.testBalanceChanges() },
      { name: 'HTTP Game History', fn: () => this.testHttpGameHistory() },
      { name: 'HTTP Game Details', fn: () => this.testHttpGameDetails() },
      { name: 'User Bet History', fn: () => this.testUserBetHistory() },
      { name: 'User Bet Recording', fn: () => this.testUserBetRecording() },
      { name: 'Provably Fair Seed Info', fn: () => this.testProvablyFairSeedInfo() },
      { name: 'Nonce Uniqueness Test', fn: () => this.testNonceUniqueness() },
      { name: 'VIP Status Check', fn: () => this.testBetFeedAPI() },
      { name: 'Setup Validation', fn: () => this.testSetupValidation() },
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
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Results
    this.log('\n=== Test Results ===', 'info');
    this.log(`✅ Passed: ${passed}`, 'success');
    this.log(`❌ Failed: ${failed}`, failed > 0 ? 'error' : 'info');
    this.log(`📊 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`, 'info');

    return { passed, failed, total: passed + failed };
  }
}

// Run the simulator
if (require.main === module) {
  const simulator = new DiceClientSimulator();
  simulator.runTests().catch(console.error);
}

module.exports = DiceClientSimulator;
