#!/usr/bin/env node

// Using built-in fetch API (Node 18+)

// Configuration
const API_BASE = process.env.TEST_BACKEND_URL || 'http://localhost:3000';
const SIMULATOR_SECRET = process.env.VIP_SIMULATOR_SECRET || 'dev-secret-123';
const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET || 'admin-secret-key';

// User credentials - USER MUST BE REGISTERED BEFORE RUNNING TESTS
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'TestPassword123',
};

class WeeklyReloadClientSimulator {
  constructor() {
    this.token = null;
    this.user = null;
    this.currentBalance = 0;
    this.primaryWallet = null;
    this.vipStatus = null;
    this.results = {};
    this.weeklyReloadResults = {};
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0,
        v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
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
        reload: '🔄',
        bet: '💰',
        bonus: '🎁',
        admin: '👨‍💼',
      }[type] || 'ℹ️';

    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...(endpoint.includes('simulator') && { 'x-simulator-secret': SIMULATOR_SECRET }),
      ...(endpoint.includes('-admin') && { 'x-simulator-secret': ADMIN_API_SECRET }),
    };
    const options = { method, headers };
    if (data) options.body = JSON.stringify(data);
    const response = await fetch(url, options);
    const respData = await response.json().catch(() => null);
    if (!response.ok) {
      const msg = respData?.message || respData;
      throw new Error(`${response.status}: ${JSON.stringify(msg)}`);
    }
    return respData;
  }

  async authenticateUser() {
    this.log('Authenticating user...', 'info');
    try {
      const response = await this.makeRequest('/v1/auth/login/email', 'POST', TEST_USER);
      this.token = response.accessToken;
      this.user = response.user;
      this.log(`✅ User authenticated: ${this.user.email}`, 'success');
      return true;
    } catch (error) {
      this.log(`❌ User authentication failed: ${error.message}`, 'error');
      return false;
    }
  }

  async getUserBalance() {
    try {
      const wallets = await this.makeRequest('/v1/balance/wallets');
      // Find primary wallet or first available wallet
      this.primaryWallet = wallets.find((w) => w.isPrimary) || wallets[0];
      this.currentBalance = this.primaryWallet ? parseFloat(this.primaryWallet.balance) : 0;
      return this.currentBalance;
    } catch (error) {
      this.log(`❌ Failed to get balance: ${error.message}`, 'error');
      return 0;
    }
  }

  async resetUserStats() {
    this.log('Resetting user stats...', 'info');
    try {
      await this.makeRequest('/v1/vip-bonus-simulator/reset-user-stats', 'POST', {
        userId: this.user.id,
      });
      this.log('✅ User stats reset successfully', 'success');
      return true;
    } catch (error) {
      this.log(`❌ Failed to reset user stats: ${error.message}`, 'error');
      return false;
    }
  }

  async simulateGameSession(wagerCents, winCents) {
    this.log(
      `Simulating game session: Wager $${(wagerCents / 100).toLocaleString()}, Win $${(winCents / 100).toLocaleString()}`,
      'bet',
    );

    try {
      const games = [
        {
          betAmount: wagerCents.toString(),
          winAmount: winCents.toString(),
        },
      ];

      const response = await this.makeRequest(
        '/v1/vip-bonus-simulator/simulate-game-session',
        'POST',
        {
          userId: this.user.id,
          games,
        },
      );

      this.log(`✅ Game session completed: ${response.message}`, 'success');
      return response;
    } catch (error) {
      this.log(`❌ Game session failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async checkWeeklyReloadStatus() {
    this.log('Checking weekly reload status...', 'reload');
    try {
      const status = await this.makeRequest(
        `/v1/weekly-reload-admin/status/${this.user.id}`,
        'GET',
      );

      if (status.hasActive) {
        this.log(
          `🔄 Active weekly reload found: ${status.activeBonuses} bonuses, expires ${new Date(status.expirationDate).toLocaleDateString()}`,
          'reload',
        );
      } else {
        this.log('🔄 No active weekly reload found', 'reload');
      }

      return status;
    } catch (error) {
      this.log(`❌ Failed to check weekly reload status: ${error.message}`, 'error');
      return { hasActive: false };
    }
  }

  async activateWeeklyReload() {
    this.log('Activating weekly reload via admin controller...', 'admin');
    try {
      const result = await this.makeRequest(
        `/v1/weekly-reload-admin/activate/${this.user.id}`,
        'POST',
        { adminId: 'simulator-admin' },
      );

      this.log(`✅ Weekly reload activated successfully!`, 'success');
      this.log(`   💰 Total amount: $${result.totalAmount}`, 'bonus');
      this.log(`   📅 Daily amount: $${result.dailyAmount}`, 'bonus');
      this.log(`   🗓️ Expires: ${new Date(result.expirationDate).toLocaleDateString()}`, 'bonus');
      this.log(`   🎁 Bonuses created: ${result.bonusesCreated}`, 'bonus');

      return result;
    } catch (error) {
      this.log(`❌ Failed to activate weekly reload: ${error.message}`, 'error');
      throw error;
    }
  }

  async getUserBonuses() {
    this.log('Fetching user bonuses...', 'bonus');
    try {
      const bonuses = await this.makeRequest('/bonus?statuses=PENDING');
      const weeklyReloadBonuses = bonuses.data.filter((b) => b.bonusType === 'WEEKLY_RELOAD');

      this.log(
        `📊 Total bonuses: ${bonuses.data.length}, Weekly reload: ${weeklyReloadBonuses.length}`,
        'bonus',
      );

      return { all: bonuses.data, weeklyReload: weeklyReloadBonuses };
    } catch (error) {
      this.log(`❌ Failed to fetch bonuses: ${error.message}`, 'error');
      return { all: [], weeklyReload: [] };
    }
  }

  async getWeeklyReloadBonuses() {
    this.log('Fetching available weekly reload bonuses...', 'reload');
    try {
      const bonuses = await this.makeRequest('/v1/weekly-reload/bonuses');
      this.log(`🎁 Available weekly reload bonuses: ${bonuses.data.length}`, 'reload');

      bonuses.data.forEach((bonus, index) => {
        const activateDate = new Date(bonus.activateAt).toLocaleString();
        const expireDate = new Date(bonus.expiredAt).toLocaleString();
        this.log(
          `   ${index + 1}. $${bonus.amount} (Day ${bonus.metadata?.dayNumber}/7) - Available: ${activateDate}, Expires: ${expireDate}`,
          'bonus',
        );
      });

      return bonuses.data;
    } catch (error) {
      this.log(`❌ Failed to fetch weekly reload bonuses: ${error.message}`, 'error');
      return [];
    }
  }

  async claimWeeklyReloadBonus(bonusId) {
    this.log('Claiming weekly reload bonus...', 'bonus');
    try {
      const result = await this.makeRequest(`/v1/weekly-reload/claim/${bonusId}`, 'POST');
      this.log(
        `✅ Weekly reload bonus claimed: $${result.amount} (Day ${result.metadata?.dayNumber}/7)`,
        'success',
      );
      return result;
    } catch (error) {
      this.log(`❌ Failed to claim weekly reload bonus: ${error.message}`, 'error');
      throw error;
    }
  }

  async getVipStatus() {
    try {
      const vip = await this.makeRequest('/v1/bonus/vip-status');
      this.log(
        `📊 VIP Status: Level ${vip.currentLevel || 0}, Wager: $${((vip.currentWager || 0) / 100).toLocaleString()}`,
        'info',
      );
      return vip;
    } catch (error) {
      this.log(`❌ Failed to get VIP status: ${error.message}`, 'error');
      return { currentLevel: 0, currentWager: 0 };
    }
  }

  async ensureVipAtLeast(minLevel) {
    this.log(`Ensuring VIP level at least ${minLevel}...`, 'info');
    const vip = await this.getVipStatus();
    if ((vip.currentLevel || 0) >= minLevel) {
      this.log(`✅ Already at VIP level ${vip.currentLevel}`, 'success');
      return { success: true };
    }

    // For simplicity, just create a large wager to reach the required level
    this.log(`📈 Creating large wager to reach VIP level ${minLevel}...`, 'bet');
    const largeWager = 1000000000; // $10M in cents
    const largeWin = 950000000; // $9.5M in cents

    await this.simulateGameSession(largeWager, largeWin);
    await new Promise((r) => setTimeout(r, 500));

    const newVip = await this.getVipStatus();
    if ((newVip.currentLevel || 0) >= minLevel) {
      this.log(`✅ Reached VIP level ${newVip.currentLevel}`, 'success');
      return { success: true };
    } else {
      this.log(`⚠️ Still at VIP level ${newVip.currentLevel}, may need more wager`, 'warning');
      return { success: false };
    }
  }

  async testWeeklyReloadFlow() {
    this.log('\n🚀 Starting Weekly Reload Flow Test', 'reload');

    try {
      // 1. Reset user stats
      await this.resetUserStats();

      // 2. Check VIP status and ensure minimum level
      this.log('📊 Checking VIP status...', 'info');
      await this.ensureVipAtLeast(1); // Ensure at least VIP level 1

      // 3. Check initial weekly reload status
      const initialStatus = await this.checkWeeklyReloadStatus();
      if (initialStatus.hasActive) {
        this.log('⚠️ User already has active weekly reload, test may be affected', 'warning');
      }

      // 3. Simulate 7 days of betting activity
      this.log('\n📈 Simulating 7 days of betting activity...', 'bet');

      // Create multiple sessions to match the $5M example from specification
      const sessions = [
        { wager: 100000000, win: 95000000 }, // $1M wager, $950K win
        { wager: 100000000, win: 95000000 }, // $1M wager, $950K win
        { wager: 100000000, win: 95000000 }, // $1M wager, $950K win
        { wager: 100000000, win: 95000000 }, // $1M wager, $950K win
        { wager: 100000000, win: 95000000 }, // $1M wager, $950K win
      ];

      for (const session of sessions) {
        await this.simulateGameSession(session.wager, session.win);
        await new Promise((r) => setTimeout(r, 200));
      }

      const totalWager = sessions.reduce((sum, s) => sum + s.wager, 0);
      const totalWin = sessions.reduce((sum, s) => sum + s.win, 0);
      this.log(
        `📊 Total activity: Wager $${(totalWager / 100).toLocaleString()}, Win $${(totalWin / 100).toLocaleString()}, Net Loss $${((totalWager - totalWin) / 100).toLocaleString()}`,
        'bet',
      );

      // Wait a bit for processing
      await new Promise((r) => setTimeout(r, 1000));

      // 4. Try to activate weekly reload
      this.log('\n👨‍💼 Admin activating weekly reload...', 'admin');
      const activationResult = await this.activateWeeklyReload();

      // 5. Wait for activation and get available weekly reload bonuses
      await new Promise((r) => setTimeout(r, 1000)); // Wait for activation
      this.log('\n🎁 Getting available weekly reload bonuses...', 'bonus');
      const availableBonuses = await this.getWeeklyReloadBonuses();

      // 6. Test claiming the first available bonus (should be day 1)
      let claimedBonus = null;
      if (availableBonuses.length > 0) {
        const firstBonus = availableBonuses[0]; // First bonus should be day 1

        this.log('\n🎁 Testing claim of first available bonus...', 'bonus');
        try {
          claimedBonus = await this.claimWeeklyReloadBonus(firstBonus.id);
          this.log(
            `✅ Weekly reload bonus claimed successfully: $${claimedBonus.amount} (Day ${claimedBonus.metadata?.dayNumber}/7)`,
            'success',
          );
        } catch (error) {
          this.log(`⚠️ Failed to claim first bonus: ${error.message}`, 'warning');
        }
      } else {
        this.log('⚠️ No available weekly reload bonuses found for claiming', 'warning');
      }

      // 7. Get final status
      const finalStatus = await this.checkWeeklyReloadStatus();

      // 8. Display results
      this.displayResults(activationResult, availableBonuses, claimedBonus);

      return {
        success: true,
        activationResult,
        availableBonuses,
        claimedBonus,
        status: finalStatus,
      };
    } catch (error) {
      this.log(`❌ Weekly reload test failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  displayResults(activationResult, availableBonuses, claimedBonus) {
    this.log('\n📊 WEEKLY RELOAD TEST RESULTS', 'success');
    this.log('='.repeat(50), 'info');

    this.log(
      `💰 Total Weekly Reload: $${(activationResult.totalWeeklyAmount / 100).toFixed(2)}`,
      'bonus',
    );
    this.log(`📅 Daily Amount: $${(activationResult.dailyAmount / 100).toFixed(2)}`, 'bonus');
    this.log(`🎁 Bonuses Created: ${activationResult.bonusesCreated}`, 'bonus');
    this.log(
      `🗓️ Last Expiration: ${new Date(activationResult.expirationDate).toLocaleDateString()}`,
      'bonus',
    );

    if (availableBonuses.length > 0) {
      this.log('\n🎁 Available Bonuses (at time of test):', 'bonus');
      availableBonuses.forEach((bonus, index) => {
        const activateDate = new Date(bonus.activateAt).toLocaleDateString();
        const expireDate = new Date(bonus.expiredAt).toLocaleDateString();
        const dayInfo = bonus.metadata?.dayNumber ? ` (Day ${bonus.metadata.dayNumber}/7)` : '';
        this.log(
          `   ${index + 1}. $${bonus.amount}${dayInfo} - Activates: ${activateDate}, Expires: ${expireDate}`,
          'bonus',
        );
      });
    } else {
      this.log('\n⚠️ No bonuses were available for claiming at test time', 'warning');
    }

    if (claimedBonus) {
      this.log('\n✅ Bonus Claimed Successfully:', 'success');
      this.log(`   💰 Amount: $${claimedBonus.amount}`, 'success');
      this.log(`   📅 Day: ${claimedBonus.metadata?.dayNumber}/7`, 'success');
      this.log(`   🕐 Claimed at: ${new Date(claimedBonus.claimedAt).toLocaleString()}`, 'success');
    } else {
      this.log('\n⚠️ No bonus was claimed during the test', 'warning');
    }

    this.log('\n✅ Weekly Reload Flow Test Completed!', 'success');
  }

  async run() {
    this.log('🔄 Starting Weekly Reload Client Simulator', 'reload');

    try {
      // Authenticate user
      const userAuth = await this.authenticateUser();

      if (!userAuth) {
        this.log('❌ User authentication failed, stopping simulator', 'error');
        return;
      }

      // Get initial balance
      await this.getUserBalance();
      this.log(
        `💰 Current balance: ${this.currentBalance.toFixed(8)} ${this.primaryWallet?.asset || 'USD'}`,
        'info',
      );

      // Run weekly reload test
      const result = await this.testWeeklyReloadFlow();

      if (result.success) {
        this.log('\n🎉 All tests completed successfully!', 'success');
      } else {
        this.log('\n❌ Tests failed', 'error');
      }
    } catch (error) {
      this.log(`❌ Simulator failed: ${error.message}`, 'error');
    }
  }
}

// Run the simulator
if (require.main === module) {
  const simulator = new WeeklyReloadClientSimulator();
  simulator.run().catch(console.error);
}

module.exports = WeeklyReloadClientSimulator;
