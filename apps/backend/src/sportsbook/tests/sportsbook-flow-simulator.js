#!/usr/bin/env node

/**
 * Sportsbook Betting Flow Simulator
 *
 * Tests the sportsbook betting flow with affiliate commissions:
 * 1. Sportsbook bets are placed (balance deducted)
 * 2. Bets can be marked as WON or LOST
 * 3. Commission calculated ONLY after settlement (not on placement)
 * 4. Commission formula: (3% house edge * wagered / 2) * 0.1
 * 5. Canceled/refunded bets do NOT trigger commission
 *
 * Key differences from casino bets:
 * - ❌ Casino: Immediate commission on bet placement
 * - ✅ Sportsbook: Commission only after win/loss settlement
 * - Reason: Sportsbook bets can be cancelled before settlement
 *
 * Usage:
 *   node apps/backend/src/sportsbook/tests/sportsbook-flow-simulator.js
 *
 * Environment variables:
 *   API_URL - API base URL (default: http://localhost:4000/v1)
 */

const API_URL = process.env.API_URL || 'http://localhost:4000/v1';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin-secret-key';

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

class SportsbookFlowSimulator {
  constructor() {
    this.baseUrl = API_URL;
    this.adminSecret = ADMIN_SECRET;
    this.affiliateToken = null;
    this.affiliateUserId = null;
    this.referredUserToken = null;
    this.referredUserId = null;
    this.referredUserEmail = null;
    this.campaignCode = null;
    this.testBets = [];
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
      headers['x-simulator-secret'] = this.adminSecret;
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

  async registerUser(username, email, affiliateCampaignCode = null) {
    log(`\n📝 Registering user: ${username}`, colors.bright);
    const body = {
      username,
      email,
      password: 'Test123456!',
    };
    if (affiliateCampaignCode) {
      body.affiliateCampaignId = affiliateCampaignCode;
      logInfo(`Registering with referral code: ${affiliateCampaignCode}`);
    }
    const response = await this.makeRequest('/auth/register/email', 'POST', body);
    logSuccess(`Registered user: ${username} (ID: ${response.user.id})`);
    return response.user;
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

  async placeTestSportsbookBet(token, betAmount = '1.00', odds = '2.50') {
    log(`\n⚽ Placing test sportsbook bet`, colors.bright);
    logInfo(`Bet: $${betAmount} USD, Odds: ${odds}`);

    try {
      const response = await this.makeRequest(
        '/sportsbook/betby/test/place-bet',
        'POST',
        {
          betAmount: parseFloat(betAmount) * 100, // Convert USD to cents
          odds: parseFloat(odds),
        },
        token,
        true,
      );

      logSuccess(
        `Sportsbook bet placed! BetID: ${response.betId}, Amount: $${response.betAmount} USD`,
      );
      logInfo('Commission will be processed ONLY after settlement (not now)');

      return response;
    } catch (error) {
      logError(`Failed to place sportsbook bet: ${error.message}`);
      throw error;
    }
  }

  async markBetAsWon(betId, winAmount = '5.00') {
    log(`\n🎉 Marking bet as WON`, colors.bright);
    logInfo(`BetID: ${betId}, Win Amount: $${winAmount} USD`);

    try {
      const response = await this.makeRequest(
        '/sportsbook/betby/test/mark-won',
        'POST',
        {
          betId,
          winAmount: parseFloat(winAmount) * 100, // Convert USD to cents
        },
        null,
        true,
      );

      logSuccess(`Bet marked as WON! User received $${winAmount} USD`);
      logInfo('Commission should be processed now');
      await sleep(2000);

      return response;
    } catch (error) {
      logError(`Failed to mark bet as won: ${error.message}`);
      throw error;
    }
  }

  async markBetAsLost(betId) {
    log(`\n😢 Marking bet as LOST`, colors.bright);
    logInfo(`BetID: ${betId}`);

    try {
      const response = await this.makeRequest(
        '/sportsbook/betby/test/mark-lost',
        'POST',
        {
          betId,
        },
        null,
        true,
      );

      logSuccess(`Bet marked as LOST`);
      logInfo('Commission should be processed now');
      await sleep(2000);

      return response;
    } catch (error) {
      logError(`Failed to mark bet as lost: ${error.message}`);
      throw error;
    }
  }

  async getCommissions(token) {
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

  async getUserBalance(token) {
    const response = await this.makeRequest('/balance/fiat', 'GET', null, token);
    return parseFloat(response.balance || '0');
  }

  async testCommissionOnlyAfterSettlement() {
    log(`\n\n${'='.repeat(60)}`, colors.bright);
    log('TEST: Commission Only After Settlement', colors.bright);
    log('='.repeat(60), colors.bright);

    try {
      logInfo('Testing that commission is NOT paid on bet placement...');

      const statsBefore = await this.getStatistics(this.affiliateToken);
      const commissionBefore = parseFloat(statsBefore.totalAvailableUsd);

      const betAmount = 100.0;
      const balanceBefore = await this.getUserBalance(this.referredUserToken);
      logInfo(`Player balance before bet: $${balanceBefore.toFixed(2)}`);

      const bet = await this.placeTestSportsbookBet(
        this.referredUserToken,
        betAmount.toString(),
        '2.00',
      );
      this.testBets.push(bet.betId);

      await sleep(1000);
      const balanceAfterBet = await this.getUserBalance(this.referredUserToken);
      logInfo(`Player balance after bet: $${balanceAfterBet.toFixed(2)}`);

      const balanceDeducted = balanceBefore - balanceAfterBet;
      if (Math.abs(balanceDeducted - betAmount) < 0.1) {
        logSuccess(`✓ Balance correctly deducted: $${balanceDeducted.toFixed(2)}`);
        this.results.passed++;
      } else {
        logError(
          `✗ Balance deduction incorrect: expected $${betAmount}, got $${balanceDeducted.toFixed(2)}`,
        );
        this.results.failed++;
      }

      logInfo('Waiting 2 seconds to check if commission was added...');
      await sleep(2000);

      const statsAfterBet = await this.getStatistics(this.affiliateToken);
      const commissionAfterBet = parseFloat(statsAfterBet.totalAvailableUsd);

      if (commissionAfterBet === commissionBefore) {
        logSuccess('✓ Commission NOT added after bet placement (correct behavior)');
        this.results.passed++;
      } else {
        logError('✗ Commission was added after bet placement (incorrect)');
        this.results.failed++;
        return;
      }

      await this.markBetAsLost(bet.betId);

      logInfo('Waiting 2 seconds for commission to process...');
      await sleep(2000);

      const balanceAfterLoss = await this.getUserBalance(this.referredUserToken);
      logInfo(`Player balance after loss: $${balanceAfterLoss.toFixed(2)}`);

      if (Math.abs(balanceAfterLoss - balanceAfterBet) < 0.01) {
        logSuccess('✓ Balance unchanged after loss (bet amount already deducted)');
        this.results.passed++;
      } else {
        logError('✗ Balance changed unexpectedly after loss');
        this.results.failed++;
      }

      const statsAfterSettlement = await this.getStatistics(this.affiliateToken);
      const commissionAfterSettlement = parseFloat(statsAfterSettlement.totalAvailableUsd);

      if (commissionAfterSettlement > commissionAfterBet) {
        logSuccess('✓ Commission added after settlement (correct behavior)');
        logInfo(
          `  Before: $${commissionBefore} → After Bet: $${commissionAfterBet} → After Settlement: $${commissionAfterSettlement}`,
        );
        this.results.passed++;
      } else {
        logError('✗ Commission NOT added after settlement');
        this.results.failed++;
      }
    } catch (error) {
      logError(`Test failed: ${error.message}`);
      this.results.failed++;
    }
  }

  async testWonBetCommission() {
    log(`\n\n${'='.repeat(60)}`, colors.bright);
    log('TEST: Won Bet Commission Calculation', colors.bright);
    log('='.repeat(60), colors.bright);

    try {
      const betAmount = 200;
      const odds = '3.00';
      const expectedWin = betAmount * parseFloat(odds);

      const statsBefore = await this.getStatistics(this.affiliateToken);
      const commissionBefore = parseFloat(statsBefore.totalAvailableUsd);

      const balanceBefore = await this.getUserBalance(this.referredUserToken);
      logInfo(`Player balance before bet: $${balanceBefore.toFixed(2)}`);

      logInfo(`Placing $${betAmount} bet with odds ${odds}...`);
      const bet = await this.placeTestSportsbookBet(
        this.referredUserToken,
        betAmount.toString(),
        odds,
      );
      this.testBets.push(bet.betId);

      await sleep(1000);
      const balanceAfterBet = await this.getUserBalance(this.referredUserToken);
      logInfo(`Player balance after bet: $${balanceAfterBet.toFixed(2)}`);

      const balanceDeducted = balanceBefore - balanceAfterBet;
      if (Math.abs(balanceDeducted - betAmount) < 0.1) {
        logSuccess(`✓ Bet amount correctly deducted: $${balanceDeducted.toFixed(2)}`);
        this.results.passed++;
      } else {
        logError(
          `✗ Bet deduction incorrect: expected $${betAmount}, got $${balanceDeducted.toFixed(2)}`,
        );
        this.results.failed++;
      }

      await this.markBetAsWon(bet.betId, expectedWin.toString());

      logInfo('Waiting 2 seconds for win to process...');
      await sleep(2000);

      const balanceAfterWin = await this.getUserBalance(this.referredUserToken);
      logInfo(`Player balance after win: $${balanceAfterWin.toFixed(2)}`);

      const balanceIncrease = balanceAfterWin - balanceAfterBet;
      if (Math.abs(balanceIncrease - expectedWin) < 0.1) {
        logSuccess(`✓ Win amount correctly added: $${balanceIncrease.toFixed(2)}`);
        this.results.passed++;
      } else {
        logError(
          `✗ Win amount incorrect: expected $${expectedWin}, got $${balanceIncrease.toFixed(2)}`,
        );
        this.results.failed++;
      }

      const statsAfter = await this.getStatistics(this.affiliateToken);
      const commissionAfter = parseFloat(statsAfter.totalAvailableUsd);

      const expectedCommission = (0.03 * betAmount * 0.5 * 0.1).toFixed(2);
      const actualCommission = (commissionAfter - commissionBefore).toFixed(2);

      logInfo(`Expected commission: $${expectedCommission}`);
      logInfo(`Actual commission: $${actualCommission}`);

      const tolerance = 0.02;
      if (Math.abs(parseFloat(actualCommission) - parseFloat(expectedCommission)) < tolerance) {
        logSuccess('✓ Commission calculated correctly for won bet');
        this.results.passed++;
      } else {
        logError(`✗ Commission mismatch: expected ${expectedCommission}, got ${actualCommission}`);
        this.results.failed++;
      }
    } catch (error) {
      logError(`Test failed: ${error.message}`);
      this.results.failed++;
    }
  }

  async testLostBetCommission() {
    log(`\n\n${'='.repeat(60)}`, colors.bright);
    log('TEST: Lost Bet Commission Calculation', colors.bright);
    log('='.repeat(60), colors.bright);

    try {
      const betAmount = 150;
      const odds = '1.50';

      const statsBefore = await this.getStatistics(this.affiliateToken);
      const commissionBefore = parseFloat(statsBefore.totalAvailableUsd);

      const balanceBefore = await this.getUserBalance(this.referredUserToken);
      logInfo(`Player balance before bet: $${balanceBefore.toFixed(2)}`);

      logInfo(`Placing $${betAmount} bet with odds ${odds}...`);
      const bet = await this.placeTestSportsbookBet(
        this.referredUserToken,
        betAmount.toString(),
        odds,
      );
      this.testBets.push(bet.betId);

      await sleep(1000);
      const balanceAfterBet = await this.getUserBalance(this.referredUserToken);
      logInfo(`Player balance after bet: $${balanceAfterBet.toFixed(2)}`);

      const balanceDeducted = balanceBefore - balanceAfterBet;
      if (Math.abs(balanceDeducted - betAmount) < 0.1) {
        logSuccess(`✓ Bet amount correctly deducted: $${balanceDeducted.toFixed(2)}`);
        this.results.passed++;
      } else {
        logError(
          `✗ Bet deduction incorrect: expected $${betAmount}, got $${balanceDeducted.toFixed(2)}`,
        );
        this.results.failed++;
      }

      await this.markBetAsLost(bet.betId);

      logInfo('Waiting 2 seconds for commission to process...');
      await sleep(2000);

      const balanceAfterLoss = await this.getUserBalance(this.referredUserToken);
      logInfo(`Player balance after loss: $${balanceAfterLoss.toFixed(2)}`);

      if (Math.abs(balanceAfterLoss - balanceAfterBet) < 0.01) {
        logSuccess('✓ Balance unchanged after loss (bet amount already deducted)');
        this.results.passed++;
      } else {
        logError('✗ Balance changed unexpectedly after loss');
        this.results.failed++;
      }

      const statsAfter = await this.getStatistics(this.affiliateToken);
      const commissionAfter = parseFloat(statsAfter.totalAvailableUsd);

      const expectedCommission = (0.03 * betAmount * 0.5 * 0.1).toFixed(2);
      const actualCommission = (commissionAfter - commissionBefore).toFixed(2);

      logInfo(`Expected commission: $${expectedCommission}`);
      logInfo(`Actual commission: $${actualCommission}`);

      const tolerance = 0.02;
      if (Math.abs(parseFloat(actualCommission) - parseFloat(expectedCommission)) < tolerance) {
        logSuccess('✓ Commission calculated correctly for lost bet');
        this.results.passed++;
      } else {
        logError(`✗ Commission mismatch: expected ${expectedCommission}, got ${actualCommission}`);
        this.results.failed++;
      }
    } catch (error) {
      logError(`Test failed: ${error.message}`);
      this.results.failed++;
    }
  }

  async testMultipleBetsCommission() {
    log(`\n\n${'='.repeat(60)}`, colors.bright);
    log('TEST: Multiple Bets Commission Accumulation', colors.bright);
    log('='.repeat(60), colors.bright);

    try {
      const bets = [
        { amount: 100, odds: '2.00', result: 'WON', winAmount: 200 },
        { amount: 150, odds: '1.80', result: 'LOST' },
        { amount: 250, odds: '3.50', result: 'WON', winAmount: 875 },
      ];

      const statsBefore = await this.getStatistics(this.affiliateToken);
      const commissionBefore = parseFloat(statsBefore.totalAvailableUsd);

      let totalExpectedCommission = 0;

      for (const [index, betData] of bets.entries()) {
        logInfo(`\nPlacing bet ${index + 1}/${bets.length}: $${betData.amount} at ${betData.odds}`);
        const bet = await this.placeTestSportsbookBet(
          this.referredUserToken,
          betData.amount.toString(),
          betData.odds,
        );
        this.testBets.push(bet.betId);

        await sleep(500);

        if (betData.result === 'WON') {
          await this.markBetAsWon(bet.betId, betData.winAmount.toString());
        } else {
          await this.markBetAsLost(bet.betId);
        }

        const expectedCommission = 0.03 * betData.amount * 0.5 * 0.1;
        totalExpectedCommission += expectedCommission;

        await sleep(500);
      }

      logInfo('\nWaiting 2 seconds for all commissions to process...');
      await sleep(2000);

      const statsAfter = await this.getStatistics(this.affiliateToken);
      const commissionAfter = parseFloat(statsAfter.totalAvailableUsd);

      const actualCommission = (commissionAfter - commissionBefore).toFixed(2);
      const expectedCommission = totalExpectedCommission.toFixed(2);

      logInfo(`Expected total commission: $${expectedCommission}`);
      logInfo(`Actual total commission: $${actualCommission}`);

      const tolerance = 0.05;
      if (Math.abs(parseFloat(actualCommission) - parseFloat(expectedCommission)) < tolerance) {
        logSuccess('✓ Multiple bets commission accumulated correctly');
        this.results.passed++;
      } else {
        logError(`✗ Commission mismatch: expected ${expectedCommission}, got ${actualCommission}`);
        this.results.failed++;
      }
    } catch (error) {
      logError(`Test failed: ${error.message}`);
      this.results.failed++;
    }
  }

  async testClaimFlow() {
    log(`\n\n${'='.repeat(60)}`, colors.bright);
    log('TEST: Claim Sportsbook Commission', colors.bright);
    log('='.repeat(60), colors.bright);

    try {
      const statsBefore = await this.getStatistics(this.affiliateToken);
      const availableBefore = parseFloat(statsBefore.totalAvailableUsd);

      if (availableBefore <= 0) {
        logWarning('No commissions available to claim - skipping claim test');
        this.results.warnings++;
        return;
      }

      logInfo('\nClaiming all commissions...');
      const claimResult = await this.claimCommissions(this.affiliateToken);

      if (!claimResult.transferred || claimResult.totalTransferred === 0) {
        logError('✗ Claim failed - no transfers recorded');
        this.results.failed++;
        return;
      }

      await sleep(500);

      const statsAfter = await this.getStatistics(this.affiliateToken);
      const availableAfter = parseFloat(statsAfter.totalAvailableUsd);
      const claimedAfter = parseFloat(statsAfter.totalClaimedUsd);
      const claimedBefore = parseFloat(statsBefore.totalClaimedUsd);

      if (availableAfter < availableBefore) {
        logSuccess('✓ Available balance decreased after claim');
      } else {
        logError('✗ Available balance did not decrease');
        this.results.failed++;
        return;
      }

      if (claimedAfter > claimedBefore) {
        logSuccess('✓ Claimed amount increased');
        logInfo(`  Increase: $${(claimedAfter - claimedBefore).toFixed(2)}`);
        this.results.passed++;
      } else {
        logError('✗ Claimed amount did not increase');
        this.results.failed++;
      }
    } catch (error) {
      logError(`Test failed: ${error.message}`);
      this.results.failed++;
    }
  }

  async run() {
    log('\n' + '='.repeat(60), colors.bright);
    log('🚀 SPORTSBOOK BETTING FLOW SIMULATOR', colors.bright);
    log('='.repeat(60) + '\n', colors.bright);

    try {
      log('📋 SETUP PHASE', colors.bright);
      log('-'.repeat(60));

      logInfo('Using existing user: test@example.com');
      this.affiliateToken = await this.loginUser('test@example.com', 'TestPassword123');
      this.affiliateUserId = 'ba44c53e-f170-474f-8256-9f1786ab9073';

      logInfo('Using existing campaign: TEST176152');
      this.campaignCode = 'TEST176152';

      logInfo('Registering NEW referred user through affiliate campaign...');
      const timestamp = Date.now();
      this.referredUserEmail = `sportsbook_test_${timestamp}@test.com`;
      const referredUser = await this.registerUser(
        `sportsbook_${timestamp}`,
        this.referredUserEmail,
        this.campaignCode,
      );
      this.referredUserId = referredUser.id;
      this.referredUserToken = await this.loginUser(this.referredUserEmail);

      logSuccess(`Referred user registered with ID: ${this.referredUserId}`);
      logSuccess('Setup complete!\n');

      log('\n💰 ADDING TEST BALANCE', colors.bright);
      log('-'.repeat(60));
      logInfo('Adding $2000 USD to test sportsbook bets...');
      await this.makeRequest(
        '/balance-admin/credit',
        'POST',
        {
          userId: this.referredUserId,
          asset: 'BTC',
          amount: '0.02',
        },
        null,
        true,
      );

      logSuccess('Test balance added!');
      await sleep(2000);

      log('\n📋 TEST PHASE', colors.bright);
      log('-'.repeat(60));

      await this.testCommissionOnlyAfterSettlement();
      await this.testWonBetCommission();
      await this.testLostBetCommission();
      await this.testMultipleBetsCommission();
      await this.testClaimFlow();

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

    process.exit(this.results.failed > 0 ? 1 : 0);
  }
}

if (require.main === module) {
  const simulator = new SportsbookFlowSimulator();
  simulator.run().catch((error) => {
    logError(`Fatal error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = SportsbookFlowSimulator;
