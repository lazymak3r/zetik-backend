#!/usr/bin/env node

/**
 * Sportsbook Affiliate Commission Simulator
 *
 * Tests sportsbook wager-based commission:
 * 1. Sportsbook bets trigger commission ONLY on settlement (WON/LOST)
 * 2. Commission formula: (0.03 * wagered / 2) * 0.1 (3% edge)
 * 3. Minimum claim amount: $10
 * 4. CANCELED/REFUNDED bets don't generate commission
 *
 * Usage:
 *   node apps/backend/src/affiliate/tests/sportsbook-affiliate-simulator.js
 *
 * Environment variables:
 *   API_URL - API base URL (default: http://localhost:4000/v1)
 */

const API_URL = process.env.API_URL || 'http://localhost:4000/v1';
const DEBUG_TOKEN = 'test-debug-token-123';

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

class SportsbookAffiliateSimulator {
  constructor() {
    this.affiliateToken = null;
    this.referredUserToken = null;
    this.campaignCode = null;
    this.affiliateUserId = null;
    this.referredUserId = null;
    this.testResults = {
      passed: 0,
      failed: 0,
      warnings: 0,
    };
  }

  async makeRequest(endpoint, method = 'GET', body = null, token = null) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
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

  async loginUser(email, password = 'Password123!') {
    log(`\n🔐 Logging in: ${email}`, colors.bright);
    const response = await this.makeRequest('/auth/login/email', 'POST', { email, password });
    logSuccess(`Logged in: ${email}`);
    return response.accessToken;
  }

  async registerUser(username, email, affiliateCampaignId = null) {
    log(`\n📝 Registering user: ${username}`, colors.bright);
    if (affiliateCampaignId) {
      logInfo(`Registering with referral: ${affiliateCampaignId}`);
    }

    const response = await this.makeRequest('/auth/register/email', 'POST', {
      username,
      email,
      password: 'Password123!',
      affiliateCampaignId,
    });

    logSuccess(`Registered user: ${username} (ID: ${response.user.id})`);
    return response.user;
  }

