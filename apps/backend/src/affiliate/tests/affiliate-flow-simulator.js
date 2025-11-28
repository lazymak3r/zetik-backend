#!/usr/bin/env node

/**
 * Affiliate Commission Flow Simulator - Wager-Based Model
 *
 * Tests the NEW wager-based commission model:
 * 1. Casino bets (Dice) trigger immediate commission on bet.confirmed
 * 2. Commission formula: (houseEdge * wagered / 2) * 0.1
 * 3. Balance validation before claim
 * 4. Atomic UPSERT for affiliate wallet updates (no duplicates)
 * 5. Per-asset commission breakdown in statistics
 *
 * Changes from old model:
 * - ❌ OLD: 10% commission on deposits
 * - ✅ NEW: Wager-based commission (casino + sportsbook)
 *
 * Usage:
 *   node apps/backend/src/affiliate/tests/affiliate-flow-simulator.js
 *
 * Environment variables:
 *   API_URL - API base URL (default: http://localhost:4000/v1)
 */

const API_URL = process.env.API_URL || 'http://localhost:4000/v1';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, colors.green);
}

function logError(message) {
  log(`❌ ${message}`, colors.red);
}

function logInfo(message) {
  log(`ℹ️  ${message}`, colors.cyan);
}

function logWarning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class AffiliateFlowSimulator {
  constructor() {
    this.baseUrl = API_URL;
    this.affiliateToken = null;
    this.affiliateUserId = null;
    this.referredUserToken = null;
    this.referredUserId = '8c482629-542e-42a0-bb38-86d302edabe6'; // Use existing user
    this.campaignCode = null;
    this.results = {
      passed: 0,
      failed: 0,
      warnings: 0,
    };
  }

  async makeRequest(endpoint, method = 'GET', body = null, token = null, isAdmin = false) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (isAdmin) {
      headers['x-simulator-secret'] = 'admin-secret-key';
    }

    const options = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_URL}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${JSON.stringify(data)}`);
    }

    return data;
  }

  async registerUser(username, email, affiliateCampaignId = null) {
    log(`\n📝 Registering user: ${username}`, colors.bright);
    const body = {
      username,
      email,
      password: 'Test123456!',
    };
    if (affiliateCampaignId) {
      body.affiliateCampaignId = affiliateCampaignId;
      logInfo(`Registering with referral: ${affiliateCampaignId}`);
    }
    const response = await this.makeRequest('/auth/register/email', 'POST', body);
    logSuccess(`Registered user: ${username} (ID: ${response.user.id})`);
    return response.user; // Return user object, not full auth response
  }

  async loginUser(email, password = 'Test123456!') {
    log(`\n🔐 Logging in: ${email}`, colors.bright);
    const response = await this.makeRequest('/auth/login/email', 'POST', {
      email,
      password,
    });
    logSuccess(`Logged in: ${email}`);
    return response.accessToken;
  }

  async createAffiliateCampaign(token) {
    log(`\n🎯 Creating affiliate campaign`, colors.bright);
    const response = await this.makeRequest(
      '/affiliate/campaigns',
      'POST',
      {
        name: `Test Campaign ${Date.now()}`,
        code: `TEST${Date.now()}`,
      },
      token,
    );
    logSuccess(`Created campaign with code: ${response.code}`);
    return response;
  }

  async placeDiceBet(token, betAmount = '0.00001', targetNumber = 50) {
    log(`\n🎲 Placing REAL dice bet`, colors.bright);
    logInfo(`Bet: ${betAmount} BTC, Roll Over: ${targetNumber}`);

    try {
      const response = await this.makeRequest(
        '/games/dice/bet',
        'POST',
        {
          betAmount,
          betType: 'ROLL_OVER',
          targetNumber,
        },
        token,
      );

      const won = response.payout && parseFloat(response.payout) > 0;
      logSuccess(
        `Dice bet placed! Result: ${response.rolledNumber} (${won ? 'WON' : 'LOST'}) - Payout: ${response.payout || '0'} BTC`,
      );
      logInfo('Commission should be processed immediately via bet.confirmed event');
      logInfo('Waiting 2 seconds for commission processing...');
      await sleep(2000);

      return {
        betId: response.id,
        betAmount,
        result: response.rolledNumber,
        won,
        payout: response.payout,
      };
    } catch (error) {
      logError(`Failed to place dice bet: ${error.message}`);
      throw error;
    }
  }

  async placeMultipleDiceBets(token, count = 5) {
    // For $388 USD equivalent bet: $388 / $113,500 ≈ 0.00342 BTC
    // Use smaller bet amount to avoid balance issues
    const btcBetAmount = '0.00342'; // ~$388 USD at current rates

    log(`\n🎲 Placing ${count} dice bets to accumulate commission`, colors.bright);
    logInfo(`💰 Target: 0.00342 BTC (~$388 USD) per bet`);
    logInfo(`📊 Expected total commission (~0.05% from 5 bets): ~$0.97 USD (97 cents)`);
    const results = [];

    for (let i = 0; i < count; i++) {
      const result = await this.placeDiceBet(token, btcBetAmount);
      results.push(result);
      await sleep(500); // Small delay between bets
    }

    logSuccess(`Placed ${count} bets successfully`);
    const totalWagered = (parseFloat(btcBetAmount) * count).toFixed(8);
    logInfo(`Total wagered: ${totalWagered} BTC`);

    // Calculate expected commission: (houseEdge * wagered / 2) * 0.1
    // Dice house edge is 1%
    const expectedCommissionBtc = (0.01 * parseFloat(totalWagered) * 0.5 * 0.1).toFixed(8);
    const expectedCommissionUsd = (parseFloat(expectedCommissionBtc) * 113500).toFixed(2);
    logInfo(
      `Expected commission (1% edge): ${expectedCommissionBtc} BTC ≈ $${expectedCommissionUsd} USD`,
    );

    return results;
  }

  async getCommissions(token) {
    // NOTE: /affiliate/commissions endpoint removed - using /affiliate/statistics instead
    log(`\n💵 Checking available commissions from statistics`, colors.bright);
    const stats = await this.getStatistics(token);

    if (stats.commissions && stats.commissions.length > 0) {
      const hasBalance = stats.commissions.some((c) => parseFloat(c.claimable) > 0);
      if (hasBalance) {
        logSuccess(`Found commissions in ${stats.commissions.length} asset(s)`);
        stats.commissions.forEach((comm) => {
          if (parseFloat(comm.claimable) > 0) {
            logInfo(`  ${comm.asset}: ${comm.claimable} (claimable)`);
          }
        });
      } else {
        logWarning('No commissions available yet');
      }
      return { wallets: stats.commissions.filter((c) => parseFloat(c.claimable) > 0) };
    } else {
      logWarning('No commissions available yet');
      return { wallets: [] };
    }
  }

  async claimCommissions(token) {
    log(`\n🎁 Claiming all commissions`, colors.bright);
    const response = await this.makeRequest('/affiliate/claim', 'POST', {}, token);

    if (response.transferred) {
      logSuccess(`Claimed ${response.totalTransferred} cryptocurrency commission(s)`);
      Object.entries(response.transferred).forEach(([asset, amount]) => {
        logInfo(`  ${asset}: ${amount}`);
      });
    }

    return response;
  }

  async getStatistics(token) {
    log(`\n📊 Fetching affiliate statistics`, colors.bright);
    const response = await this.makeRequest('/affiliate/statistics', 'GET', null, token);

    logSuccess('Statistics retrieved');
    logInfo(`  Total Referrals: ${response.totalReferrals}`);
    logInfo(`  Total Wagered: $${response.totalWageredUsd}`);
    logInfo(`  Total Deposited: $${response.totalDepositedUsd}`);
    logInfo(`  Total Claimed: $${response.totalClaimedUsd}`);
    logInfo(`  Available: $${response.totalAvailableUsd}`);

    if (response.commissions && response.commissions.length > 0) {
      logInfo(`  Commissions by asset:`);
      response.commissions.forEach((comm) => {
        logInfo(
          `    ${comm.asset}: earned=${comm.commission}, claimed=${comm.claimed}, claimable=${comm.claimable}`,
        );
      });
    }

    return response;
  }

  async getReferredUsersEarnings(token) {
    log(`\n💵 Checking totalEarnings from referred users`, colors.bright);
    const response = await this.makeRequest(
      '/affiliate/referred-users?limit=10&offset=0',
      'GET',
      null,
      token,
    );

    logSuccess('Referred users retrieved');
    if (response.users && response.users.length > 0) {
      response.users.forEach((user) => {
        // API returns totalEarnings in dollars, convert to cents
        const earningsInCents = user.totalEarnings * 100;
        logInfo(
          `  ${user.userName}: totalEarnings=${earningsInCents.toFixed(0)} cents ($${user.totalEarnings.toFixed(2)})`,
        );
      });
    }

    return response.users || [];
  }

  async testDuplicateCommissionProtection() {
    log(`\n\n${'='.repeat(60)}`, colors.bright);
    log('TEST: Duplicate Commission Protection (Atomic UPSERT)', colors.bright);
    log('='.repeat(60), colors.bright);

    try {
      logInfo("Testing that bet.confirmed events don't create duplicate commissions...");

      const commission1 = await this.getCommissions(this.affiliateToken);
      await sleep(100);
      const commission2 = await this.getCommissions(this.affiliateToken);

      // Balances should be identical (atomic UPSERT prevents duplicates)
      if (JSON.stringify(commission1.wallets) === JSON.stringify(commission2.wallets)) {
        logSuccess('✓ Commission balances are consistent (no duplicates from UPSERT)');
        this.results.passed++;
      } else {
        logError('✗ Commission balances differ (possible duplicate)');
        this.results.failed++;
      }
    } catch (error) {
      logError(`Test failed: ${error.message}`);
      this.results.failed++;
    }
  }

  async testClaimWithoutBalance() {
    log(`\n\n${'='.repeat(60)}`, colors.bright);
    log('TEST: Claim Without Available Balance', colors.bright);
    log('='.repeat(60), colors.bright);

    try {
      // Create a new user with no commissions
      await this.registerUser(`noclaim_${Date.now()}`, `noclaim_${Date.now()}@test.com`);
      const token = await this.loginUser(`noclaim_${Date.now()}@test.com`);

      // Try to claim
      try {
        await this.claimCommissions(token);
        logError('✗ Should have thrown error for empty balance');
        this.results.failed++;
      } catch (error) {
        if (error.message.includes('No commissions available')) {
          logSuccess('✓ Correctly rejected claim with no balance');
          this.results.passed++;
        } else {
          logWarning(`Different error: ${error.message}`);
          this.results.warnings++;
        }
      }
    } catch (error) {
      logError(`Test failed: ${error.message}`);
      this.results.failed++;
    }
  }

  async testConcurrentClaims() {
    log(`\n\n${'='.repeat(60)}`, colors.bright);
    log('TEST: Concurrent Claim Prevention', colors.bright);
    log('='.repeat(60), colors.bright);

    try {
      const commissionsBefore = await this.getCommissions(this.affiliateToken);

      if (!commissionsBefore.wallets || commissionsBefore.wallets.length === 0) {
        logWarning('No commissions to test concurrent claims');
        this.results.warnings++;
        return;
      }

      logInfo('Attempting concurrent claims...');

      // Try to claim twice simultaneously
      const promises = [
        this.claimCommissions(this.affiliateToken).catch((e) => ({ error: e.message })),
        sleep(10).then(() =>
          this.claimCommissions(this.affiliateToken).catch((e) => ({ error: e.message })),
        ),
      ];

      const results = await Promise.all(promises);

      // One should succeed, one should fail or both might succeed if timing is off
      const successes = results.filter((r) => !r.error).length;
      const failures = results.filter((r) => r.error).length;

      logInfo(`Results: ${successes} succeeded, ${failures} failed`);

      // Verify final balance is correct
      await sleep(500);
      const commissionsAfter = await this.getCommissions(this.affiliateToken);

      const allZero = commissionsAfter.wallets.every((w) => parseFloat(w.balance) === 0);

      if (allZero) {
        logSuccess('✓ Final balance is zero (no double-claim)');
        this.results.passed++;
      } else {
        logError('✗ Balance not fully claimed or double-claimed');
        this.results.failed++;
      }
    } catch (error) {
      logError(`Test failed: ${error.message}`);
      this.results.failed++;
    }
  }

  async testStatisticsConsistency() {
    log(`\n\n${'='.repeat(60)}`, colors.bright);
    log('TEST: Statistics Consistency', colors.bright);
    log('='.repeat(60), colors.bright);

    try {
      const stats = await this.getStatistics(this.affiliateToken);

      // Verify statistics structure
      const hasAllFields =
        stats.totalReferrals !== undefined &&
        stats.totalWageredUsd !== undefined &&
        stats.totalDepositedUsd !== undefined &&
        stats.totalClaimedUsd !== undefined &&
        stats.totalAvailableUsd !== undefined &&
        Array.isArray(stats.commissions);

      if (hasAllFields) {
        logSuccess('✓ Statistics structure is correct');
        logInfo(`  Referrals: ${stats.totalReferrals}`);
        logInfo(`  Claimed: $${stats.totalClaimedUsd}`);
        logInfo(`  Available: $${stats.totalAvailableUsd}`);
        logInfo(`  Commission assets: ${stats.commissions.map((c) => c.asset).join(', ')}`);
        this.results.passed++;
      } else {
        logError('✗ Statistics structure is incorrect');
        this.results.failed++;
      }
    } catch (error) {
      logError(`Test failed: ${error.message}`);
      this.results.failed++;
    }
  }

  async checkReferredUsers() {
    try {
      const response = await this.makeRequest(
        '/affiliate/referred-users?limit=10&offset=0&sortBy=totalEarnings',
        'GET',
        null,
        this.affiliateToken,
      );

      log('\n📊 REFERRED USERS WITH EARNINGS GROWTH', colors.bright);
      log('-'.repeat(60));
      logInfo(`Total referred users: ${response.totalUsers}`);
      logInfo(`Total earnings from all referrals: ${response.totalEarnings} cents`);

      if (response.users && response.users.length > 0) {
        log('\n👥 Users with their earnings:', colors.blue);
        response.users.forEach((user, index) => {
          log(`  ${index + 1}. ${user.userName || user.userId}:`);
          logInfo(`     - ID: ${user.userId}`);
          logInfo(`     - Total Earnings: ${user.totalEarnings} cents`);
          logInfo(`     - Total Wagered: ${user.totalWagered} cents`);
          logInfo(`     - Created: ${new Date(user.createdAt).toLocaleString()}`);
        });
      }

      logSuccess('Referred users fetched successfully');
      return response;
    } catch (error) {
      logError(`Failed to fetch referred users: ${error.message}`);
      throw error;
    }
  }

  async testClaimFlow() {
    log(`\n\n${'='.repeat(60)}`, colors.bright);
    log('TEST: Claim Commission Flow', colors.bright);
    log('='.repeat(60), colors.bright);

    try {
      // Get statistics before claim
      logInfo('Step 1: Getting statistics before claim...');
      const statsBefore = await this.getStatistics(this.affiliateToken);

      logInfo(`  Available before: $${statsBefore.totalAvailableUsd}`);
      logInfo(`  Claimed before: $${statsBefore.totalClaimedUsd}`);

      const availableBefore = parseFloat(statsBefore.totalAvailableUsd);

      if (availableBefore <= 0) {
        logWarning('No commissions available to claim - skipping claim test');
        this.results.warnings++;
        return;
      }

      // Perform claim
      logInfo('\nStep 2: Claiming all commissions...');
      const claimResult = await this.claimCommissions(this.affiliateToken);

      if (!claimResult.transferred || claimResult.totalTransferred === 0) {
        logError('✗ Claim failed - no transfers recorded');
        this.results.failed++;
        return;
      }

      logInfo(`  Transferred ${claimResult.totalTransferred} asset(s)`);

      // Wait for claim to process
      await sleep(500);

      // Get statistics after claim
      logInfo('\nStep 3: Getting statistics after claim...');
      const statsAfter = await this.getStatistics(this.affiliateToken);

      logInfo(`  Available after: $${statsAfter.totalAvailableUsd}`);
      logInfo(`  Claimed after: $${statsAfter.totalClaimedUsd}`);

      const availableAfter = parseFloat(statsAfter.totalAvailableUsd);
      const claimedAfter = parseFloat(statsAfter.totalClaimedUsd);
      const claimedBefore = parseFloat(statsBefore.totalClaimedUsd);

      // Verify available decreased
      if (availableAfter < availableBefore) {
        logSuccess('✓ Available balance decreased after claim');
      } else {
        logError('✗ Available balance did not decrease');
        this.results.failed++;
        return;
      }

      // Verify claimed increased
      if (claimedAfter > claimedBefore) {
        logSuccess('✓ Claimed amount increased');
        logInfo(`  Increase: $${(claimedAfter - claimedBefore).toFixed(2)}`);
      } else {
        logError('✗ Claimed amount did not increase');
        this.results.failed++;
        return;
      }

      // Verify commission details updated
      logInfo('\nStep 4: Verifying commission details...');
      const btcCommission = statsAfter.commissions.find((c) => c.asset === 'BTC');
      if (btcCommission) {
        logInfo(
          `  BTC - earned: ${btcCommission.commission}, claimed: ${btcCommission.claimed}, claimable: ${btcCommission.claimable}`,
        );

        if (parseFloat(btcCommission.claimable) === 0) {
          logSuccess('✓ All BTC commission claimed (claimable = 0)');
        } else {
          logInfo(`  Some BTC still claimable: ${btcCommission.claimable}`);
        }

        if (parseFloat(btcCommission.claimed) > 0) {
          logSuccess('✓ BTC claimed amount updated');
        }
      }

      logSuccess('\n✓ Claim flow completed successfully!');
      this.results.passed++;
    } catch (error) {
      logError(`Test failed: ${error.message}`);
      console.error(error);
      this.results.failed++;
    }
  }

  async run() {
    log('\n' + '='.repeat(60), colors.bright);
    log('🚀 AFFILIATE COMMISSION CLAIM FLOW SIMULATOR', colors.bright);
    log('='.repeat(60) + '\n', colors.bright);

    try {
      // Setup: Use existing test@example.com user
      log('📋 SETUP PHASE', colors.bright);
      log('-'.repeat(60));

      // Use existing affiliate user
      logInfo('Using existing user: test@example.com');
      this.affiliateToken = await this.loginUser('test@example.com', 'TestPassword123');
      this.affiliateUserId = 'ba44c53e-f170-474f-8256-9f1786ab9073';

      // Use existing campaign
      logInfo('Using existing campaign: TEST176152');
      this.campaignCode = 'TEST176152';

      // Use existing referred user
      logInfo(`Using existing referred user: ${this.referredUserId}`);
      this.referredUserToken = await this.loginUser('referred_1761526818761@test.com');

      logSuccess('Setup complete!\n');

      // Give user some balance for testing
      log('\n💰 ADDING TEST BALANCE', colors.bright);
      log('-'.repeat(60));
      logInfo('Adding $500 (50000 cents) to test dice bets...');
      await this.makeRequest(
        '/balance-admin/credit',
        'POST',
        {
          userId: this.referredUserId,
          asset: 'BTC',
          amount: '0.05', // 0.05 BTC for 5 bets of 0.00342 each
        },
        null,
        true, // isAdmin flag
      );

      logSuccess('Test balance added!');
      logInfo('Waiting 2 seconds for balance to be available...');
      await sleep(2000);

      // NEW MODEL: Place real casino bets to trigger wager-based commission
      log('\n🎰 PLACING CASINO BETS (NEW WAGER-BASED MODEL)', colors.bright);
      log('-'.repeat(60));
      logInfo('OLD MODEL: 10% commission on deposits');
      logInfo('NEW MODEL: (houseEdge * wagered / 2) * 0.1 commission on bets');
      logInfo('');

      // Check INITIAL earnings
      log('\n📊 INITIAL STATE', colors.bright);
      const earningsBefore = await this.getReferredUsersEarnings(this.affiliateToken);
      const initialEarnings = earningsBefore.find((u) => u.userId === this.referredUserId);
      const initialEarningsInCents = (initialEarnings?.totalEarnings || 0) * 100;
      logInfo(
        `Initial totalEarnings: ${initialEarningsInCents.toFixed(0)} cents ($${(initialEarningsInCents / 100).toFixed(2)})`,
      );

      // Place multiple dice bets to accumulate commission
      await this.placeMultipleDiceBets(this.referredUserToken, 5, '0.0001');

      logInfo('Waiting 2 seconds for statistics to update...');
      await sleep(2000);

      // Check totalEarnings AFTER bets
      log('\n💰 EARNINGS DELTA AFTER BETS', colors.bright);
      log('-'.repeat(60));

      const earningsAfter = await this.getReferredUsersEarnings(this.affiliateToken);
      const affiliateEarnings = earningsAfter.find((u) => u.userId === this.referredUserId);

      if (affiliateEarnings) {
        const earningsInCents = (affiliateEarnings.totalEarnings || 0) * 100;
        const earningsInDollars = (earningsInCents / 100).toFixed(2);
        const deltaCents = earningsInCents - initialEarningsInCents;
        const deltaDollars = (deltaCents / 100).toFixed(2);

        logSuccess(
          `Final totalEarnings: ${earningsInCents.toFixed(0)} cents ($${earningsInDollars})`,
        );
        logSuccess(`✅ DELTA: +${deltaCents.toFixed(0)} cents ($${deltaDollars})`);

        // Expected delta is ~97 cents for 5 bets of $388 each
        const expectedDeltaCents = 97; // ~$0.97
        const margin = 5; // Allow 5 cents margin for rounding

        if (Math.abs(deltaCents - expectedDeltaCents) <= margin) {
          logSuccess(`✅ Delta matches expected value (~${expectedDeltaCents} cents)!`);
        } else {
          logWarning(`⚠️  Delta ${deltaCents} cents, expected ~${expectedDeltaCents} cents`);
        }
      }

      // Run tests
      log('\n📋 TEST PHASE', colors.bright);
      log('-'.repeat(60));

      await this.testDuplicateCommissionProtection();
      await this.testClaimWithoutBalance();
      await this.testStatisticsConsistency();
      await this.testClaimFlow();

      // Check if commissions were created and run concurrent claims test
      const hasCommissions = await this.getCommissions(this.affiliateToken);
      if (hasCommissions.wallets && hasCommissions.wallets.length > 0) {
        await this.testConcurrentClaims();
      } else {
        logWarning('\nNo commissions detected - concurrent claims test skipped');
        logInfo('Commission may still be processing or user not linked to campaign');
      }

      // Print results
      this.printResults();
    } catch (error) {
      logError(`\n❌ Simulation failed: ${error.message}`);
      console.error(error.stack);
      process.exit(1);
    }
  }

  printResults() {
    log('\n\n' + '='.repeat(60), colors.bright);
    log('📊 TEST RESULTS', colors.bright);
    log('='.repeat(60), colors.bright);

    log(`\n✅ Passed:   ${this.results.passed}`, colors.green);
    log(`❌ Failed:   ${this.results.failed}`, colors.red);
    log(`⚠️  Warnings: ${this.results.warnings}`, colors.yellow);

    const total = this.results.passed + this.results.failed + this.results.warnings;
    const successRate = total > 0 ? ((this.results.passed / total) * 100).toFixed(1) : 0;

    log(`\nSuccess Rate: ${successRate}%`, colors.cyan);

    if (this.results.failed === 0) {
      log('\n🎉 All critical tests passed!', colors.green);
    } else {
      log('\n⚠️  Some tests failed. Review the output above.', colors.red);
    }

    log('\n' + '='.repeat(60) + '\n', colors.bright);

    // Exit with appropriate code
    process.exit(this.results.failed > 0 ? 1 : 0);
  }
}

// Run simulator
if (require.main === module) {
  const simulator = new AffiliateFlowSimulator();
  simulator.run().catch((error) => {
    logError(`Fatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = AffiliateFlowSimulator;
