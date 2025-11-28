// Vault Simulator - Tests vault deposit/withdraw and isolation from main balance

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

  const result = await response.json().catch(() => ({}));

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

  const result = await response.json().catch(() => ({}));

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
const TEST_VAULT_AMOUNT = process.env.TEST_VAULT_AMOUNT || '0.00005'; // BTC amount
const TEST_ASSET = process.env.TEST_ASSET || 'BTC';

function uuidv4() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class VaultSimulator {
  constructor() {
    this.token = null;
    this.user = null;
    this.initialWallet = 0;
    this.initialVault = 0;
    this.afterDepositWallet = 0;
    this.afterDepositVault = 0;
    this.afterWithdrawWallet = 0;
    this.afterWithdrawVault = 0;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString().slice(11, 23);
    const prefix =
      {
        info: 'ℹ️',
        success: '✅',
        error: '❌',
        warning: '⚠️',
        setup: '🔧',
        balance: '💳',
        vault: '🗄️',
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
      this.log(`Authenticated as: ${this.user.email} (ID: ${this.user.id})`, 'success');
      return true;
    } catch (error) {
      this.log(`Authentication failed: ${error.message}`, 'error');
      return false;
    }
  }

  async readWalletAndVaultBalances() {
    try {
      const [walletsRes, vaultsRes] = await Promise.all([
        fetchGet(`${API_BASE}/balance/wallets`, { Authorization: `Bearer ${this.token}` }),
        fetchGet(`${API_BASE}/balance/vaults`, { Authorization: `Bearer ${this.token}` }),
      ]);

      const wallet = walletsRes.data.find((w) => w.asset === TEST_ASSET);
      const vault = vaultsRes.data.find((v) => v.asset === TEST_ASSET);
      return {
        wallet: wallet ? parseFloat(wallet.balance) : 0,
        vault: vault ? parseFloat(vault.balance) : 0,
      };
    } catch (error) {
      this.log(`Failed to read balances: ${error.message}`, 'error');
      throw error;
    }
  }

  async getInitialBalances() {
    this.log('Getting initial wallet and vault balances...', 'setup');
    try {
      const { wallet, vault } = await this.readWalletAndVaultBalances();
      this.initialWallet = wallet;
      this.initialVault = vault;
      this.log(`Initial ${TEST_ASSET} wallet: ${wallet}`, 'balance');
      this.log(`Initial ${TEST_ASSET} vault: ${vault}`, 'vault');
      return true;
    } catch {
      return false;
    }
  }

  async depositToVault() {
    this.log(`Depositing ${TEST_VAULT_AMOUNT} ${TEST_ASSET} to vault...`, 'vault');
    try {
      const body = {
        operationId: uuidv4(),
        asset: TEST_ASSET,
        amount: TEST_VAULT_AMOUNT,
      };
      await fetchPost(`${API_BASE}/balance/vault/deposit`, body, {
        Authorization: `Bearer ${this.token}`,
      });
      const { wallet, vault } = await this.readWalletAndVaultBalances();
      this.afterDepositWallet = wallet;
      this.afterDepositVault = vault;
      this.log(`After deposit - wallet: ${wallet}, vault: ${vault}`, 'balance');
      return true;
    } catch (error) {
      this.log(`Vault deposit failed: ${error.message}`, 'error');
      if (error.response?.data) {
        this.log(`Error details: ${JSON.stringify(error.response.data)}`, 'error');
      }
      return false;
    }
  }

  async withdrawFromVault() {
    this.log(`Withdrawing ${TEST_VAULT_AMOUNT} ${TEST_ASSET} from vault...`, 'vault');
    try {
      const body = {
        operationId: uuidv4(),
        asset: TEST_ASSET,
        amount: TEST_VAULT_AMOUNT,
      };
      await fetchPost(`${API_BASE}/balance/vault/withdraw`, body, {
        Authorization: `Bearer ${this.token}`,
      });
      const { wallet, vault } = await this.readWalletAndVaultBalances();
      this.afterWithdrawWallet = wallet;
      this.afterWithdrawVault = vault;
      this.log(`After withdraw - wallet: ${wallet}, vault: ${vault}`, 'balance');
      return true;
    } catch (error) {
      this.log(`Vault withdraw failed: ${error.message}`, 'error');
      if (error.response?.data) {
        this.log(`Error details: ${JSON.stringify(error.response.data)}`, 'error');
      }
      return false;
    }
  }

  verifyBalances() {
    const amt = parseFloat(TEST_VAULT_AMOUNT);
    const tol = 1e-9;

    const walletChangeDeposit = this.afterDepositWallet - this.initialWallet;
    const vaultChangeDeposit = this.afterDepositVault - this.initialVault;
    const walletChangeWithdraw = this.afterWithdrawWallet - this.afterDepositWallet;
    const vaultChangeWithdraw = this.afterWithdrawVault - this.afterDepositVault;

    const okDepositWallet = Math.abs(walletChangeDeposit + amt) < tol; // wallet decreased by amt
    const okDepositVault = Math.abs(vaultChangeDeposit - amt) < tol; // vault increased by amt
    const okWithdrawWallet = Math.abs(walletChangeWithdraw - amt) < tol; // wallet increased by amt
    const okWithdrawVault = Math.abs(vaultChangeWithdraw + amt) < tol; // vault decreased by amt

    if (!okDepositWallet)
      this.log(`Wallet change on deposit incorrect: ${walletChangeDeposit} vs -${amt}`, 'error');
    if (!okDepositVault)
      this.log(`Vault change on deposit incorrect: ${vaultChangeDeposit} vs +${amt}`, 'error');
    if (!okWithdrawWallet)
      this.log(`Wallet change on withdraw incorrect: ${walletChangeWithdraw} vs +${amt}`, 'error');
    if (!okWithdrawVault)
      this.log(`Vault change on withdraw incorrect: ${vaultChangeWithdraw} vs -${amt}`, 'error');

    return okDepositWallet && okDepositVault && okWithdrawWallet && okWithdrawVault;
  }

  async runTest() {
    this.log('🚀 Starting Vault Simulator Test', 'info');
    this.log('=====================================', 'info');

    const steps = [
      { name: 'Authentication', method: () => this.authenticate() },
      { name: 'Initial Balances', method: () => this.getInitialBalances() },
      { name: 'Deposit To Vault', method: () => this.depositToVault() },
      { name: 'Withdraw From Vault', method: () => this.withdrawFromVault() },
    ];

    let passed = 0;
    let failed = 0;

    for (const step of steps) {
      this.log(`\n--- ${step.name} ---`, 'info');
      const success = await step.method();
      if (success) {
        passed++;
        this.log(`✅ ${step.name} completed`, 'success');
      } else {
        failed++;
        this.log(`❌ ${step.name} failed`, 'error');
      }
    }

    const balancesOk = this.verifyBalances();
    if (balancesOk) {
      this.log('🎉 Vault flows verified: wallet and vault moved correctly', 'success');
    } else {
      this.log('❌ Vault flows incorrect', 'error');
    }

    this.log('\n=== Test Summary ===', 'info');
    this.log(`✅ Passed steps: ${passed}`, 'success');
    this.log(`❌ Failed steps: ${failed}`, failed > 0 ? 'error' : 'info');
    this.log(`Balances check: ${balancesOk ? 'OK' : 'FAILED'}`, balancesOk ? 'success' : 'error');
  }
}

// Run the test if called directly
if (require.main === module) {
  const simulator = new VaultSimulator();
  simulator.runTest().catch(console.error);
}

module.exports = VaultSimulator;