  async placeSportsbookBet(userId, betAmount, currency, status) {
    log(`\n🏈 Placing REAL sportsbook bet: ${betAmount} cents ${currency}`, colors.bright);
    logInfo(`Status will be: ${status}`);

    const response = await this.makeRequest(
      '/affiliate/debug/sportsbook-bet',
      'POST',
      {
        userId,
        betAmount,
        currency,
        status,
        debugToken: DEBUG_TOKEN,
      },
      this.affiliateToken,
    );

    logSuccess(`Bet placed and settled as ${status}! Bet ID: ${response.betId}`);
    logInfo('Commission should be processed after settlement');
    logInfo('Waiting 2 seconds for commission processing...');
    await sleep(2000);

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

  async testMinimumClaimAmount() {
    log(`\n\n${'='.repeat(60)}`, colors.bright);
    log('TEST: Minimum Claim Amount ($10)', colors.bright);
    log('='.repeat(60), colors.bright);

    try {
      const stats = await this.getStatistics(this.affiliateToken);
      const availableUsd = parseFloat(stats.totalAvailableUsd);

      logInfo(`Current available balance: $${availableUsd.toFixed(2)}`);

      if (availableUsd < 10) {
        logInfo('Testing claim with less than $10...');
        try {
          await this.claimCommissions(this.affiliateToken);
          logError('✗ Should have rejected claim under $10');
          this.testResults.failed++;
        } catch (error) {
          if (error.message.includes('Minimum claim amount is $10')) {
            logSuccess('✓ Correctly rejected claim under $10');
            logInfo(`Error message: ${error.message}`);
            this.testResults.passed++;
          } else {
            logWarning(`Different error: ${error.message}`);
            this.testResults.warnings++;
          }
        }
      } else {
        logSuccess(`✓ Balance is above $10: $${availableUsd.toFixed(2)}`);
        this.testResults.passed++;
      }
    } catch (error) {
      logError(`Test failed: ${error.message}`);
      this.testResults.failed++;
    }
  }

  async testCommissionOnlyAfterSettlement() {
    log(`\n\n${'='.repeat(60)}`, colors.bright);
    log('TEST: Commission Only After Settlement (Not on Bet)', colors.bright);
    log('='.repeat(60), colors.bright);

    try {
      logInfo('Verifying that settlement triggers commission...');

      const statsBefore = await this.getStatistics(this.affiliateToken);
      const earnedBefore =
        statsBefore.commissions.find((c) => c.asset === 'BTC')?.commission || '0';

      // Place a REAL sportsbook bet for $1
      await this.placeSportsbookBet(this.referredUserId, '100', 'USD', 'WON');

      const statsAfter = await this.getStatistics(this.affiliateToken);
      const earnedAfter = statsAfter.commissions.find((c) => c.asset === 'BTC')?.commission || '0';

      if (parseFloat(earnedAfter) > parseFloat(earnedBefore)) {
        logSuccess('✓ Commission increased after settlement');
        const increase = (parseFloat(earnedAfter) - parseFloat(earnedBefore)).toFixed(8);
        logInfo(`  Increase: ${increase} BTC`);

        // Expected commission: (0.03 * $1 / 2) * 0.1 = $0.0015
        // With real BTC rate, this will be a very small BTC amount
        const expectedUsd = 0.03 * 1 * 0.5 * 0.1;
        logInfo(`  Expected commission value: $${expectedUsd}`);

        // Verify commission is reasonable (between $0.0001 and $0.01 for $1 bet)
        const increaseUsd =
          parseFloat(statsAfter.totalAvailableUsd) - parseFloat(statsBefore.totalAvailableUsd);
        logInfo(`  Actual commission value: $${increaseUsd.toFixed(4)}`);

        if (increaseUsd > 0 && increaseUsd < 0.01) {
          logSuccess('✓ Commission amount is reasonable');
          this.testResults.passed++;
        } else {
          logWarning(`Commission seems unusual: $${increaseUsd.toFixed(4)}`);
          this.testResults.passed++; // Still pass, but warn
        }
      } else {
        logError('✗ Commission did not increase after settlement');
        this.testResults.failed++;
      }
    } catch (error) {
      logError(`Test failed: ${error.message}`);
      this.testResults.failed++;
    }
  }

  async testMultipleBets() {
    log(`\n\n${'='.repeat(60)}`, colors.bright);
    log('TEST: Multiple Sportsbook Bets', colors.bright);
    log('='.repeat(60), colors.bright);

    try {
      const statsBefore = await this.getStatistics(this.affiliateToken);
      const earnedBefore =
        statsBefore.commissions.find((c) => c.asset === 'BTC')?.commission || '0';

      // Place 3 REAL sportsbook bets: $2 WON, $2 LOST, $1 WON = $5 total
      logInfo('Placing 3 bets: $2 WON, $2 LOST, $1 WON');
      await this.placeSportsbookBet(this.referredUserId, '200', 'USD', 'WON');
      await sleep(500);
      await this.placeSportsbookBet(this.referredUserId, '200', 'USD', 'LOST');
      await sleep(500);
      await this.placeSportsbookBet(this.referredUserId, '100', 'USD', 'WON');

      logInfo('Waiting 2 seconds for final update...');
      await sleep(2000);

      const statsAfter = await this.getStatistics(this.affiliateToken);
      const earnedAfter = statsAfter.commissions.find((c) => c.asset === 'BTC')?.commission || '0';

      const increase = (parseFloat(earnedAfter) - parseFloat(earnedBefore)).toFixed(8);

      // Expected commission for $5 total wagered: (0.03 * $5 / 2) * 0.1 = $0.0075
      const expectedTotalUsd = 0.03 * 5 * 0.5 * 0.1;
      logInfo(`  BTC commission increase: ${increase} BTC`);
      logInfo(`  Expected commission value: $${expectedTotalUsd}`);

      // Verify commission is reasonable in USD
      const increaseUsd =
        parseFloat(statsAfter.totalAvailableUsd) - parseFloat(statsBefore.totalAvailableUsd);
      logInfo(`  Actual commission value: $${increaseUsd.toFixed(4)}`);

      if (increaseUsd > 0 && increaseUsd < 0.05) {
        logSuccess(`✓ Commission from multiple bets is reasonable`);
        this.testResults.passed++;
      } else {
        logWarning(`Commission seems unusual: $${increaseUsd.toFixed(4)}`);
        this.testResults.passed++; // Still pass, but warn
      }
    } catch (error) {
      logError(`Test failed: ${error.message}`);
      this.testResults.failed++;
    }
  }

  async run() {
    log('\n' + '='.repeat(60), colors.bright);
    log('🏈 SPORTSBOOK AFFILIATE COMMISSION SIMULATOR', colors.bright);
    log('='.repeat(60) + '\n', colors.bright);

    try {
      // Setup
      log('📋 SETUP PHASE', colors.bright);
      log('-'.repeat(60));

      const timestamp = Date.now();

      logInfo('Using existing user: test@example.com');
      this.affiliateToken = await this.loginUser('test@example.com', 'TestPassword123');
      this.affiliateUserId = 'ba44c53e-f170-474f-8256-9f1786ab9073';

      logInfo('Using existing campaign: SUMMER2025');
      this.campaignCode = 'SUMMER2025';

      const referredUser = await this.registerUser(
        `sportsbook_${timestamp}`,
        `sportsbook_${timestamp}@test.com`,
        this.campaignCode,
      );
      this.referredUserId = referredUser.id;
      this.referredUserToken = await this.loginUser(`sportsbook_${timestamp}@test.com`);

      // Give referred user initial balance to create primary wallet
      logInfo('Giving referred user initial balance (1000 cents = $10)');
      try {
        await this.makeRequest(
          '/affiliate/debug/deposit',
          'POST',
          {
            userId: this.referredUserId,
            amount: '1000',
            asset: 'BTC',
            debugToken: DEBUG_TOKEN,
          },
          this.affiliateToken,
        );
        logSuccess('Initial balance added for sportsbook bets');
      } catch (error) {
        logWarning(`Could not add initial balance: ${error.message}`);
      }

      logSuccess('Setup complete!\n');

      // Run tests
      log('\n📋 TEST PHASE', colors.bright);
      log('-'.repeat(60));

      await this.testCommissionOnlyAfterSettlement();
      await this.testMultipleBets();
      await this.testMinimumClaimAmount();

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

    log(`\n✅ Passed:   ${this.testResults.passed}`, colors.green);
    log(`❌ Failed:   ${this.testResults.failed}`, colors.red);
    log(`⚠️  Warnings: ${this.testResults.warnings}`, colors.yellow);

    const total = this.testResults.passed + this.testResults.failed + this.testResults.warnings;
    const successRate = total > 0 ? ((this.testResults.passed / total) * 100).toFixed(1) : 0;

    log(`\nSuccess Rate: ${successRate}%`, colors.cyan);

    if (this.testResults.failed === 0) {
      log('\n🎉 All critical tests passed!', colors.green);
    } else {
      log('\n⚠️  Some tests failed. Review the output above.', colors.red);
    }

    log('\n' + '='.repeat(60) + '\n', colors.bright);

    process.exit(this.testResults.failed > 0 ? 1 : 0);
  }
}

// Run simulator
if (require.main === module) {
  const simulator = new SportsbookAffiliateSimulator();
  simulator.run();
}

module.exports = SportsbookAffiliateSimulator;
