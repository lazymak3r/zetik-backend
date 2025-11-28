/**
 * AFFILIATE COMMISSION REAL-TIME SIMULATOR
 *
 * Tests direct commission accumulation to affiliate wallets.
 * No intermediate pending table - commissions are written directly to affiliate_wallets.
 *
 * AFFILIATE COMMISSION CALCULATION EXAMPLE - DO NOT MODIFY
 *
 * Formula: (bet_amount * house_edge / 2) * commission_rate
 *
 * Example:
 * - Bet amount: $388.10
 * - House edge: 1% (0.01)
 * - Expected profit: 388.10 * 0.01 / 2 = $1.9405
 * - Commission (10%): 1.9405 * 0.1 = $0.19405
 *
 * Test: Place $388 bet → Expect $0.19405 commission (instant)
 */

const API_URL = process.env.API_URL || 'http://localhost:4000/v1';
const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET || 'admin-secret-key';

// Test configuration
const TEST_BET_AMOUNT_USD = 388; // DO NOT MODIFY - used for commission validation

// Database findings
const AFFILIATE_EMAIL = process.env.AFFILIATE_EMAIL || 'test@example.com';
const AFFILIATE_PASSWORD = process.env.AFFILIATE_PASSWORD || 'TestPassword123';

// Single referred user for testing
const REFERRED_USER_EMAIL = process.env.REFERRED_USER_EMAIL || 'participant@test.com';
const REFERRED_USER_PASSWORD = process.env.REFERRED_USER_PASSWORD || 'TestPassword123';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = colors.reset) {
  const timestamp = new Date().toISOString().slice(11, 23);
  console.log(`${color}[${timestamp}] ${message}${colors.reset}`);
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

function logBet(message) {
  log(`💰 ${message}`, colors.magenta);
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class AffiliatePendingCommissionsSimulator {
  constructor() {
    this.affiliateToken = null;
    this.referredUserToken = null;
    this.btcPrice = null;
  }

  async makeRequest(endpoint, method = 'GET', body = null, token = null, isAdmin = false) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (isAdmin) {
      headers['x-admin-secret'] = ADMIN_API_SECRET;
    }

    const options = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, options);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${JSON.stringify(data)}`);
      }

      return data;
    } catch (error) {
      logError(`Request failed: ${error.message}`);
      throw error;
    }
  }

  async getBtcPrice() {
    logInfo('Fetching BTC price...');
    try {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
      );
      const data = await response.json();
      this.btcPrice = parseFloat(data.bitcoin.usd);
      logSuccess(`BTC price: $${this.btcPrice.toLocaleString()}`);
    } catch (error) {
      logWarning(`Failed to fetch BTC price (using default): ${error.message}`);
      this.btcPrice = 100000;
      logInfo(`Using fallback BTC price: $${this.btcPrice}`);
    }
  }

  async loginAffiliate() {
    logInfo(`Logging in affiliate: ${AFFILIATE_EMAIL}`);
    try {
      const response = await this.makeRequest('/auth/login/email', 'POST', {
        email: AFFILIATE_EMAIL,
        password: AFFILIATE_PASSWORD,
      });
      this.affiliateToken = response.accessToken;
      this.affiliateId = response.user.id;
      logSuccess(`Affiliate logged in: ${this.affiliateId}`);
    } catch (error) {
      logError(`Failed to login affiliate: ${error.message}`);
      throw error;
    }
  }

  async loginReferredUser() {
    logInfo(`Logging in referred user: ${REFERRED_USER_EMAIL}`);
    try {
      const response = await this.makeRequest('/auth/login/email', 'POST', {
        email: REFERRED_USER_EMAIL,
        password: REFERRED_USER_PASSWORD,
      });
      this.referredUserToken = response.accessToken;
      this.referredUserId = response.user.id;
      logSuccess(`Referred user logged in: ${this.referredUserId}`);
    } catch (error) {
      logError(`Failed to login referred user: ${error.message}`);
      throw error;
    }
  }

  async placeBet(betAmount) {
    logBet(`Placing bet: ${betAmount} BTC`);
    try {
      const response = await this.makeRequest(
        '/games/dice/bet',
        'POST',
        {
          betType: 'ROLL_OVER',
          targetNumber: 50,
          betAmount: betAmount,
        },
        this.referredUserToken,
      );
      const usdValue = (parseFloat(betAmount) * this.btcPrice).toFixed(2);
      logSuccess(`Bet placed: ${response.betAmount} BTC ≈ $${usdValue}`);
      return response;
    } catch (error) {
      logError(`Failed to place bet: ${error.message}`);
      throw error;
    }
  }

  async getAffiliateStats() {
    logInfo('Fetching affiliate statistics...');
    try {
      const response = await this.makeRequest(
        '/affiliate/statistics',
        'GET',
        null,
        this.affiliateToken,
      );
      logInfo(`Total Available: $${response.totalAvailableUsd || '0'}`);
      if (response.commissions && response.commissions.length > 0) {
        logInfo('Commissions by asset:');
        response.commissions.forEach((c) => {
          logInfo(`  ${c.asset}: ${c.claimable} (claimable)`);
        });
      }
      return response;
    } catch (error) {
      logError(`Failed to get statistics: ${error.message}`);
      throw error;
    }
  }

  async run() {
    try {
      logInfo('╔════════════════════════════════════════════════════════╗');
      logInfo('║   Affiliate Commission Real-Time Simulator             ║');
      logInfo('╚════════════════════════════════════════════════════════╝\n');

      await this.getBtcPrice();
      await this.loginAffiliate();
      await this.loginReferredUser();

      logInfo('\n📊 STEP 1: Get initial affiliate stats');
      const initialStats = await this.getAffiliateStats();

      logInfo('\n💰 STEP 2: Place bet to accumulate commissions');
      const betAmount = (TEST_BET_AMOUNT_USD / this.btcPrice).toFixed(8);
      const expectedCommission = (((TEST_BET_AMOUNT_USD * 0.01) / 2) * 0.1).toFixed(5);
      logInfo(`  Test bet: $${TEST_BET_AMOUNT_USD}`);
      logInfo(`  Expected commission: $${expectedCommission}`);

      await this.placeBet(betAmount);
      logSuccess('  ✅ Bet placed successfully');

      logInfo('\n⏳ STEP 3: Checking real-time commission (written directly to wallet)...');
      logInfo('  Commission is accumulated instantly in affiliate wallet');
      await sleep(1000); // Just 1 second - commission is already there

      logInfo('\n📊 STEP 4: Get final affiliate stats (should show increased balance)');
      const finalStats = await this.getAffiliateStats();

      logInfo('\n═══════════════════════════════════════════════════════');
      logInfo('📊 COMPARISON: INITIAL vs FINAL');
      logInfo('═══════════════════════════════════════════════════════');
      const initialAvailable = parseFloat(initialStats.totalAvailableUsd || '0');
      const finalAvailable = parseFloat(finalStats.totalAvailableUsd || '0');
      const delta = finalAvailable - initialAvailable;
      const expectedFinalCommission = parseFloat(
        (((TEST_BET_AMOUNT_USD * 0.01) / 2) * 0.1).toFixed(5),
      );

      logInfo(`Initial Available: $${initialAvailable.toFixed(5)}`);
      logInfo(`Final Available:   $${finalAvailable.toFixed(5)}`);
      logInfo(`Delta:             $${delta.toFixed(5)} ${delta > 0 ? '✅' : '❌'}`);
      logInfo(`Expected:          $${expectedFinalCommission.toFixed(5)}`);

      const difference = Math.abs(delta - expectedFinalCommission);
      if (delta > 0 && difference < 0.0001) {
        logSuccess('✅ Commission successfully transferred to affiliate wallet!');
        logSuccess(`✅ Commission amount matches expected: $${expectedFinalCommission.toFixed(5)}`);
      } else if (delta > 0) {
        logWarning(
          `⚠️  Commission transferred but amount mismatch: expected $${expectedFinalCommission.toFixed(5)}, got $${delta.toFixed(5)} (diff: $${difference.toFixed(5)})`,
        );
      } else {
        logWarning('⚠️  No balance increase detected');
      }

      logInfo('\n═══════════════════════════════════════════════════════');
      logSuccess('Simulator completed successfully!');
    } catch (error) {
      logError(`Simulator failed: ${error.message}`);
      process.exit(1);
    }
  }
}

// Run simulator
const simulator = new AffiliatePendingCommissionsSimulator();
simulator.run().catch((error) => {
  logError(`Fatal error: ${error.message}`);
  process.exit(1);
});
