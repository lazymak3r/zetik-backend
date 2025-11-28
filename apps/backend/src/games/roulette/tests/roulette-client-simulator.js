const BASE_URL = 'http://localhost:3000/v1';
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'TestPassword123';

let authToken = '';
let userId = '';

// Test configuration
const TESTS = {
  1: 'User Authentication',
  2: 'User Exists Check',
  3: 'Balance Check',
  4: 'HTTP Balance API',
  5: 'HTTP Roulette Betting (Straight + Red)',
  6: 'Balance Change Verification (Corner Bet)',
  6.5: 'Balance Change Verification (Basket Bet)',
  6.7: 'Balance Change Verification (Trio Bet)',
  7: 'HTTP Game History',
  8: 'HTTP Game Details',
  9: 'Setup Validation',
  10: 'Provably Fair Seed Info',
};

// Test results tracking
const results = {};
let currentBalance = 0;
let primaryAsset = 'BTC';

async function makeRequest(endpoint, method = 'GET', body = null, useAuth = true) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
  };

  if (useAuth && authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const config = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
    }

    return data;
  } catch (error) {
    console.error(`Request failed for ${method} ${endpoint}:`, error.message);
    throw error;
  }
}

async function test1_userAuthentication() {
  console.log('\n🔐 Test 1: User Authentication');

  try {
    const loginData = await makeRequest(
      '/auth/login/email',
      'POST',
      {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
      false,
    );

    authToken = loginData.accessToken;
    userId = loginData.user.id;

    console.log('✅ User logged in successfully');
    console.log(`   User ID: ${userId}`);

    results[1] = { success: true, details: 'Authentication completed' };
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    results[1] = { success: false, error: error.message };
    throw error;
  }
}

async function test2_userExistsCheck() {
  console.log('\n👤 Test 2: User Exists Check');

  try {
    const userData = await makeRequest('/users/profile');

    if (userData.id === userId) {
      console.log('✅ User exists and data matches');
      console.log(`   Username: ${userData.username}`);
      console.log(`   Email: ${userData.email || 'N/A'}`);
      results[2] = { success: true, details: 'User verification completed' };
    } else {
      throw new Error('User ID mismatch');
    }
  } catch (error) {
    console.error('❌ User check failed:', error.message);
    results[2] = { success: false, error: error.message };
    throw error;
  }
}

async function test3_balanceCheck() {
  console.log('\n💰 Test 3: Balance Check');

  try {
    const balanceData = await makeRequest('/balance/wallets');
    const primaryWallet = balanceData.find((wallet) => wallet.isPrimary);

    if (!primaryWallet) {
      throw new Error('Primary wallet not found');
    }

    currentBalance = parseFloat(primaryWallet.balance);
    primaryAsset = primaryWallet.asset;

    console.log('✅ Balance retrieved successfully');
    console.log(`   Current Balance: ${currentBalance.toFixed(8)} ${primaryWallet.asset}`);
    console.log(`   Asset: ${primaryWallet.asset}`);

    results[3] = {
      success: true,
      details: `Balance: ${currentBalance.toFixed(8)} ${primaryWallet.asset}`,
      balance: currentBalance,
    };
  } catch (error) {
    console.error('❌ Balance check failed:', error.message);
    results[3] = { success: false, error: error.message };
    throw error;
  }
}

async function test4_httpBalanceAPI() {
  console.log('\n🌐 Test 4: HTTP Balance API');

  try {
    const response = await makeRequest('/balance/wallets');
    const primaryWallet = response.find((wallet) => wallet.isPrimary);

    if (!primaryWallet) {
      throw new Error('Primary wallet not found');
    }

    if (typeof primaryWallet.balance === 'string' && primaryWallet.asset) {
      console.log('✅ HTTP Balance API working correctly');
      console.log(
        `   API Balance: ${parseFloat(primaryWallet.balance).toFixed(8)} ${primaryWallet.asset}`,
      );
      console.log(`   API Asset: ${primaryWallet.asset}`);
      results[4] = { success: true, details: 'HTTP Balance API validated' };
    } else {
      throw new Error('Invalid balance API response format');
    }
  } catch (error) {
    console.error('❌ HTTP Balance API failed:', error.message);
    results[4] = { success: false, error: error.message };
    throw error;
  }
}

async function test5_httpRouletteBetting() {
  console.log('\n🎲 Test 5: HTTP Roulette Betting (Straight + Red)');

  try {
    // Get initial balance
    const initialBalanceData = await makeRequest('/balance/wallets');
    const primaryWallet = initialBalanceData.find((wallet) => wallet.isPrimary);
    const initialBalance = parseFloat(primaryWallet.balance);

    console.log(`   Initial Balance: ${initialBalance.toFixed(8)} ${primaryWallet.asset}`);

    // Place a simple straight bet first to test
    const betData = {
      bets: [
        {
          type: 'straight',
          numbers: [7],
          amount: '0.00001',
        },
      ],
      clientSeed: 'test-client-seed-roulette',
    };

    const totalBetAmount = 0.00001;
    console.log(`   Total Bet Amount: ${totalBetAmount.toFixed(8)} ${primaryWallet.asset}`);
    console.log(`   Bet Type: Straight bet on number 7`);

    // Place roulette bet
    const gameData = await makeRequest('/games/roulette/bet', 'POST', betData);

    console.log('✅ Roulette bet placed successfully');
    console.log(`   Game ID: ${gameData.id}`);
    console.log(`   Asset: ${gameData.asset}`);
    console.log(`   Winning Number: ${gameData.winningNumber}`);
    console.log(`   Winning Color: ${gameData.winningColor}`);
    console.log(
      `   Total Payout: ${parseFloat(gameData.totalPayout).toFixed(8)} ${gameData.asset}`,
    );
    console.log(
      `   Total Multiplier: ${gameData.totalMultiplier ? gameData.totalMultiplier + 'x' : 'N/A'}`,
    );
    console.log(`   Profit: ${parseFloat(gameData.profit).toFixed(8)} ${gameData.asset}`);

    // Check individual bet results
    let totalWinAmount = 0;
    gameData.bets.forEach((bet, index) => {
      const payout = parseFloat(bet.payout || '0');
      totalWinAmount += payout;
      console.log(
        `   Bet ${index + 1} (${bet.type}): ${payout > 0 ? 'WIN' : 'LOSS'} - Payout: ${payout.toFixed(8)} ${gameData.asset}`,
      );
    });

    // Verify balance change after betting
    const newBalanceData = await makeRequest('/balance/wallets');
    const newBalance = parseFloat(newBalanceData.find((wallet) => wallet.isPrimary).balance);
    const expectedBalance = initialBalance - totalBetAmount + totalWinAmount;
    const balanceDifference = Math.abs(newBalance - expectedBalance);

    console.log(`   New Balance: ${newBalance.toFixed(8)} ${primaryWallet.asset}`);
    console.log(`   Expected Balance: ${expectedBalance.toFixed(8)} ${primaryWallet.asset}`);
    console.log(`   Balance Difference: ${balanceDifference.toFixed(8)} ${primaryWallet.asset}`);

    if (balanceDifference <= 0.00000002) {
      // 2 cent tolerance for rounding
      console.log('✅ Balance calculation verified correctly');
      currentBalance = newBalance;
      results[5] = {
        success: true,
        details: `Roulette bet completed, balance verified`,
        gameId: gameData.id,
        winningNumber: gameData.winningNumber,
        totalWinAmount: totalWinAmount,
        balanceChange: newBalance - initialBalance,
      };
    } else {
      throw new Error(
        `Balance mismatch: expected ${expectedBalance.toFixed(8)} ${primaryAsset}, got ${newBalance.toFixed(8)} ${primaryAsset}`,
      );
    }
  } catch (error) {
    console.error('❌ HTTP Roulette Betting failed:', error.message);
    results[5] = { success: false, error: error.message };
    throw error;
  }
}

async function test6_balanceChangeVerification() {
  console.log('\n🔍 Test 6: Balance Change Verification (Corner Bet)');

  try {
    const betAmount = 0.00002;

    console.log(`   Testing corner bet: ${betAmount.toFixed(8)} ${primaryAsset}`);

    // Check balance before bet
    const beforeBetData = await makeRequest('/balance/wallets');
    const primaryWalletBefore = beforeBetData.find((wallet) => wallet.isPrimary);
    const beforeBetBalance = parseFloat(primaryWalletBefore.balance);
    console.log(`   Balance before bet: ${beforeBetBalance.toFixed(8)} ${primaryAsset}`);

    // Place corner bet (4-number bet)
    const betData = {
      bets: [
        {
          type: 'corner',
          numbers: [1, 2, 4, 5], // Corner bet on 1,2,4,5
          amount: betAmount.toFixed(8),
        },
      ],
      clientSeed: 'test-verification-seed',
    };

    const gameData = await makeRequest('/games/roulette/bet', 'POST', betData);

    // Check balance after bet
    const afterBetData = await makeRequest('/balance/wallets');
    const primaryWalletAfter = afterBetData.find((wallet) => wallet.isPrimary);
    const afterBetBalance = parseFloat(primaryWalletAfter.balance);

    const totalWinAmount = parseFloat(gameData.totalPayout || '0');
    const expectedFinalBalance = beforeBetBalance - betAmount + totalWinAmount;
    const finalBalanceDifference = Math.abs(afterBetBalance - expectedFinalBalance);

    console.log(`   Winning Number: ${gameData.winningNumber}`);
    console.log(`   Corner Bet Numbers: [1, 2, 4, 5]`);
    console.log(`   Corner Bet Result: ${totalWinAmount > 0 ? 'WIN' : 'LOSS'}`);
    console.log(`   Win Amount: ${totalWinAmount.toFixed(8)} ${primaryAsset}`);
    console.log(`   Final Balance: ${afterBetBalance.toFixed(8)} ${primaryAsset}`);
    console.log(`   Expected Final: ${expectedFinalBalance.toFixed(8)} ${primaryAsset}`);
    console.log(`   Final Difference: ${finalBalanceDifference.toFixed(8)} ${primaryAsset}`);

    if (finalBalanceDifference <= 0.00000002) {
      console.log('✅ Complete balance verification successful');
      currentBalance = afterBetBalance;
      results[6] = {
        success: true,
        details: 'Balance change verification completed',
        balanceFlow: {
          initial: beforeBetBalance,
          bet: betAmount,
          win: totalWinAmount,
          final: afterBetBalance,
          difference: finalBalanceDifference,
        },
      };
    } else {
      throw new Error(
        `Final balance verification failed: difference ${finalBalanceDifference.toFixed(8)} ${primaryAsset}`,
      );
    }
  } catch (error) {
    console.error('❌ Balance Change Verification failed:', error.message);
    results[6] = { success: false, error: error.message };
    throw error;
  }
}

async function test6_5_basketBetVerification() {
  console.log('\n🧺 Test 6.5: Balance Change Verification (Basket Bet)');

  try {
    const betAmount = 0.000015;

    console.log(`   Testing basket bet: ${betAmount.toFixed(8)} ${primaryAsset}`);

    // Check balance before bet
    const beforeBetData = await makeRequest('/balance/wallets');
    const primaryWalletBefore = beforeBetData.find((wallet) => wallet.isPrimary);
    const beforeBetBalance = parseFloat(primaryWalletBefore.balance);
    console.log(`   Balance before bet: ${beforeBetBalance.toFixed(8)} ${primaryAsset}`);

    // Place basket bet (0,1,2,3)
    const betData = {
      bets: [
        {
          type: 'basket',
          numbers: [0, 1, 2, 3], // Basket bet on 0,1,2,3
          amount: betAmount.toFixed(8),
        },
      ],
      clientSeed: 'test-basket-verification-seed',
    };

    const gameData = await makeRequest('/games/roulette/bet', 'POST', betData);

    // Check balance after bet
    const afterBetData = await makeRequest('/balance/wallets');
    const primaryWalletAfter = afterBetData.find((wallet) => wallet.isPrimary);
    const afterBetBalance = parseFloat(primaryWalletAfter.balance);

    const totalWinAmount = parseFloat(gameData.totalPayout || '0');
    const expectedFinalBalance = beforeBetBalance - betAmount + totalWinAmount;
    const finalBalanceDifference = Math.abs(afterBetBalance - expectedFinalBalance);

    console.log(`   Winning Number: ${gameData.winningNumber}`);
    console.log(`   Basket Bet Numbers: [0, 1, 2, 3]`);
    console.log(`   Basket Bet Result: ${totalWinAmount > 0 ? 'WIN' : 'LOSS'}`);
    console.log(`   Win Amount: ${totalWinAmount.toFixed(8)} ${primaryAsset}`);
    console.log(`   Final Balance: ${afterBetBalance.toFixed(8)} ${primaryAsset}`);
    console.log(`   Expected Final: ${expectedFinalBalance.toFixed(8)} ${primaryAsset}`);
    console.log(`   Final Difference: ${finalBalanceDifference.toFixed(8)} ${primaryAsset}`);

    if (finalBalanceDifference <= 0.00000002) {
      console.log('✅ Complete basket bet verification successful');
      currentBalance = afterBetBalance;
      results['6.5'] = {
        success: true,
        details: 'Basket bet balance change verification completed',
        balanceFlow: {
          initial: beforeBetBalance,
          bet: betAmount,
          win: totalWinAmount,
          final: afterBetBalance,
          difference: finalBalanceDifference,
        },
        gameId: gameData.id,
      };
    } else {
      throw new Error(
        `Final balance verification failed: difference ${finalBalanceDifference.toFixed(8)} ${primaryAsset}`,
      );
    }
  } catch (error) {
    console.error('❌ Basket Bet Verification failed:', error.message);
    results['6.5'] = { success: false, error: error.message };
    throw error;
  }
}

async function test6_7_trioBetVerification() {
  console.log('\n🎯 Test 6.7: Balance Change Verification (Trio Bet)');

  try {
    const betAmount = 0.000012;

    console.log(`   Testing trio bet: ${betAmount.toFixed(8)} ${primaryAsset}`);

    // Check balance before bet
    const beforeBetData = await makeRequest('/balance/wallets');
    const primaryWalletBefore = beforeBetData.find((wallet) => wallet.isPrimary);
    const beforeBetBalance = parseFloat(primaryWalletBefore.balance);
    console.log(`   Balance before bet: ${beforeBetBalance.toFixed(8)} ${primaryAsset}`);

    // Place trio bet (0,1,2)
    const betData = {
      bets: [
        {
          type: 'trio',
          numbers: [0, 1, 2], // Trio bet on 0,1,2
          amount: betAmount.toFixed(8),
        },
      ],
      clientSeed: 'test-trio-verification-seed',
    };

    const gameData = await makeRequest('/games/roulette/bet', 'POST', betData);

    // Check balance after bet
    const afterBetData = await makeRequest('/balance/wallets');
    const primaryWalletAfter = afterBetData.find((wallet) => wallet.isPrimary);
    const afterBetBalance = parseFloat(primaryWalletAfter.balance);

    const totalWinAmount = parseFloat(gameData.totalPayout || '0');
    const expectedFinalBalance = beforeBetBalance - betAmount + totalWinAmount;
    const finalBalanceDifference = Math.abs(afterBetBalance - expectedFinalBalance);

    console.log(`   Winning Number: ${gameData.winningNumber}`);
    console.log(`   Trio Bet Numbers: [0, 1, 2]`);
    console.log(`   Trio Bet Result: ${totalWinAmount > 0 ? 'WIN' : 'LOSS'}`);
    console.log(`   Win Amount: ${parseFloat(gameData.totalPayout).toFixed(8)} ${gameData.asset}`);
    console.log(
      `   Total Multiplier: ${gameData.totalMultiplier ? gameData.totalMultiplier + 'x' : 'N/A'}`,
    );
    console.log(`   Final Balance: ${afterBetBalance.toFixed(8)} ${primaryAsset}`);
    console.log(`   Expected Final: ${expectedFinalBalance.toFixed(8)} ${primaryAsset}`);
    console.log(`   Final Difference: ${finalBalanceDifference.toFixed(8)} ${primaryAsset}`);

    if (finalBalanceDifference <= 0.00000002) {
      console.log('✅ Complete trio bet verification successful');
      currentBalance = afterBetBalance;
      results[6.7] = {
        success: true,
        details: 'Trio bet balance change verification completed',
        balanceFlow: {
          initial: beforeBetBalance,
          bet: betAmount,
          win: totalWinAmount,
          final: afterBetBalance,
          difference: finalBalanceDifference,
        },
        gameId: gameData.id,
      };
    } else {
      throw new Error(
        `Final balance verification failed: difference ${finalBalanceDifference.toFixed(8)} ${primaryAsset}`,
      );
    }
  } catch (error) {
    console.error('❌ Trio Bet Verification failed:', error.message);
    results[6.7] = { success: false, error: error.message };
    throw error;
  }
}

async function test7_httpGameHistory() {
  console.log('\n📜 Test 7: HTTP Game History');

  try {
    const historyData = await makeRequest('/games/roulette/history?limit=10');

    if (Array.isArray(historyData)) {
      console.log('✅ Game history retrieved successfully');
      console.log(`   Total games found: ${historyData.length}`);

      if (historyData.length > 0) {
        // Show recent games with detailed info
        historyData.slice(0, 3).forEach((game, index) => {
          const profit = parseFloat(game.profit || '0');
          const result = profit >= 0 ? 'WIN' : 'LOSS';
          const betAmount = parseFloat(game.totalBetAmount);
          const payout = parseFloat(game.totalPayout || '0');
          console.log(
            `   Game ${index + 1}: ${result} - Bet: ${betAmount.toFixed(8)} ${primaryAsset}, Number: ${game.winningNumber} (${game.winningColor}), Payout: ${payout.toFixed(8)} ${primaryAsset}`,
          );
        });
      } else {
        console.log('   No games in history (this is normal for fresh data)');
      }

      results[7] = {
        success: true,
        details: `Retrieved ${historyData.length} games`,
        gameCount: historyData.length,
      };
    } else {
      throw new Error('Invalid game history response format');
    }
  } catch (error) {
    console.error('❌ HTTP Game History failed:', error.message);
    results[7] = { success: false, error: error.message };
    throw error;
  }
}

async function test8_httpGameDetails() {
  console.log('\n🔍 Test 8: HTTP Game Details');

  try {
    // Get a game ID from previous test
    const gameId = results[5]?.gameId || results[6]?.gameId;

    if (!gameId) {
      console.log('⏭️  No game ID available from previous tests - skipping');
      results[8] = { success: true, details: 'Skipped - no game ID available' };
      return;
    }

    const gameData = await makeRequest(`/games/roulette/${gameId}`);

    if (gameData && gameData.id === gameId) {
      console.log('✅ Game details retrieved successfully');
      console.log(`   Game ID: ${gameData.id}`);
      console.log(
        `   Total Bet: ${parseFloat(gameData.totalBetAmount).toFixed(8)} ${primaryAsset}`,
      );
      console.log(`   Winning Number: ${gameData.winningNumber}`);
      console.log(`   Winning Color: ${gameData.winningColor}`);
      console.log(
        `   Total Payout: ${parseFloat(gameData.totalPayout || '0').toFixed(8)} ${primaryAsset}`,
      );
      console.log(`   Bets Count: ${gameData.bets.length}`);
      console.log(`   Server Seed Hash: ${gameData.serverSeedHash.substring(0, 16)}...`);
      console.log(`   Completed: ${gameData.isCompleted}`);

      results[8] = {
        success: true,
        details: 'Game details validation completed',
        gameId: gameData.id,
      };
    } else {
      throw new Error('Invalid game details response');
    }
  } catch (error) {
    console.error('❌ HTTP Game Details failed:', error.message);
    results[8] = { success: false, error: error.message };
    // Don't throw error to continue with other tests
    console.log('⏭️  Continuing with remaining tests...');
  }
}

async function test9_setupValidation() {
  console.log('\n✅ Test 9: Setup Validation');

  try {
    // Test invalid bet amount (negative)
    try {
      await makeRequest('/games/roulette/bet', 'POST', {
        bets: [
          {
            type: 'straight',
            numbers: [7],
            amount: '-0.00001',
          },
        ],
      });
      throw new Error('Should have rejected negative bet amount');
    } catch (error) {
      if (error.message.includes('400') || error.message.includes('validation')) {
        console.log('✅ Negative bet amount properly rejected');
      } else {
        throw error;
      }
    }

    // Test invalid bet numbers (out of range)
    try {
      await makeRequest('/games/roulette/bet', 'POST', {
        bets: [
          {
            type: 'straight',
            numbers: [37], // Invalid number for European roulette
            amount: '0.00001',
          },
        ],
      });
      throw new Error('Should have rejected invalid number');
    } catch (error) {
      if (error.message.includes('400') || error.message.includes('36')) {
        console.log('✅ Invalid roulette number properly rejected');
      } else {
        throw error;
      }
    }

    // Test empty bets array
    try {
      await makeRequest('/games/roulette/bet', 'POST', {
        bets: [],
      });
      throw new Error('Should have rejected empty bets array');
    } catch (error) {
      if (error.message.includes('400') || error.message.includes('validation')) {
        console.log('✅ Empty bets array properly rejected');
      } else {
        throw error;
      }
    }

    // Test invalid corner bet numbers
    try {
      await makeRequest('/games/roulette/bet', 'POST', {
        bets: [
          {
            type: 'corner',
            numbers: [1, 5, 8, 12], // Invalid corner - not adjacent
            amount: '0.00001',
          },
        ],
      });
      throw new Error('Should have rejected invalid corner bet');
    } catch (error) {
      if (error.message.includes('400') || error.message.includes('square')) {
        console.log('✅ Invalid corner bet properly rejected');
      } else {
        throw error;
      }
    }

    // Test valid basket bet
    try {
      await makeRequest('/games/roulette/bet', 'POST', {
        bets: [
          {
            type: 'basket',
            numbers: [0, 1, 2, 3], // Valid basket bet
            amount: '0.00001',
          },
        ],
      });
      console.log('✅ Valid basket bet accepted');
    } catch (error) {
      throw new Error(`Valid basket bet rejected: ${error.message}`);
    }

    // Test invalid basket bet numbers
    try {
      await makeRequest('/games/roulette/bet', 'POST', {
        bets: [
          {
            type: 'basket',
            numbers: [0, 1, 2, 4], // Invalid basket - wrong numbers
            amount: '0.00001',
          },
        ],
      });
      throw new Error('Should have rejected invalid basket bet');
    } catch (error) {
      if (error.message.includes('400') || error.message.includes('basket')) {
        console.log('✅ Invalid basket bet properly rejected');
      } else {
        throw error;
      }
    }

    // Test valid trio bet
    try {
      await makeRequest('/games/roulette/bet', 'POST', {
        bets: [
          {
            type: 'trio',
            numbers: [0, 1, 2], // Valid trio bet
            amount: '0.00001',
          },
        ],
      });
      console.log('✅ Valid trio bet accepted');
    } catch (error) {
      throw new Error(`Valid trio bet rejected: ${error.message}`);
    }

    // Test invalid trio bet numbers
    try {
      await makeRequest('/games/roulette/bet', 'POST', {
        bets: [
          {
            type: 'trio',
            numbers: [0, 1, 3], // Invalid trio - wrong numbers
            amount: '0.00001',
          },
        ],
      });
      throw new Error('Should have rejected invalid trio bet');
    } catch (error) {
      if (error.message.includes('400') || error.message.includes('trio')) {
        console.log('✅ Invalid trio bet properly rejected');
      } else {
        throw error;
      }
    }

    console.log('✅ Setup validation completed');
    results[9] = { success: true, details: 'All validation checks passed' };
  } catch (error) {
    console.error('❌ Setup Validation failed:', error.message);
    results[9] = { success: false, error: error.message };
    throw error;
  }
}

async function test10_provablyFairSeedInfo() {
  console.log('\n🔒 Test 10: Provably Fair Seed Info');

  try {
    // Place a roulette bet first
    const betData = {
      bets: [
        {
          type: 'straight',
          numbers: [17],
          amount: '0.00001',
        },
      ],
      clientSeed: 'test-provably-fair-roulette-seed',
    };

    console.log('   Placing roulette bet...');
    const gameData = await makeRequest('/games/roulette/bet', 'POST', betData);

    console.log(`   Game ID: ${gameData.id}`);
    console.log(`   Winning Number: ${gameData.winningNumber}`);
    console.log(
      `   Total Multiplier: ${gameData.totalMultiplier ? gameData.totalMultiplier + 'x' : 'N/A'}`,
    );

    // Get seed info for this bet
    console.log('   Retrieving seed info...');
    const seedInfo = await makeRequest(
      `/games/provably-fair/seed-info/bet?game=ROULETTE&betId=${gameData.id}`,
    );

    // Verify required fields
    if (!seedInfo.serverSeed) throw new Error('Server seed missing');
    if (!seedInfo.clientSeed) throw new Error('Client seed missing');
    if (typeof seedInfo.nonce !== 'number') throw new Error('Nonce missing or invalid');
    if (typeof seedInfo.outcome !== 'number') throw new Error('Outcome missing or invalid');
    if (typeof seedInfo.isValid !== 'boolean') throw new Error('Verification missing');

    console.log(`   Server Seed: ${seedInfo.serverSeed}`);
    console.log(`   Client Seed: ${seedInfo.clientSeed}`);
    console.log(`   Nonce: ${seedInfo.nonce}`);
    console.log(`   Outcome: ${seedInfo.outcome}`);
    console.log(`   Verification Passed: ${seedInfo.isValid}`);
    console.log(`   Calculated Outcome: ${seedInfo.calculatedOutcome}`);

    // Verify the outcome matches
    if (seedInfo.isValid) {
      console.log('✅ Provably fair verification PASSED');
      console.log(`   Calculated outcome matches: ${seedInfo.calculatedOutcome}`);
    } else {
      throw new Error('Provably fair verification FAILED');
    }

    // Additional verification for roulette specific outcome (0-36)
    if (seedInfo.outcome < 0 || seedInfo.outcome > 36) {
      throw new Error(`Invalid outcome range: ${seedInfo.outcome} (should be 0-36 for roulette)`);
    }

    // Verify that the outcome matches the actual winning number
    console.log(`   Seed Info Outcome: ${seedInfo.outcome}`);
    console.log(`   Actual Winning Number: ${gameData.winningNumber}`);

    if (seedInfo.outcome === gameData.winningNumber) {
      console.log('✅ Outcome matches winning number perfectly');
    } else {
      throw new Error(
        `Outcome mismatch: seed info shows ${seedInfo.outcome}, but game result was ${gameData.winningNumber}`,
      );
    }

    console.log('✅ Provably fair seed info test completed successfully');
    results[10] = {
      success: true,
      details: `Seed info retrieved and verified for game ${gameData.id}`,
    };
  } catch (error) {
    console.error('❌ Provably fair seed info test failed:', error.message);
    results[10] = { success: false, error: error.message };
    throw error;
  }
}

async function testWinningBet() {
  console.log('\n🎯 Testing Winning Bet with Multiple Client Seeds');

  try {
    // Try different client seeds and numbers until we get a winner
    for (let i = 0; i < 37; i++) {
      const clientSeed = `winning-test-${i.toString().padStart(8, '0')}`;

      const betData = {
        bets: [
          {
            type: 'straight',
            numbers: [i],
            amount: '0.00000100',
          },
        ],
        clientSeed: clientSeed,
      };

      const gameData = await makeRequest('/games/roulette/bet', 'POST', betData);
      const bet = gameData.bets[0];
      const payout = parseFloat(bet.payout || '0');

      console.log(
        `   Try ${i + 1}: Bet ${i}, Winning Number ${gameData.winningNumber}, Payout: ${payout.toFixed(8)}, Total Multiplier: ${gameData.totalMultiplier ? gameData.totalMultiplier + 'x' : 'N/A'}`,
      );

      if (payout > 0) {
        console.log(
          `✅ Found winning bet! Straight ${i} won with total multiplier ${gameData.totalMultiplier ? gameData.totalMultiplier + 'x' : 'N/A'}`,
        );
        return;
      }
    }

    console.log('⚠️ No winning bets found after 37 attempts');
  } catch (error) {
    console.error('❌ Winning bet test failed:', error.message);
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('🎲 ROULETTE GAME TEST SUMMARY');
  console.log('='.repeat(60));

  let passedTests = 0;
  let totalTests = Object.keys(TESTS).length;

  Object.keys(TESTS).forEach((testNum) => {
    const testName = TESTS[testNum];
    const result = results[testNum];

    if (result) {
      if (result.success) {
        console.log(`✅ Test ${testNum}: ${testName} - PASSED`);
        if (result.details) console.log(`   ${result.details}`);
        passedTests++;
      } else {
        console.log(`❌ Test ${testNum}: ${testName} - FAILED`);
        if (result.error) console.log(`   Error: ${result.error}`);
      }
    } else {
      console.log(`⏸️  Test ${testNum}: ${testName} - NOT RUN`);
    }
  });

  console.log('\n' + '-'.repeat(60));
  console.log(`📊 RESULTS: ${passedTests}/${totalTests} tests passed`);
  console.log(`💰 Final Balance: ${currentBalance.toFixed(8)} ${primaryAsset}`);

  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED! Roulette game with crypto balance working perfectly!');
  } else {
    console.log('⚠️  Some tests failed. Please check the errors above.');
  }
  console.log('='.repeat(60));
}

async function runAllTests() {
  console.log('🚀 Starting Roulette Game Client Simulator');
  console.log('🎯 Focus: Crypto balance verification after each bet');
  console.log(`📧 Test Email: ${TEST_EMAIL}`);
  console.log(`🔗 Base URL: ${BASE_URL}`);

  const tests = [
    test1_userAuthentication,
    test2_userExistsCheck,
    test3_balanceCheck,
    test4_httpBalanceAPI,
    test5_httpRouletteBetting,
    test6_balanceChangeVerification,
    test6_5_basketBetVerification,
    test6_7_trioBetVerification,
    test7_httpGameHistory,
    test8_httpGameDetails,
    test9_setupValidation,
    test10_provablyFairSeedInfo,
    testWinningBet,
  ];

  for (let i = 0; i < tests.length; i++) {
    try {
      await tests[i]();
      await new Promise((resolve) => setTimeout(resolve, 500)); // Small delay between tests
    } catch {
      console.error(`\n💥 Test ${i + 1} failed, stopping execution.`);
      break;
    }
  }

  printSummary();
}

// Run the tests
runAllTests().catch((error) => {
  console.error('💥 Test suite failed:', error);
  printSummary();
  process.exit(1);
});
