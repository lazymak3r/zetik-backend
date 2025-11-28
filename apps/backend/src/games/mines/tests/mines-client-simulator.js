/* eslint-disable @typescript-eslint/no-require-imports */
const { randomUUID: uuidv4 } = require('crypto');

// Configuration from environment variables
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000/v1';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'TestPassword123';
const TEST_BET_AMOUNT = parseFloat(process.env.TEST_BET_AMOUNT || '0.00001'); // Crypto amount
const TEST_MINES_COUNT = parseInt(process.env.TEST_MINES_COUNT || '3');

// Test configuration
const REQUIRED_BALANCE_MULTIPLIER = 5; // Need 5x bet amount for safety
const BALANCE_TOLERANCE = 0.00000001; // Crypto precision tolerance for balance verification

let authToken = null;

// Utility functions
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function logSuccess(message, data = null) {
  log(`✅ ${message}`, data);
}

function logError(message, error = null) {
  log(`❌ ${message}`, error);
}

function logInfo(message, data = null) {
  log(`ℹ️  ${message}`, data);
}

// Helper function for POST requests
async function fetchPost(url, data, headers = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(data),
  });

  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${responseData.message || 'Request failed'}`);
  }

  return { success: true, data: responseData };
}

// Helper function for GET requests
async function fetchGet(url, headers = {}) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${responseData.message || 'Request failed'}`);
  }

  return { success: true, data: responseData };
}

// API helper functions
async function makeRequest(method, endpoint, data = null, headers = {}) {
  try {
    const url = `${BASE_URL}${endpoint}`;
    const requestHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (authToken) {
      requestHeaders.Authorization = `Bearer ${authToken}`;
    }

    let response;
    if (method === 'GET') {
      response = await fetchGet(url, requestHeaders);
    } else {
      response = await fetchPost(url, data, requestHeaders);
    }

    return response;
  } catch (error) {
    return {
      success: false,
      error: error.message,
      status: error.status,
    };
  }
}

