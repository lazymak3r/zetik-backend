// Deposit Balance Simulator - Tests deposit functionality and balance updates

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
    const error = new Error(result.message?.message || result.message || 'Request failed');
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
    const error = new Error(result.message?.message || result.message || 'Request failed');
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

// Test settings
const TEST_DEPOSIT_AMOUNT = process.env.TEST_DEPOSIT_AMOUNT || '0.0001'; // BTC amount
const TEST_ASSET = process.env.TEST_ASSET || 'BTC';
const TEST_SECRET = 'Kx9mN7pQ2wR8vE5tY6uI3oP1aS4dF7gH9jK0lZ3xC6vB8nM2qW5e';

class DepositSimulator {
  constructor() {
    this.token = null;
    this.user = null;
    this.initialBalance = null;
    this.finalBalance = null;
    this.depositAddress = null; // Will be fetched from server
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString().slice(11, 23);
    const prefix =
      {
        info: 'ℹ️',
        success: '✅',
        error: '❌',
        warning: '⚠️',
        deposit: '💰',
        setup: '🔧',
        balance: '💳',
      }[type] || 'ℹ️';

    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async authenticate() {
    this.log('Authenticating user...', 'setup');

    try {
      const response = await fetchPost(`${API_BASE}/auth/login/email`, {
        email: TEST_USER.email,
        password: TEST_USER.password,
      });

      this.token = response.data.accessToken;
      this.user = response.data.user;
      this.log(`✅ Authenticated as: ${this.user.email} (ID: ${this.user.id})`, 'success');
      return true;
    } catch (error) {
      this.log(`❌ Authentication failed: ${error.message}`, 'error');
      if (error.response?.status === 401) {
        this.log('❌ Invalid credentials. Make sure test user is registered.', 'error');
      }
      return false;
    }
  }

  async getInitialBalance() {
    this.log('Getting initial balance...', 'setup');

    try {
      const response = await fetchGet(`${API_BASE}/balance/wallets`, {
        Authorization: `Bearer ${this.token}`,
      });

      const wallet = response.data.find((w) => w.asset === TEST_ASSET);
      if (!wallet) {
        this.log(`✅ No ${TEST_ASSET} wallet found (testing new user without wallet)`, 'balance');
        this.initialBalance = 0;
        return true;
      }

      this.initialBalance = parseFloat(wallet.balance);
      this.log(`Initial ${TEST_ASSET} balance: ${this.initialBalance}`, 'balance');
      return true;
    } catch (error) {
      this.log(`❌ Failed to get balance: ${error.message}`, 'error');
      return false;
    }
  }

  async getDepositAddress() {
    this.log('Getting deposit address...', 'setup');

    try {
      const response = await fetchGet(`${API_BASE}/payments/deposit-address?asset=${TEST_ASSET}`, {
        Authorization: `Bearer ${this.token}`,
      });

      this.depositAddress = response.data.address;
      this.log(`✅ Deposit address: ${this.depositAddress}`, 'success');
      return true;
    } catch (error) {
      this.log(`❌ Failed to get deposit address: ${error.message}`, 'error');
      return false;
    }
  }

  async simulateDeposit() {
    this.log(`Simulating deposit of ${TEST_DEPOSIT_AMOUNT} ${TEST_ASSET}...`, 'deposit');

    const depositData = {
      address: this.depositAddress,
      amount: TEST_DEPOSIT_AMOUNT,
      secret: TEST_SECRET,
    };

    this.log(
      `Calling test deposit endpoint with data: ${JSON.stringify(depositData, null, 2)}`,
      'info',
    );

    try {
      const response = await fetchPost(`${API_BASE}/payments/test-deposit`, depositData);

      this.log(`✅ Test deposit response: ${JSON.stringify(response, null, 2)}`, 'success');
      return true;
    } catch (error) {
      this.log(`❌ Deposit simulation failed: ${error.message}`, 'error');

      if (error.response?.data) {
        this.log(`Error details: ${JSON.stringify(error.response.data, null, 2)}`, 'error');
      }

      if (error.response?.status) {
        this.log(`HTTP Status: ${error.response.status}`, 'error');
      }

      // If test endpoint fails, try to get more detailed error info
      if (error.response?.data?.message?.message?.includes('failed_to_update_balance')) {
        this.log('🔍 This is the exact error we are investigating!', 'warning');
        this.log('📝 Error details to share with developer:', 'info');
        this.log(`   - User ID: ${this.user.id}`, 'info');
        this.log(`   - Deposit Address: ${this.depositAddress}`, 'info');
        this.log(`   - Amount: ${TEST_DEPOSIT_AMOUNT}`, 'info');
        this.log(`   - Asset: ${TEST_ASSET}`, 'info');
      }

      return false;
    }
  }

  async getFinalBalance() {
    this.log('Getting final balance...', 'balance');

    try {
      const response = await fetchGet(`${API_BASE}/balance/wallets`, {
        Authorization: `Bearer ${this.token}`,
      });

      const wallet = response.data.find((w) => w.asset === TEST_ASSET);
      if (!wallet) {
        this.log(`❌ No ${TEST_ASSET} wallet found after deposit`, 'error');
        return false;
      }

      this.finalBalance = parseFloat(wallet.balance);
      this.log(`Final ${TEST_ASSET} balance: ${this.finalBalance}`, 'balance');

      const expectedDeposit = parseFloat(TEST_DEPOSIT_AMOUNT);
      const actualChange = this.finalBalance - this.initialBalance;

      this.log(
        `Balance change: ${actualChange} (expected: +${expectedDeposit})`,
        actualChange > 0 ? 'success' : 'warning',
      );

      // Check if deposit was successful (balance increased by approximately the deposit amount)
      const tolerance = 0.00000001; // Small tolerance for floating point comparison
      const depositSuccessful = Math.abs(actualChange - expectedDeposit) < tolerance;

      if (depositSuccessful) {
        this.log(
          `✅ Deposit successful! Balance increased correctly by ${actualChange}`,
          'success',
        );
        return true;
      } else {
        if (actualChange === 0) {
          this.log(`❌ Balance did not increase - deposit failed or was not processed`, 'error');
        } else if (actualChange < expectedDeposit) {
          this.log(
            `❌ Balance increased by ${actualChange} but expected ${expectedDeposit} - partial deposit?`,
            'error',
          );
        } else {
          this.log(
            `❌ Balance increased by ${actualChange} but expected ${expectedDeposit} - unexpected amount`,
            'error',
          );
        }
        return false;
      }
    } catch (error) {
      this.log(`❌ Failed to get final balance: ${error.message}`, 'error');
      return false;
    }
  }

  async checkBalanceHistory() {
    this.log('Checking balance history...', 'balance');

    try {
      const response = await fetchGet(`${API_BASE}/balance/history?limit=10`, {
        Authorization: `Bearer ${this.token}`,
      });

      this.log(`Recent balance history entries: ${response.data.length}`, 'info');

      if (response.data.length > 0) {
        const latestEntry = response.data[0];
        this.log(`Latest entry: ${JSON.stringify(latestEntry, null, 2)}`, 'info');
      }

      return true;
    } catch (error) {
      this.log(`❌ Failed to get balance history: ${error.message}`, 'error');
      return false;
    }
  }

  async runTest() {
    this.log('🚀 Starting Deposit Simulator Test', 'info');
    this.log('=====================================', 'info');

    const steps = [
      { name: 'Authentication', method: () => this.authenticate() },
      { name: 'Get Initial Balance', method: () => this.getInitialBalance() },
      { name: 'Get Deposit Address', method: () => this.getDepositAddress() },
      { name: 'Simulate Deposit', method: () => this.simulateDeposit() },
      { name: 'Get Final Balance', method: () => this.getFinalBalance() },
      { name: 'Check Balance History', method: () => this.checkBalanceHistory() },
    ];

    let passed = 0;
    let failed = 0;
    let depositStepPassed = false;
    let balanceStepPassed = false;

    for (const step of steps) {
      this.log(`\n--- ${step.name} ---`, 'info');
      const success = await step.method();
      if (success) {
        passed++;
        this.log(`✅ ${step.name} completed`, 'success');

        if (step.name === 'Simulate Deposit') {
          depositStepPassed = true;
        }
        if (step.name === 'Get Final Balance') {
          balanceStepPassed = true;
        }
      } else {
        failed++;
        this.log(`❌ ${step.name} failed`, 'error');
        // Don't break - continue with remaining steps for debugging
      }
    }

    this.log('\n=== Test Summary ===', 'info');
    this.log(`✅ Passed: ${passed}`, 'success');
    this.log(`❌ Failed: ${failed}`, failed > 0 ? 'error' : 'info');

    if (this.initialBalance !== null && this.finalBalance !== null) {
      const expectedDeposit = parseFloat(TEST_DEPOSIT_AMOUNT);
      const actualChange = this.finalBalance - this.initialBalance;
      this.log(`Expected balance change: +${expectedDeposit}`, 'info');
      this.log(`Actual balance change: ${actualChange}`, 'info');

      if (Math.abs(actualChange - expectedDeposit) < 0.00000001) {
        this.log(`✅ Balance update successful!`, 'success');
      } else {
        this.log(
          `❌ Balance update failed - deposit did not increase balance as expected`,
          'error',
        );
      }
    }

    // Final verdict on the core functionality
    if (depositStepPassed && balanceStepPassed) {
      this.log('\n🎉 CORE TEST PASSED: Deposit and balance increase work correctly!', 'success');
    } else if (depositStepPassed && !balanceStepPassed) {
      this.log('\n⚠️  MIXED RESULTS: Deposit succeeded but balance verification failed', 'warning');
    } else if (!depositStepPassed && balanceStepPassed) {
      this.log('\n❌ DEPOSIT FAILED: But balance verification logic works', 'error');
    } else {
      this.log('\n❌ CORE TEST FAILED: Both deposit and balance verification failed', 'error');
    }
  }
}

// Run the test if called directly
if (require.main === module) {
  const simulator = new DepositSimulator();
  simulator.runTest().catch(console.error);
}

module.exports = DepositSimulator;
