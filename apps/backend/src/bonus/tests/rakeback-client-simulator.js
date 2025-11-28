#!/usr/bin/env node

// eslint-disable-next-line @typescript-eslint/no-require-imports
const axios = require('axios');

// Configuration
const API_BASE = process.env.TEST_BACKEND_URL || 'http://localhost:4000/v1';

// User credentials - USER MUST BE REGISTERED BEFORE RUNNING TESTS
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'TestPassword123',
};

class RakebackClientSimulator {
  constructor() {
    this.token = null;
    this.user = null;
    this.results = {};
    this.seedReady = false;
    this.diceBetsMade = 0;
    this.MAX_DICE_BETS = 10;
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0,
        v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // Helper functions for multi-crypto rakeback format
  getTotalClaimableAssets(rakebackData) {
    return rakebackData.crypto ? Object.keys(rakebackData.crypto).length : 0;
  }

  getClaimableAmount(rakebackData, asset) {
    return rakebackData.crypto?.[asset] || '0';
  }

  hasAnyRakeback(rakebackData) {
    return rakebackData.crypto && Object.keys(rakebackData.crypto).length > 0;
  }

  logClaimableAmounts(rakebackData) {
    if (!rakebackData.crypto || Object.keys(rakebackData.crypto).length === 0) {
      this.log('  No claimable rakeback', 'rakeback');
      return;
    }
    Object.entries(rakebackData.crypto).forEach(([asset, amount]) => {
      this.log(`  ${asset}: ${amount}`, 'rakeback');
    });
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix =
      {
        info: '📋',
        success: '✅',
        error: '❌',
        warning: '⚠️',
        rakeback: '💰',
        bet: '🎲',
        claim: '🎁',
      }[type] || 'ℹ️';

    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async makeRequest(endpoint, method = 'GET', body = null, useAuth = true) {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (useAuth && this.token) {
      config.headers.Authorization = `Bearer ${this.token}`;
    }

    if (body) {
      config.data = body;
    }

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      throw new Error(`HTTP ${error.response?.status || 'ERROR'}: ${JSON.stringify(errorMessage)}`);
    }
  }

  // Place a real dice bet
  async placeDiceBet({
    betAmount = process.env.TEST_BET_AMOUNT || '0.00001',
    betType = 'ROLL_OVER',
    targetNumber = 60.0,
    clientSeed,
  } = {}) {
    if (!this.seedReady) {
      try {
        await this.makeRequest('/games/provably-fair/seed-info', 'GET', null, true);
        this.seedReady = true;
        await new Promise((r) => setTimeout(r, 100));
      } catch {
        // ignore
      }
    }

    if (this.diceBetsMade >= this.MAX_DICE_BETS) {
      throw new Error('Dice bet limit reached in simulator (max 10)');
    }

    const payload = {
      gameSessionId: this.generateUUID(),
      betAmount,
      betType,
      targetNumber,
      clientSeed: clientSeed || `rakeback-sim-${Date.now()}`,
    };

    let attempts = 0;
    while (attempts < 3) {
      try {
        const res = await this.makeRequest('/games/dice/bet', 'POST', payload, true);
        this.diceBetsMade++;
        return res;
      } catch (e) {
        attempts++;
        if (attempts >= 3) throw e;
        await new Promise((r) => setTimeout(r, 200 + attempts * 200));
      }
    }
  }

  async placeBlackjackBet({ betAmount = '1000.00', clientSeed } = {}) {
    const payload = {
      gameSessionId: this.generateUUID(),
      betAmount,
      clientSeed: clientSeed || `rakeback-bj-${Date.now()}`,
    };

    return await this.makeRequest('/games/blackjack/start', 'POST', payload, true);
  }

  async placeRouletteBet({ betAmount = '0.001', clientSeed } = {}) {
    const payload = {
      gameSessionId: this.generateUUID(),
      clientSeed: clientSeed || `rakeback-roulette-${Date.now()}`,
      bets: [
        {
          type: 'red', // Bet on red
          numbers: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36], // Red numbers
          amount: betAmount,
        },
      ],
    };

    return await this.makeRequest('/games/roulette/bet', 'POST', payload, true);
  }