// Helper function to clear active games
async function clearActiveGames() {
  const activeGameResult = await makeRequest('GET', '/games/mines/active');
  if (activeGameResult.success && activeGameResult.data) {
    const activeGame = activeGameResult.data;

    // If game has no revealed tiles, try to reveal one first
    if (activeGame.revealedTiles.length === 0) {
      const revealResult = await makeRequest('POST', '/games/mines/reveal', {
        gameId: activeGame.id,
        tilePosition: 0, // Try position 0
      });

      if (revealResult.success) {
        // If we hit a mine, game is already busted
        if (revealResult.data.status === 'BUSTED') {
          logInfo(`Cleared active game by hitting mine: ${activeGame.id}`);
          return;
        }
        // If safe, try to cashout
        const cashoutResult = await makeRequest('POST', '/games/mines/cashout', {
          gameId: activeGame.id,
        });
        if (cashoutResult.success) {
          logInfo(`Cleared active game by cashout: ${activeGame.id}`);
          return;
        }
      }
    } else {
      // Game already has revealed tiles, try direct cashout
      const cashoutResult = await makeRequest('POST', '/games/mines/cashout', {
        gameId: activeGame.id,
      });
      if (cashoutResult.success) {
        logInfo(`Cleared active game by cashout: ${activeGame.id}`);
        return;
      }
    }

    logInfo(`Could not clear active game: ${activeGame.id}`);

    // Wait a bit to ensure transaction is completed
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

// Test functions
async function testUserAuthentication() {
  logInfo('Testing user authentication...');

  const result = await makeRequest('POST', '/auth/login/email', {
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });

  if (!result.success) {
    logError('Authentication failed', result.error);
    return false;
  }

  authToken = result.data.accessToken;
  logSuccess('User authenticated successfully');
  return true;
}

async function testUserExists() {
  logInfo('Checking if test user exists...');

  const result = await makeRequest('GET', '/users/profile');

  if (!result.success) {
    logError('Failed to get user profile', result.error);
    return false;
  }

  if (result.data.email !== TEST_USER_EMAIL) {
    logError(`User email mismatch. Expected: ${TEST_USER_EMAIL}, Got: ${result.data.email}`);
    return false;
  }

  logSuccess(`Test user exists: ${result.data.email}`);
  return true;
}

async function testBalanceCheck() {
  logInfo('Checking user crypto balance...');

  const result = await makeRequest('GET', '/balance/wallets');

  if (!result.success) {
    logError('Failed to get crypto balance', result.error);
    return false;
  }

  // Find the primary wallet and check balance
  const primaryWallet = result.data.find((wallet) => wallet.isPrimary);
  if (!primaryWallet) {
    logError('No primary wallet found');
    return false;
  }

  const balance = parseFloat(primaryWallet.balance);
  const requiredBalance = TEST_BET_AMOUNT * REQUIRED_BALANCE_MULTIPLIER;

  if (balance < requiredBalance) {
    logError(
      `Insufficient balance. Required: ${requiredBalance} ${primaryWallet.asset}, Available: ${balance} ${primaryWallet.asset}`,
    );
    return false;
  }

  logSuccess(
    `Balance check passed: ${balance} ${primaryWallet.asset} (required: ${requiredBalance} ${primaryWallet.asset})`,
  );
  return true;
}

async function testHttpBalanceApi() {
  logInfo('Testing HTTP Crypto Balance API...');

  const result = await makeRequest('GET', '/balance/wallets');

  if (!result.success) {
    logError('HTTP Crypto Balance API failed', result.error);
    return false;
  }

  if (!result.data || !Array.isArray(result.data)) {
    logError('Invalid balance format', result.data);
    return false;
  }

  const primaryWallet = result.data.find((wallet) => wallet.isPrimary);
  if (!primaryWallet) {
    logError('No primary wallet found');
    return false;
  }

  const balance = parseFloat(primaryWallet.balance);
  logSuccess(`HTTP Crypto Balance API working: ${balance} ${primaryWallet.asset}`);
  return true;
}

async function testHttpMinesBetting() {
  logInfo('Testing HTTP Mines Betting API with crypto...');

  // Clear any existing active games first
  await clearActiveGames();

  // Get balance before bet
  const balanceBeforeResult = await makeRequest('GET', '/balance/wallets');
  if (!balanceBeforeResult.success) {
    logError('Failed to get balance before bet', balanceBeforeResult.error);
    return false;
  }

  const primaryWallet = balanceBeforeResult.data.find((wallet) => wallet.isPrimary);
  if (!primaryWallet) {
    logError('No primary wallet found');
    return false;
  }

  const balanceBefore = parseFloat(primaryWallet.balance);

  // Place mines bet
  const betData = {
    betAmount: TEST_BET_AMOUNT,
    minesCount: TEST_MINES_COUNT,
    gameSessionId: uuidv4(),
    clientSeed: `test-client-seed-${Date.now()}`,
  };

  const betResult = await makeRequest('POST', '/games/mines/start', betData);

  if (!betResult.success) {
    logError('Mines betting failed', betResult.error);
    return false;
  }

  const gameData = betResult.data;
  logSuccess('Mines bet placed successfully', {
    gameId: gameData.id,
    betAmount: gameData.betAmount,
    asset: gameData.asset,
    minesCount: gameData.minesCount,
    status: gameData.status,
  });

  // Get balance after bet
  const balanceAfterResult = await makeRequest('GET', '/balance/wallets');
  if (!balanceAfterResult.success) {
    logError('Failed to get balance after bet', balanceAfterResult.error);
    return false;
  }

  const primaryWalletAfter = balanceAfterResult.data.find((wallet) => wallet.isPrimary);
  if (!primaryWalletAfter) {
    logError('No primary wallet found after bet');
    return false;
  }

  const balanceAfter = parseFloat(primaryWalletAfter.balance);

  // Verify balance decreased by bet amount
  const expectedBalance = balanceBefore - TEST_BET_AMOUNT;
  const balanceDifference = Math.abs(balanceAfter - expectedBalance);

  if (balanceDifference > BALANCE_TOLERANCE) {
    logError(
      `Balance verification failed. Before: ${balanceBefore} ${primaryWallet.asset}, After: ${balanceAfter} ${primaryWalletAfter.asset}, Expected: ${expectedBalance} ${primaryWallet.asset}, Difference: ${balanceDifference} ${primaryWallet.asset}`,
    );
    return false;
  }

  logSuccess(
    `Balance correctly decreased by bet amount: ${balanceBefore} ${primaryWallet.asset} → ${balanceAfter} ${primaryWalletAfter.asset}`,
  );

  // Try to reveal a safe tile (position 0, hoping it's safe)
  const revealResult = await makeRequest('POST', '/games/mines/reveal', {
    gameId: gameData.id,
    tilePosition: 0,
  });

  let winAmount = 0;

  if (revealResult.success) {
    if (revealResult.data.status === 'BUSTED') {
      logInfo('Hit a mine on first reveal - game ended');
      winAmount = 0;
    } else if (revealResult.data.status === 'ACTIVE') {
      logInfo('Successfully revealed safe tile');

      // Try to cashout to complete the game
      const cashoutResult = await makeRequest('POST', '/games/mines/cashout', {
        gameId: gameData.id,
      });

      if (cashoutResult.success) {
        winAmount = parseFloat(cashoutResult.data.finalPayout || 0);
        logSuccess(`Successfully cashed out: ${winAmount} ${primaryWallet.asset}`);
      } else {
        logError('Failed to cashout', cashoutResult.error);
        return false;
      }
    }
  } else {
    logError('Failed to reveal tile', revealResult.error);
    return false;
  }

  logSuccess('HTTP Mines Betting test completed successfully');
  return true;
}

async function testBalanceChangeVerification() {
  logInfo('Testing Balance Change Verification...');

  // Clear any existing active games first
  await clearActiveGames();

  // Get balance before test
  const balanceBeforeResult = await makeRequest('GET', '/balance/wallets');
  if (!balanceBeforeResult.success) {
    logError('Failed to get balance before test', balanceBeforeResult.error);
    return false;
  }

  const primaryWallet = balanceBeforeResult.data.find((wallet) => wallet.isPrimary);
  if (!primaryWallet) {
    logError('No primary wallet found');
    return false;
  }

  const balanceBefore = parseFloat(primaryWallet.balance);

  // Place mines bet
  const betData = {
    betAmount: TEST_BET_AMOUNT,
    minesCount: 1, // Use 1 mine for higher win chance
    gameSessionId: uuidv4(),
    clientSeed: `balance-verification-${Date.now()}`,
  };

  const betResult = await makeRequest('POST', '/games/mines/start', betData);

  if (!betResult.success) {
    logError('Failed to place bet for balance verification', betResult.error);
    return false;
  }

  const gameData = betResult.data;

  // Reveal a few tiles
  const tilesToReveal = [0, 1, 2];
  let gameState = gameData;

  for (const tilePosition of tilesToReveal) {
    if (gameState.status !== 'ACTIVE') {
      break; // Game ended
    }

    const revealResult = await makeRequest('POST', '/games/mines/reveal', {
      gameId: gameState.id,
      tilePosition,
    });

    if (!revealResult.success) {
      logError(`Failed to reveal tile ${tilePosition}`, revealResult.error);
      return false;
    }

    gameState = revealResult.data;

    if (gameState.status === 'BUSTED') {
      logInfo(`Hit mine at position ${tilePosition}`);
      break;
    }
  }

  // If game is still active, cashout
  if (gameState.status === 'ACTIVE') {
    const cashoutResult = await makeRequest('POST', '/games/mines/cashout', {
      gameId: gameState.id,
    });

    if (cashoutResult.success) {
      gameState = cashoutResult.data;
      logInfo('Successfully cashed out');
    } else {
      logError('Failed to cashout', cashoutResult.error);
      return false;
    }
  }

  // Get balance after game
  const balanceAfterResult = await makeRequest('GET', '/balance/wallets');
  if (!balanceAfterResult.success) {
    logError('Failed to get balance after game', balanceAfterResult.error);
    return false;
  }

  const primaryWalletAfter = balanceAfterResult.data.find((wallet) => wallet.isPrimary);
  if (!primaryWalletAfter) {
    logError('No primary wallet found after game');
    return false;
  }

  const balanceAfter = parseFloat(primaryWalletAfter.balance);
  const balanceChange = balanceAfter - balanceBefore;

  // Calculate expected balance change
  const finalPayout = parseFloat(gameState.finalPayout || 0);
  const expectedChange = finalPayout - TEST_BET_AMOUNT;

  const changeDifference = Math.abs(balanceChange - expectedChange);

  if (changeDifference > BALANCE_TOLERANCE) {
    logError(
      `Balance change verification failed. Expected: ${expectedChange}, Actual: ${balanceChange}, Difference: ${changeDifference}`,
    );
    return false;
  }

  logSuccess('Balance change verification passed', {
    balanceBefore,
    balanceAfter,
    balanceChange,
    finalPayout,
    gameStatus: gameState.status,
  });

  return true;
}

async function testHttpGameHistory() {
  logInfo('Testing HTTP Game History...');

  const result = await makeRequest('GET', '/games/mines/history?limit=5');

  if (!result.success) {
    logError('Game history request failed', result.error);
    return false;
  }

  if (!Array.isArray(result.data)) {
    logError('Game history should return an array', result.data);
    return false;
  }

  logSuccess(`Game history retrieved: ${result.data.length} games`);

  // Verify game data structure
  if (result.data.length > 0) {
    const game = result.data[0];
    const requiredFields = ['id', 'betAmount', 'minesCount', 'status', 'createdAt'];

    for (const field of requiredFields) {
      if (!(field in game)) {
        logError(`Game history missing required field: ${field}`, game);
        return false;
      }
    }

    logSuccess('Game history data structure verified');
  }

  return true;
}

async function testHttpGameDetails() {
  logInfo('Testing HTTP Game Details...');

  // First get a game ID from history
  const historyResult = await makeRequest('GET', '/games/mines/history?limit=1');

  if (!historyResult.success || !historyResult.data.length) {
    logInfo('No games in history to test details - skipping test');
    return true;
  }

  const gameId = historyResult.data[0].id;
  const detailsResult = await makeRequest('GET', `/games/mines/details/${gameId}`);

  if (!detailsResult.success) {
    logError('Game details request failed', detailsResult.error);
    return false;
  }

  const gameDetails = detailsResult.data;
  const requiredFields = ['id', 'betAmount', 'minesCount', 'status', 'createdAt'];

  for (const field of requiredFields) {
    if (!(field in gameDetails)) {
      logError(`Game details missing required field: ${field}`, gameDetails);
      return false;
    }
  }

  logSuccess('Game details retrieved successfully', {
    gameId: gameDetails.id,
    status: gameDetails.status,
    betAmount: gameDetails.betAmount,
  });

  return true;
}

async function testAutoplayBetting1() {
  logInfo('Testing autoplay functionality (Test 1)...');

  await clearActiveGames();

  const autoplayTilePositions = [0, 1, 5, 6, 10];
  const gameSessionId = uuidv4();

  const result = await makeRequest('POST', '/games/mines/autoplay', {
    betAmount: 0.001,
    minesCount: 3,
    tilePositions: autoplayTilePositions,
    gameSessionId,
  });

  if (!result.success) {
    logError('Autoplay test 1 failed', result.error);
    return false;
  }

  if (!result.data.id) {
    logError('Autoplay test 1: No game ID returned', result.data);
    return false;
  }

  logSuccess('Autoplay test 1 completed', {
    gameId: result.data.id,
    status: result.data.status,
    finalPayout: result.data.finalPayout || 'N/A',
  });

  return true;
}

async function testAutoplayBetting2() {
  logInfo('Testing autoplay functionality (Test 2)...');

  await clearActiveGames();

  const autoplayTilePositions = [0, 1, 5, 6, 10];
  const gameSessionId = uuidv4();

  const result = await makeRequest('POST', '/games/mines/autoplay', {
    betAmount: 0.002,
    minesCount: 5,
    tilePositions: autoplayTilePositions,
    gameSessionId,
  });

  if (!result.success) {
    logError('Autoplay test 2 failed', result.error);
    return false;
  }

  if (!result.data.id) {
    logError('Autoplay test 2: No game ID returned', result.data);
    return false;
  }

  logSuccess('Autoplay test 2 completed', {
    gameId: result.data.id,
    status: result.data.status,
    finalPayout: result.data.finalPayout || 'N/A',
  });

  return true;
}

async function testAutoplayBetting3() {
  logInfo('Testing autoplay functionality (Test 3)...');

  await clearActiveGames();

  const autoplayTilePositions = [0, 1, 5, 6, 10];
  const gameSessionId = uuidv4();

  const result = await makeRequest('POST', '/games/mines/autoplay', {
    betAmount: 0.0005,
    minesCount: 2,
    tilePositions: autoplayTilePositions,
    gameSessionId,
  });

  if (!result.success) {
    logError('Autoplay test 3 failed', result.error);
    return false;
  }

  if (!result.data.id) {
    logError('Autoplay test 3: No game ID returned', result.data);
    return false;
  }

  logSuccess('Autoplay test 3 completed', {
    gameId: result.data.id,
    status: result.data.status,
    finalPayout: result.data.finalPayout || 'N/A',
  });

  return true;
}

async function testAutoplayTileRevealFix() {
  logInfo('Testing autoplay tile reveal fix - all selected tiles should be revealed...');

  await clearActiveGames();

  // Select more tiles for better demonstration
  const autoplayTilePositions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const gameSessionId = uuidv4();

  logInfo(`Selected tiles for autoplay: [${autoplayTilePositions.join(', ')}]`);

  const result = await makeRequest('POST', '/games/mines/autoplay', {
    betAmount: 0.001,
    minesCount: 5, // More mines to increase hit chance
    tilePositions: autoplayTilePositions,
    gameSessionId,
  });

  if (!result.success) {
    logError('Autoplay tile reveal fix test failed', result.error);
    return false;
  }

  logInfo('Autoplay response:', {
    gameId: result.data.id,
    status: result.data.status,
    finalPayout: result.data.finalPayout || 'N/A',
    selectedTiles: autoplayTilePositions,
    revealedTiles: result.data.revealedTiles,
    revealedCount: result.data.revealedTiles?.length || 0,
    expectedCount: autoplayTilePositions.length,
  });

  // Check that all selected tiles were revealed
  if (
    result.data.revealedTiles &&
    result.data.revealedTiles.length === autoplayTilePositions.length
  ) {
    logSuccess('✅ FIX VERIFIED: All selected tiles were revealed!', {
      selectedTiles: autoplayTilePositions,
      revealedTiles: result.data.revealedTiles,
      status: result.data.status,
    });

    // Additionally check that all selected tiles are present in revealed
    const allTilesRevealed = autoplayTilePositions.every((tile) =>
      result.data.revealedTiles.includes(tile),
    );

    if (allTilesRevealed) {
      logSuccess('✅ All selected tiles are present in revealed tiles array');
    } else {
      logError('❌ Some selected tiles are missing from revealed tiles');
      return false;
    }
  } else {
    logError('❌ Not all selected tiles were revealed', {
      expected: autoplayTilePositions.length,
      actual: result.data.revealedTiles?.length || 0,
      missing: autoplayTilePositions.length - (result.data.revealedTiles?.length || 0),
    });
    return false;
  }

  return true;
}

async function testProvablyFairSeedInfo() {
  logInfo('Testing Provably Fair Seed Info Endpoint for Mines...');

  await clearActiveGames();

  try {
    const gameSessionId = uuidv4();
    const clientSeed = 'test-mines-seed-info-verification';

    // Start a mines game
    const startResult = await makeRequest('POST', '/games/mines/start', {
      betAmount: TEST_BET_AMOUNT,
      minesCount: TEST_MINES_COUNT,
      gameSessionId,
      clientSeed,
    });

    if (!startResult.success) {
      logError('Failed to start mines game for seed info test', startResult.error);
      return false;
    }

    const gameId = startResult.data.id;
    logInfo(`Started mines game: ${gameId}`);

    // Reveal at least one tile
    const revealResult = await makeRequest('POST', '/games/mines/reveal', {
      gameId,
      tilePosition: 0,
    });

    if (!revealResult.success) {
      logError('Failed to reveal tile for seed info test', revealResult.error);
      return false;
    }

    logInfo(`Revealed tile at position 0, result: ${revealResult.data.tileResult}`);

    // Finish the game (cashout if safe, or it's already finished if hit mine)
    let finalGameData = revealResult.data;

    if (finalGameData.status === 'ACTIVE') {
      // Game is still active, let's cash out
      const cashoutResult = await makeRequest('POST', '/games/mines/cashout', {
        gameId,
      });

      if (!cashoutResult.success) {
        logError('Failed to cashout for seed info test', cashoutResult.error);
        return false;
      }

      finalGameData = cashoutResult.data;
      logInfo(`Cashed out game, final payout: ${finalGameData.finalPayout}`);
    } else {
      logInfo(`Game finished with status: ${finalGameData.status}`);
    }

    // Wait a moment for the game to be processed
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Test the seed info endpoint
    const seedInfoResult = await makeRequest(
      'GET',
      `/games/provably-fair/seed-info/bet?game=MINES&betId=${gameId}`,
    );

    if (!seedInfoResult.success) {
      logError('Failed to get seed info for mines game', seedInfoResult.error);
      return false;
    }

    const seedInfo = seedInfoResult.data;
    logInfo('Seed info retrieved:', seedInfo);

    // Validate response structure
    if (!seedInfo.serverSeed || !seedInfo.clientSeed || typeof seedInfo.nonce !== 'number') {
      logError('Seed info missing required fields', seedInfo);
      return false;
    }

    if (typeof seedInfo.outcome !== 'number' || typeof seedInfo.isValid !== 'boolean') {
      logError('Seed info missing verification fields', seedInfo);
      return false;
    }

    // Verify the client seed matches what we sent
    if (seedInfo.clientSeed !== clientSeed) {
      logError(`Client seed mismatch. Expected: ${clientSeed}, Got: ${seedInfo.clientSeed}`);
      return false;
    }

    // Verify the outcome is a normalized value (0-1) for mines game
    // For mines, the outcome should be the normalized value used for mine generation
    if (typeof seedInfo.outcome !== 'number' || seedInfo.outcome < 0 || seedInfo.outcome > 1) {
      logError(`Invalid outcome for mines game. Expected: 0-1, Got: ${seedInfo.outcome}`);
      return false;
    }

    // Verify the calculated outcome matches the actual outcome (provably fair verification)
    if (Math.abs(seedInfo.calculatedOutcome - seedInfo.outcome) > 0.000001) {
      logError(
        `Calculated outcome mismatch. Expected: ${seedInfo.outcome}, Got: ${seedInfo.calculatedOutcome}`,
      );
      return false;
    }

    // The verification should be valid
    if (!seedInfo.isValid) {
      logError('Provably fair verification failed - isValid is false');
      return false;
    }

    // Verify hash is present
    if (!seedInfo.hash || typeof seedInfo.hash !== 'string') {
      logError('Hash missing or invalid');
      return false;
    }

    logSuccess('✅ Provably fair seed info verification passed for Mines');
    logSuccess(`✅ Server seed: ${seedInfo.serverSeed.substring(0, 16)}...`);
    logSuccess(`✅ Client seed: ${seedInfo.clientSeed}`);
    logSuccess(`✅ Nonce: ${seedInfo.nonce}`);
    logSuccess(
      `✅ Outcome verified: ${seedInfo.outcome.toFixed(6)} normalized value (valid: ${seedInfo.isValid})`,
    );
    logSuccess(`✅ Game status: ${finalGameData.status}`);

    return true;
  } catch (error) {
    logError('Seed info verification test failed', error);
    return false;
  }
}

async function testSetupValidation() {
  logInfo('Testing setup validation...');

  // Test invalid mines count (too many)
  const invalidBetData = {
    betAmount: TEST_BET_AMOUNT,
    minesCount: 25, // Too many mines for 5x5 grid
    gameSessionId: uuidv4(),
  };

  const invalidResult = await makeRequest('POST', '/games/mines/start', invalidBetData);

  if (invalidResult.success) {
    logError('Should have rejected invalid mines count', invalidResult.data);
    return false;
  }

  logSuccess('Setup validation working - correctly rejected invalid mines count');

  // Test invalid bet amount (too small)
  const invalidAmountData = {
    betAmount: 0.000000001, // Too small
    minesCount: TEST_MINES_COUNT,
    gameSessionId: uuidv4(),
  };

  const invalidAmountResult = await makeRequest('POST', '/games/mines/start', invalidAmountData);

  if (invalidAmountResult.success) {
    logError('Should have rejected invalid bet amount', invalidAmountResult.data);
    return false;
  }

  logSuccess('Setup validation working - correctly rejected invalid bet amount');
  return true;
}

// Main test runner
async function runAllTests() {
  logInfo('=== Starting Mines Game API Tests ===');
  logInfo(`Configuration:`, {
    baseUrl: BASE_URL,
    testUser: TEST_USER_EMAIL,
    betAmount: TEST_BET_AMOUNT,
    minesCount: TEST_MINES_COUNT,
  });

  const tests = [
    { name: 'Setup Validation', fn: testSetupValidation },
    { name: 'User Authentication', fn: testUserAuthentication },
    { name: 'User Exists', fn: testUserExists },
    { name: 'Balance Check', fn: testBalanceCheck },
    { name: 'HTTP Balance API', fn: testHttpBalanceApi },
    { name: 'HTTP Mines Betting', fn: testHttpMinesBetting },
    { name: 'Balance Change Verification', fn: testBalanceChangeVerification },
    { name: 'HTTP Game History', fn: testHttpGameHistory },
    { name: 'HTTP Game Details', fn: testHttpGameDetails },
    { name: 'Autoplay Betting Test 1', fn: testAutoplayBetting1 },
    { name: 'Autoplay Betting Test 2', fn: testAutoplayBetting2 },
    { name: 'Autoplay Betting Test 3', fn: testAutoplayBetting3 },
    { name: 'Autoplay Tile Reveal Fix', fn: testAutoplayTileRevealFix },
    { name: 'Provably Fair Seed Info', fn: testProvablyFairSeedInfo },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      logInfo(`\n--- Running: ${test.name} ---`);
      const result = await test.fn();
      if (result) {
        passed++;
        logSuccess(`✅ ${test.name} PASSED`);
      } else {
        failed++;
        logError(`❌ ${test.name} FAILED`);
      }
    } catch (error) {
      failed++;
      logError(`❌ ${test.name} ERROR:`, error);
    }

    // Short delay between tests to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  logInfo('\n=== Test Results Summary ===');
  logInfo(`Total tests: ${tests.length}`);
  logInfo(`Passed: ${passed}`);
  logInfo(`Failed: ${failed}`);
  logInfo(`Success rate: ${((passed / tests.length) * 100).toFixed(1)}%`);

  if (failed === 0) {
    logSuccess('🎉 ALL TESTS PASSED!');
  } else {
    logError(`💥 ${failed} test(s) failed.`);
  }

  process.exit(failed === 0 ? 0 : 1);
}

// Run tests
runAllTests().catch((error) => {
  logError('Unexpected error during test execution', error);
  process.exit(1);
});