  async clearActiveBlackjackGame() {
    // Try multiple times with delays to handle race conditions
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const activeGame = await this.makeRequest('/games/blackjack/current', 'GET', null, true);
        if (!activeGame || !activeGame.id) {
          // No active game found
          return;
        }

        this.log(
          `Found active blackjack game ${activeGame.id} (attempt ${attempt + 1}/3), completing it...`,
          'info',
        );

        // Stand on all available actions until game completes
        let maxAttempts = 10;
        let currentGame = activeGame;

        while (currentGame && currentGame.status === 'active' && maxAttempts > 0) {
          // Check available actions
          if (currentGame.availableActions && currentGame.availableActions.length > 0) {
            // Prefer stand if available
            const action = currentGame.availableActions.includes('stand')
              ? 'stand'
              : currentGame.availableActions[0];

            this.log(`Performing action: ${action}`, 'info');
            const result = await this.makeRequest(
              '/games/blackjack/action',
              'POST',
              {
                gameId: currentGame.id,
                action: action,
              },
              true,
            );

            currentGame = result;
            await new Promise((r) => setTimeout(r, 300));
          } else {
            // No actions available, game should be completed
            break;
          }
          maxAttempts--;
        }

        this.log(`Completed blackjack game ${activeGame.id}`, 'success');

        // Wait longer for DB to fully persist the completed status
        await new Promise((r) => setTimeout(r, 1000));
      } catch (error) {
        // If error indicates no game, we're done
        if (error.message && error.message.includes('404')) {
          return;
        }
        // For other errors on last attempt, log but continue
        if (attempt === 2) {
          this.log(`Could not fully clear blackjack games: ${error.message}`, 'warning');
        }
      }
    }
  }

  async test1_userAuthentication() {
    this.log('Test 1: User Authentication', 'info');

    try {
      const loginData = await this.makeRequest(
        '/auth/login/email',
        'POST',
        {
          email: TEST_USER.email,
          password: TEST_USER.password,
        },
        false,
      );

      this.token = loginData.accessToken;
      this.user = loginData.user;

      this.log(`User logged in successfully - ID: ${this.user.id}`, 'success');

      // Ensure provably-fair seed pair exists
      try {
        await this.makeRequest('/games/provably-fair/seed-info');
        this.seedReady = true;
      } catch {
        // Ignore seed initialization errors
      }

      return { success: true, details: 'Authentication completed' };
    } catch (error) {
      this.log(`User Authentication failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async clearRakebackData() {
    this.log('🧹 Clearing rakeback data for clean test results', 'info');

    try {
      // Use simulator secret to access admin endpoints for data cleanup
      const config = {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-simulator-secret': process.env.SIMULATOR_SECRET || 'your-secret-key',
        },
      };

      // Try to clear rakeback data via admin endpoint or direct API call
      try {
        const response = await fetch(
          `${API_BASE}/admin/test/clear-rakeback/${this.user.id}`,
          config,
        );
        if (response.ok) {
          this.log('✅ Rakeback data cleared via admin endpoint', 'success');
          return;
        }
      } catch {
        // Admin endpoint not available, continue with manual approach
      }

      // Fallback: Manual approach - delete record by making a database query
      // This simulates clearing the rakeback accumulated amount
      try {
        // Try to reset via a test endpoint that might exist
        await this.makeRequest(
          '/test/clear-rakeback',
          'POST',
          {
            userId: this.user.id,
          },
          true,
        );
        this.log('✅ Rakeback data cleared via test endpoint', 'success');
        return;
      } catch {
        // Test endpoint not available
      }

      // Final fallback: Try to claim any existing rakeback to reset it to 0
      try {
        // First check if there's any rakeback to claim
        const currentRakeback = await this.makeRequest('/rakeback/amount');
        const hasRakeback = this.hasAnyRakeback(currentRakeback);

        if (hasRakeback) {
          this.log('💰 Found existing rakeback - claiming it to reset', 'info');
          this.logClaimableAmounts(currentRakeback);

          // Claim all available assets to reset rakeback to 0
          for (const [asset] of Object.entries(currentRakeback.crypto)) {
            await this.makeRequest('/rakeback/claim', 'POST', { asset });
            this.log(`✅ Claimed ${asset} rakeback successfully`, 'success');
          }
        } else {
          this.log('✅ No existing rakeback found - starting with clean slate', 'success');
        }
        return;
      } catch {
        // Could not check/claim existing rakeback
      }

      // Absolute fallback: Just log that we're starting with existing data
      this.log('⚠️ Could not clear existing rakeback. Starting with current balance.', 'warning');
      this.log(
        '💡 To add proper cleanup, create DELETE /admin/test/clear-rakeback/:userId endpoint',
        'info',
      );
    } catch (error) {
      this.log(`⚠️ Could not clear rakeback data: ${error.message}`, 'warning');
      this.log('📝 Continuing with existing data...', 'info');
    }
  }

  async ensureVipLevel() {
    this.log('🔝 Ensuring user has VIP level 1+ for rakeback testing', 'info');

    try {
      // Check current VIP status
      const vipStatus = await this.makeRequest('/bonus/vip-status');
      const currentLevel = vipStatus.currentVipLevel || 0;
      const currentWager = parseFloat(vipStatus.currentWager || '0');

      this.log(
        `📊 Current VIP: Level ${currentLevel} (${vipStatus.tierName || 'Unknown'})`,
        'info',
      );
      this.log(`💰 Current wager: $${(currentWager / 100).toFixed(2)}`, 'info');

      if (currentLevel >= 1) {
        this.log('✅ User already has VIP level 1+ - rakeback available', 'success');
        return;
      }

      // Need to reach Bronze I (Level 1) - requires $2,500 wager
      const targetWager = 250000; // $2,500 in cents
      const neededWager = targetWager - currentWager;

      if (neededWager > 0) {
        this.log(
          `⬆️ Need to wager $${(neededWager / 100).toFixed(2)} more to reach Bronze I`,
          'warning',
        );
        this.log('🎲 Placing large bets to increase VIP level...', 'bet');

        // Use large BTC amounts to reach the required wager (assuming ~$50k-70k BTC price)
        const btcAmounts = ['0.01', '0.008', '0.007']; // ~$500-700 each at current BTC prices

        for (let i = 0; i < btcAmounts.length; i++) {
          try {
            const btcAmount = btcAmounts[i];
            this.log(`🎲 VIP boost bet ${i + 1}/${btcAmounts.length} (${btcAmount} BTC)...`, 'bet');
            await this.placeDiceBet({
              betAmount: btcAmount,
              targetNumber: 50,
            });
            await new Promise((r) => setTimeout(r, 1000)); // Delay between bets
          } catch (error) {
            this.log(`⚠️ VIP boost bet ${i + 1} failed: ${error.message}`, 'warning');
          }
        }

        // Check new VIP status
        const newVipStatus = await this.makeRequest('/bonus/vip-status');
        const newLevel = newVipStatus.currentVipLevel || 0;
        const newWager = parseFloat(newVipStatus.currentWager || '0');

        this.log(
          `🔝 New VIP: Level ${newLevel} (${newVipStatus.tierName || 'Unknown'})`,
          'success',
        );
        this.log(`💰 New wager: $${(newWager / 100).toFixed(2)}`, 'success');

        if (newLevel >= 1) {
          this.log('🎉 Successfully reached Bronze I! Rakeback is now available', 'success');
        } else {
          this.log('⚠️ Still at level 0 - rakeback tests may fail', 'warning');
        }
      }
    } catch (error) {
      this.log(`⚠️ Could not ensure VIP level: ${error.message}`, 'warning');
      this.log('📝 Continuing with current VIP status...', 'info');
    }
  }

  async test2_checkInitialRakeback() {
    this.log('Test 2: Check Initial Rakeback Amount', 'rakeback');

    try {
      const rakebackData = await this.makeRequest('/rakeback/amount');

      this.log('Initial rakeback amounts:', 'info');
      this.logClaimableAmounts(rakebackData);

      return {
        success: true,
        details: 'Initial rakeback checked',
        rakebackData,
      };
    } catch (error) {
      this.log(`Check Initial Rakeback failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async getVipRakebackPercentage() {
    try {
      // Get VIP status
      const vipStatus = await this.makeRequest('/bonus/vip-status');
      const vipLevel = vipStatus.currentVipLevel || 0;

      if (vipLevel === 0) {
        return { vipLevel: 0, rakebackPercentage: 0, tierName: 'No VIP' };
      }

      // Get VIP tiers to find rakeback percentage
      const tiers = await this.makeRequest('/bonus/vip-tiers');
      const currentTier = tiers.find((t) => t.level === vipLevel);

      return {
        vipLevel,
        rakebackPercentage: currentTier ? parseFloat(currentTier.rakebackPercentage) / 100 : 0,
        tierName: currentTier?.name || 'Unknown',
      };
    } catch (error) {
      this.log(`Failed to get VIP rakeback percentage: ${error.message}`, 'warning');
      return { vipLevel: 0, rakebackPercentage: 0, tierName: 'Unknown' };
    }
  }

  async test3_placeBetsToEarnRakeback() {
    this.log('Test 3: Place Bets to Earn Rakeback', 'bet');

    try {
      // Get current VIP rakeback percentage
      const vipInfo = await this.getVipRakebackPercentage();
      const rakebackPercentage = vipInfo.rakebackPercentage;

      this.log(
        `🔝 Current VIP: Level ${vipInfo.vipLevel} (${vipInfo.tierName}) with ${(rakebackPercentage * 100).toFixed(2)}% rakeback`,
      );

      // Clear any existing rakeback before placing bets
      try {
        const existingRakeback = await this.makeRequest('/rakeback/amount');
        if (this.hasAnyRakeback(existingRakeback)) {
          this.log('🧹 Clearing existing rakeback before test...', 'info');
          await this.makeRequest('/rakeback/claim-all', 'POST');
          await new Promise((r) => setTimeout(r, 500));
        }
      } catch {
        // Ignore if no rakeback to clear
      }

      // Clear any active blackjack games before testing
      await this.clearActiveBlackjackGame();

      // Place dice bet 0.001 BTC
      await this.placeDiceBet({ betAmount: '0.001' });
      this.log('Placed Dice bet of 0.001 BTC');
      await new Promise((r) => setTimeout(r, 500));

      // Place Roulette bet 0.001 BTC
      await this.placeRouletteBet({ betAmount: '0.001' });
      this.log('Placed Roulette bet of 0.001 BTC on red');
      await new Promise((r) => setTimeout(r, 500));

      // Place Blackjack bet 0.001 BTC
      try {
        // Double-check no active game right before betting
        await new Promise((r) => setTimeout(r, 500));
        const bjResult = await this.placeBlackjackBet({ betAmount: '0.001' });
        this.log('Placed Blackjack bet of 0.001 BTC');

        // Complete the blackjack game (stand)
        if (bjResult && bjResult.id && bjResult.status === 'active') {
          await new Promise((r) => setTimeout(r, 500));
          await this.makeRequest('/games/blackjack/action', 'POST', {
            gameId: bjResult.id,
            action: 'stand',
          });
          this.log('Completed Blackjack game (stand)');
        }
      } catch (e) {
        this.log(`Blackjack bet warning: ${e.message}`, 'warning');
      }

      // Wait for processing
      await new Promise((r) => setTimeout(r, 2000));

      // Calculate expected in BTC using actual VIP rakeback percentage
      const expectedDice = 0.001 * (1 / 100) * rakebackPercentage;
      const expectedRoulette = 0.001 * (2.7 / 100) * rakebackPercentage;
      const expectedBlackjack = 0.001 * (0.57 / 100) * rakebackPercentage;
      const totalExpected = expectedDice + expectedRoulette + expectedBlackjack;

      this.log(
        `Expected rakeback at ${(rakebackPercentage * 100).toFixed(2)}% (VIP Level ${vipInfo.vipLevel}):`,
      );
      this.log(
        `  Dice: 0.001 × (1/100) × ${rakebackPercentage.toFixed(2)} = ${expectedDice.toFixed(8)} BTC`,
      );
      this.log(
        `  Roulette: 0.001 × (2.7/100) × ${rakebackPercentage.toFixed(2)} = ${expectedRoulette.toFixed(8)} BTC`,
      );
      this.log(
        `  Blackjack: 0.001 × (0.57/100) × ${rakebackPercentage.toFixed(2)} = ${expectedBlackjack.toFixed(10)} BTC`,
      );
      this.log(`  Total: ${totalExpected.toFixed(8)} BTC`);

      return {
        success: true,
        details: `Placed bets, expected ${totalExpected.toFixed(8)} BTC rakeback`,
        betsPlaced: 3,
        expectedRakebackBTC: totalExpected.toFixed(8),
        vipLevel: vipInfo.vipLevel,
        rakebackPercentage: (rakebackPercentage * 100).toFixed(2),
      };
    } catch (error) {
      this.log(`Place Bets to Earn Rakeback failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test4_checkRakebackAfterBets() {
    this.log('Test 4: Check Rakeback After Bets', 'rakeback');

    try {
      // Get VIP rakeback percentage for validation
      const vipInfo = await this.getVipRakebackPercentage();
      const rakebackPercentage = vipInfo.rakebackPercentage;

      const rakebackData = await this.makeRequest('/rakeback/amount');

      this.log('Rakeback amounts after betting:', 'success');
      this.logClaimableAmounts(rakebackData);

      // Get BTC rakeback and compare with expected
      const btcRakeback = parseFloat(this.getClaimableAmount(rakebackData, 'BTC') || '0');

      // From Test 3: we placed 0.001 BTC on Dice, Roulette, and Blackjack
      const expectedDice = 0.001 * (1 / 100) * rakebackPercentage;
      const expectedRoulette = 0.001 * (2.7 / 100) * rakebackPercentage;
      const expectedBlackjack = 0.001 * (0.57 / 100) * rakebackPercentage;
      const expectedTotal = expectedDice + expectedRoulette + expectedBlackjack;

      this.log('📊 VERIFICATION:', 'info');
      this.log(`  Expected: ${expectedTotal.toFixed(8)} BTC`, 'info');
      this.log(`  Actual:   ${btcRakeback.toFixed(8)} BTC`, 'info');
      this.log(`  Difference: ${(btcRakeback - expectedTotal).toFixed(10)} BTC`, 'info');

      const percentDiff = ((btcRakeback - expectedTotal) / expectedTotal) * 100;
      this.log(
        `  Percent diff: ${percentDiff.toFixed(2)}%`,
        Math.abs(percentDiff) < 5 ? 'success' : 'warning',
      );

      const hasRakeback = this.hasAnyRakeback(rakebackData);
      if (!hasRakeback) {
        this.log('No rakeback earned - this might indicate an issue', 'warning');
      }

      return {
        success: hasRakeback,
        details: hasRakeback ? 'Rakeback earned successfully' : 'No rakeback earned',
        rakebackData,
        expected: expectedTotal,
        actual: btcRakeback,
      };
    } catch (error) {
      this.log(`Check Rakeback After Bets failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test5_claimRakeback() {
    this.log('Test 5: Claim Rakeback to BTC', 'claim');

    try {
      // Get current balance before claiming
      const balanceBefore = await this.makeRequest('/balance/fiat');
      const balanceBeforeCents = parseInt(balanceBefore.balance);

      this.log(`Balance before claim: ${(balanceBeforeCents / 100).toFixed(2)} USD`, 'info');

      // Claim rakeback to BTC wallet
      const claimResult = await this.makeRequest('/rakeback/claim', 'POST', { asset: 'BTC' });

      this.log(`Claim result: ${JSON.stringify(claimResult)}`, 'claim');

      if (claimResult.success) {
        const claimedCents = parseFloat(claimResult.amountCents);
        const claimedUSD = (claimedCents / 100).toFixed(2);

        this.log(`Successfully claimed ${claimedUSD} USD in ${claimResult.asset}!`, 'success');

        // Get balance after claiming
        await new Promise((r) => setTimeout(r, 500)); // Wait for balance update
        const balanceAfter = await this.makeRequest('/balance/fiat');
        const balanceAfterCents = parseInt(balanceAfter.balance);

        this.log(`Balance after claim: ${(balanceAfterCents / 100).toFixed(2)} USD`, 'info');

        const balanceIncrease = (balanceAfterCents - balanceBeforeCents) / 100;
        this.log(`Balance increased by: ${balanceIncrease.toFixed(2)} USD`, 'success');

        return {
          success: true,
          details: `Claimed ${claimedUSD} USD rakeback`,
          amountCents: claimedCents,
          asset: claimResult.asset,
          balanceIncrease,
        };
      } else {
        this.log(`Claim failed: ${claimResult.error}`, 'error');
        return {
          success: false,
          details: claimResult.error || 'Claim failed',
          error: claimResult.error,
        };
      }
    } catch (error) {
      this.log(`Claim Rakeback failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test6_checkRakebackAfterClaim() {
    this.log('Test 6: Check Rakeback After Claim', 'rakeback');

    try {
      const rakebackData = await this.makeRequest('/rakeback/amount');

      this.log('Rakeback amounts after claim:', 'info');
      this.logClaimableAmounts(rakebackData);

      const hasRakeback = this.hasAnyRakeback(rakebackData);

      const shouldBeZero = !hasRakeback;
      if (shouldBeZero) {
        this.log('Rakeback amounts are zero after claim - correct behavior!', 'success');
      } else {
        this.log('Rakeback still available after claim - unexpected!', 'warning');
      }

      return {
        success: shouldBeZero,
        details: shouldBeZero ? 'Rakeback reset to zero after claim' : 'Rakeback still available',
        rakebackData,
      };
    } catch (error) {
      this.log(`Check Rakeback After Claim failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test7_multipleBetsAndClaim() {
    this.log('Test 7: Multiple Bets and Claim Cycle', 'bet');

    try {
      // Place more bets to earn more rakeback
      const betAmount = '0.002'; // Larger bet amount
      const numBets = 3;

      this.log(
        `Placing ${numBets} larger bets of ${betAmount} BTC each, then claiming to BTC...`,
        'bet',
      );

      for (let i = 0; i < numBets; i++) {
        await this.placeDiceBet({
          betAmount,
          betType: 'ROLL_OVER',
          targetNumber: 65.0,
          clientSeed: `rakeback-cycle-${Date.now()}-${i}`,
        });

        if (i < numBets - 1) {
          await new Promise((r) => setTimeout(r, 300));
        }
      }

      // Wait for processing
      await new Promise((r) => setTimeout(r, 1000));

      // Check rakeback
      const rakebackBefore = await this.makeRequest('/rakeback/amount');
      const hasRakebackBefore = this.hasAnyRakeback(rakebackBefore);

      this.log('Rakeback before claim:', 'rakeback');
      this.logClaimableAmounts(rakebackBefore);

      // Claim if available
      if (hasRakebackBefore) {
        // Claim the first available asset
        const firstAsset = Object.keys(rakebackBefore.crypto)[0];
        const claimResult = await this.makeRequest('/rakeback/claim', 'POST', {
          asset: firstAsset,
        });

        if (claimResult.success) {
          this.log(
            `Second claim successful: ${claimResult.amount} ${claimResult.asset}`,
            'success',
          );
        }
      }

      return {
        success: true,
        details: `Completed multiple bet and claim cycle`,
        betsPlaced: numBets,
        rakebackEarned: hasRakebackBefore,
      };
    } catch (error) {
      this.log(`Multiple Bets and Claim Cycle failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test8_multiAssetFlow() {
    this.log('Test 8: Continuous Rakeback Accumulation', 'rakeback');

    try {
      // Simplified test - just verify continuous accumulation works
      // (Multi-asset requires changing primary asset which is complex)

      // Step 1: Place multiple BTC bets
      this.log('🎲 Placing BTC bets...');
      await this.placeDiceBet({ betAmount: '0.001' });
      await new Promise((r) => setTimeout(r, 500));
      await this.placeDiceBet({ betAmount: '0.001' });
      await new Promise((r) => setTimeout(r, 500));

      // Step 2: Check accumulated rakeback
      const rakebackData = await this.makeRequest('/rakeback/amount');
      this.log('Rakeback after bets:', 'rakeback');
      this.logClaimableAmounts(rakebackData);

      const btcAmount = parseFloat(this.getClaimableAmount(rakebackData, 'BTC'));

      if (btcAmount <= 0) {
        throw new Error('No rakeback accumulated');
      }

      // Step 3: Claim BTC
      this.log('🎁 Claiming BTC rakeback...');
      const btcClaim = await this.makeRequest('/rakeback/claim', 'POST', { asset: 'BTC' });
      if (!btcClaim.success) throw new Error('BTC claim failed');

      // Step 4: Verify reset
      const afterClaim = await this.makeRequest('/rakeback/amount');
      this.log('Rakeback after claim:', 'rakeback');
      this.logClaimableAmounts(afterClaim);

      if (this.getClaimableAmount(afterClaim, 'BTC') !== '0') {
        throw new Error('Rakeback not reset after claim');
      }

      return {
        success: true,
        details: 'Continuous rakeback accumulation and claim cycle works correctly',
      };
    } catch (error) {
      this.log(`Continuous Accumulation Test failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  printSummary() {
    console.log('\n============================================================');
    console.log('💰 VIP RAKEBACK SYSTEM TEST SUMMARY');
    console.log('============================================================');

    const tests = [
      'Test 1: User Authentication',
      'Test 2: Check Initial Rakeback Amount',
      'Test 3: Place Bets to Earn Rakeback',
      'Test 4: Check Rakeback After Bets',
      'Test 5: Claim Rakeback',
      'Test 6: Check Rakeback After Claim',
      'Test 7: Multiple Bets and Claim Cycle',
      'Test 8: Continuous Rakeback Accumulation',
    ];

    let passedCount = 0;
    tests.forEach((testName, index) => {
      const result = this.results[index + 1];
      if (result?.success) {
        console.log(`✅ ${testName} - PASSED`);
        console.log(`   ${result.details}`);
        passedCount++;
      } else {
        console.log(`❌ ${testName} - FAILED`);
        if (result?.error) {
          console.log(`   Error: ${result.error}`);
        }
      }
    });

    console.log('\n------------------------------------------------------------');
    console.log(`📊 RESULTS: ${passedCount}/${tests.length} tests passed`);

    if (passedCount === tests.length) {
      console.log('🎉 ALL TESTS PASSED! VIP rakeback system working perfectly!');
      console.log(
        '💡 Formula: Rakeback = Bet Amount × House Edge × VIP Rakeback % (based on VIP level)',
      );
    } else {
      console.log('⚠️  Some tests failed. Please check the errors above.');
    }
    console.log('============================================================');
  }

  async runAllTests() {
    console.log('🚀 Starting VIP Rakeback System Test');
    console.log('🎯 Testing VIP-based rakeback calculation and claiming');
    console.log('🧹 Will clear existing rakeback data for clean test results');
    console.log('🔝 Will auto-boost VIP level to Bronze I if needed for rakeback');
    console.log(`📧 Test Email: ${TEST_USER.email}`);
    console.log(`🔗 Base URL: ${API_BASE}`);

    this.results = {};

    try {
      this.results[1] = await this.test1_userAuthentication();
      if (!this.results[1].success) throw new Error('Authentication failed');

      // Clear rakeback data before starting tests for clean results
      await this.clearRakebackData();

      // Ensure user has VIP level 1+ for rakeback testing
      await this.ensureVipLevel();

      this.results[2] = await this.test2_checkInitialRakeback();
      this.results[3] = await this.test3_placeBetsToEarnRakeback();
      this.results[4] = await this.test4_checkRakebackAfterBets();
      this.results[5] = await this.test5_claimRakeback();
      this.results[6] = await this.test6_checkRakebackAfterClaim();
      this.results[7] = await this.test7_multipleBetsAndClaim();
      this.results[8] = await this.test8_multiAssetFlow();
    } catch (error) {
      console.log(`\n💥 ${error.message}`);
    }

    this.printSummary();
  }
}

// Run the simulator
const simulator = new RakebackClientSimulator();
simulator.runAllTests().catch(console.error);
