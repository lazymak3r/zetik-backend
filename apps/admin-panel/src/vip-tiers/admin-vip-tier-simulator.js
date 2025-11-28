#!/usr/bin/env node

import axios from 'axios';

// Configuration
const ADMIN_API_BASE = process.env.ADMIN_API_URL || 'http://localhost:3001/v1';
const BACKEND_API_BASE = process.env.BACKEND_API_URL || 'http://localhost:3000/v1';

// Admin credentials
const ADMIN_CREDENTIALS = {
  email: process.env.ADMIN_EMAIL || 'admin@zetik.casino',
  password: process.env.ADMIN_PASSWORD || 'changeme123',
};

// Test user credentials for backend API access
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'TestPassword123',
};

class AdminVipTierSimulator {
  constructor() {
    this.token = null;
    this.admin = null;
    this.backendToken = null;
    this.testUser = null;
    this.results = {};
    this.createdTierIds = [];
    this.pendingBonusIds = [];
    this.originalTiers = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix =
      {
        info: '📋',
        success: '✅',
        error: '❌',
        warning: '⚠️',
        admin: '👨‍💼',
        create: '➕',
        update: '✏️',
        delete: '🗑️',
        test: '🧪',
        bonus: '🎁',
      }[type] || 'ℹ️';

    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async makeRequest(endpoint, method = 'GET', body = null, useAuth = true) {
    const config = {
      method,
      url: `${ADMIN_API_BASE}${endpoint}`,
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

  async makeBackendRequest(endpoint, method = 'GET', body = null, useAuth = true) {
    // Authenticate with backend if needed
    if (useAuth && !this.backendToken) {
      await this.authenticateWithBackend();
    }

    const config = {
      method,
      url: `${BACKEND_API_BASE}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (useAuth && this.backendToken) {
      config.headers.Authorization = `Bearer ${this.backendToken}`;
    }

    if (body) {
      config.data = body;
    }

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      throw new Error(
        `Backend HTTP ${error.response?.status || 'ERROR'}: ${JSON.stringify(errorMessage)}`,
      );
    }
  }

  async authenticateWithBackend() {
    try {
      const loginData = await this.makeBackendRequest(
        '/auth/login/email',
        'POST',
        {
          email: TEST_USER.email,
          password: TEST_USER.password,
        },
        false,
      );

      this.backendToken = loginData.accessToken;
      this.testUser = loginData.user;
      this.log(`Backend authenticated - User ID: ${this.testUser.id}`, 'success');
    } catch (error) {
      this.log(`Backend authentication failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async test1_adminAuthentication() {
    this.log('Test 1: Admin Authentication', 'admin');

    try {
      const loginData = await this.makeRequest(
        '/auth/login',
        'POST',
        {
          email: ADMIN_CREDENTIALS.email,
          password: ADMIN_CREDENTIALS.password,
        },
        false,
      );

      this.token = loginData.accessToken;
      this.admin = loginData.admin;

      this.log(
        `Admin logged in successfully - ID: ${this.admin.id}, Email: ${this.admin.email}`,
        'success',
      );
      return { success: true, details: 'Admin authentication completed' };
    } catch (error) {
      this.log(`Admin Authentication failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test2_getInitialVipTiers() {
    this.log('Test 2: Get Initial VIP Tiers List', 'info');

    try {
      const tiers = await this.makeRequest('/vip-tiers');
      this.originalTiers = [...tiers];

      this.log(`Retrieved ${tiers.length} VIP tiers:`, 'success');
      tiers.forEach((tier) => {
        const wagerUSD = (parseFloat(tier.wagerRequirement) / 100).toFixed(0);
        const levelUpBonus = tier.levelUpBonusAmount
          ? `$${(parseFloat(tier.levelUpBonusAmount) / 100).toFixed(2)}`
          : 'None';
        this.log(
          `  Level ${tier.level}: ${tier.name} - Wager: $${wagerUSD}, Bonus: ${levelUpBonus}`,
          'info',
        );
      });

      const requiredLevels = [0, 1, 2, 3];
      const existingLevels = tiers.map((t) => t.level).sort((a, b) => a - b);
      const missingLevels = requiredLevels.filter((level) => !existingLevels.includes(level));

      if (missingLevels.length > 0) {
        this.log(`⚠️  Missing required levels: ${missingLevels.join(', ')}`, 'warning');
      } else {
        this.log('✅ All required levels (0-3) are present', 'success');
      }

      return {
        success: true,
        details: `Retrieved ${tiers.length} tiers`,
        tiersCount: tiers.length,
        levels: existingLevels,
      };
    } catch (error) {
      this.log(`Get Initial VIP Tiers failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test3_createNewVipTier() {
    this.log('Test 3: Create New VIP Tier', 'create');

    try {
      const existingTiers = await this.makeRequest('/vip-tiers');
      const maxLevel = Math.max(...existingTiers.map((t) => t.level));
      const newLevel = maxLevel + 1;

      const newTierData = {
        level: newLevel,
        name: `Test Tier ${newLevel}`,
        description: `Test tier created by simulator at level ${newLevel}`,
        isForVip: true,
        imageUrl: `https://example.com/tier-${newLevel}.png`,
        wagerRequirement: (100000 * (newLevel + 1)).toString(),
        levelUpBonusAmount: (5000 * newLevel).toString(),
        rakebackPercentage: (newLevel * 0.5).toFixed(1),
        rankUpBonusAmount: (newLevel % 5 === 0 ? 5000 * newLevel : 0).toString(),
        weeklyBonusPercentage: (newLevel * 0.2).toFixed(1),
        monthlyBonusPercentage: (newLevel * 0.3).toFixed(1),
      };

      const createdTier = await this.makeRequest('/vip-tiers', 'POST', newTierData);
      this.createdTierIds.push(createdTier.id);

      this.log(`Created new VIP tier: Level ${createdTier.level} - ${createdTier.name}`, 'success');
      this.log(`  ID: ${createdTier.id}`, 'info');

      return {
        success: true,
        details: `Created tier at level ${createdTier.level}`,
        tierId: createdTier.id,
        level: createdTier.level,
      };
    } catch (error) {
      this.log(`Create New VIP Tier failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test4_updateVipTier() {
    this.log('Test 4: Update VIP Tier', 'update');

    try {
      if (this.createdTierIds.length === 0) {
        throw new Error('No created tiers to update');
      }

      const tierIdToUpdate = this.createdTierIds[0];

      const updateData = {
        name: 'Updated Test Tier',
        description: 'This tier was updated by the simulator',
        levelUpBonusAmount: '10000',
        rakebackPercentage: '2.5',
        rankUpBonusAmount: '0',
        weeklyBonusPercentage: '1.0',
        monthlyBonusPercentage: '1.5',
      };

      const updatedTier = await this.makeRequest(`/vip-tiers/${tierIdToUpdate}`, 'PUT', updateData);

      this.log(`Updated VIP tier: Level ${updatedTier.level} - ${updatedTier.name}`, 'success');

      return {
        success: true,
        details: `Updated tier ${updatedTier.level}`,
        tierId: updatedTier.id,
      };
    } catch (error) {
      this.log(`Update VIP Tier failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test5_validateLevelRestrictions() {
    this.log('Test 5: Validate Level Update Restrictions', 'test');

    try {
      if (this.createdTierIds.length === 0) {
        throw new Error('No created tiers to test');
      }

      const tierIdToTest = this.createdTierIds[0];

      const invalidUpdateData = {
        level: 999,
        name: 'Invalid Level Update Test',
      };

      try {
        await this.makeRequest(`/vip-tiers/${tierIdToTest}`, 'PUT', invalidUpdateData);
        this.log('❌ Level update should have been rejected but was accepted', 'error');
        return { success: false, error: 'Level update validation failed' };
      } catch (error) {
        if (error.message.includes('level') || error.message.includes('400')) {
          this.log('✅ Level update correctly rejected by validation', 'success');
          return { success: true, details: 'Level update validation working correctly' };
        } else {
          throw error;
        }
      }
    } catch (error) {
      this.log(`Validate Level Restrictions failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test6_verifyChanges() {
    this.log('Test 6: Verify All Changes', 'info');

    try {
      const currentTiers = await this.makeRequest('/vip-tiers');
      const originalCount = this.originalTiers.length;
      const currentCount = currentTiers.length;

      this.log(`Original tiers count: ${originalCount}`, 'info');
      this.log(`Current tiers count: ${currentCount}`, 'info');

      for (const createdId of this.createdTierIds) {
        const tier = currentTiers.find((t) => t.id === createdId);
        if (tier) {
          this.log(`✅ Created tier found: Level ${tier.level} - ${tier.name}`, 'success');
        } else {
          this.log(`❌ Created tier not found: ${createdId}`, 'error');
        }
      }

      const requiredLevels = [0, 1, 2, 3];
      const currentLevels = currentTiers.map((t) => t.level).sort((a, b) => a - b);
      const missingLevels = requiredLevels.filter((level) => !currentLevels.includes(level));

      if (missingLevels.length > 0) {
        this.log(`❌ Missing required levels after changes: ${missingLevels.join(', ')}`, 'error');
        return { success: false, error: 'Required levels missing' };
      } else {
        this.log('✅ All required levels (0-3) still present', 'success');
      }

      return {
        success: true,
        details: `Verified ${currentCount} tiers, ${this.createdTierIds.length} created`,
        originalCount,
        currentCount,
      };
    } catch (error) {
      this.log(`Verify Changes failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test7_deleteCreatedTiers() {
    this.log('Test 7: Delete Created Tiers (Cleanup)', 'delete');

    try {
      let deletedCount = 0;

      for (const tierId of this.createdTierIds) {
        try {
          await this.makeRequest(`/vip-tiers/${tierId}`, 'DELETE');
          deletedCount++;
          this.log(`Deleted tier: ${tierId}`, 'success');
        } catch (error) {
          this.log(`Failed to delete tier ${tierId}: ${error.message}`, 'error');
        }
      }

      const finalTiers = await this.makeRequest('/vip-tiers');
      const remainingCreatedTiers = finalTiers.filter((t) => this.createdTierIds.includes(t.id));

      if (remainingCreatedTiers.length === 0) {
        this.log('✅ All created tiers successfully deleted', 'success');
      } else {
        this.log(`⚠️  ${remainingCreatedTiers.length} created tiers still remain`, 'warning');
      }

      const requiredLevels = [0, 1, 2, 3];
      const finalLevels = finalTiers.map((t) => t.level).sort((a, b) => a - b);
      const missingLevels = requiredLevels.filter((level) => !finalLevels.includes(level));

      if (missingLevels.length > 0) {
        this.log(
          `❌ CRITICAL: Required levels missing after deletion: ${missingLevels.join(', ')}`,
          'error',
        );
        return { success: false, error: 'Required levels deleted' };
      }

      return {
        success: true,
        details: `Deleted ${deletedCount}/${this.createdTierIds.length} created tiers`,
        deletedCount,
        remainingCount: remainingCreatedTiers.length,
      };
    } catch (error) {
      this.log(`Delete Created Tiers failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test8_findPendingBonuses() {
    this.log('Test 8: Find Pending Bonuses', 'bonus');

    try {
      // Search for pending bonuses via backend API (since admin panel doesn't have bonus endpoints yet)
      const backendResponse = await this.makeBackendRequest('/bonus/pending', 'GET', null, true);

      // Handle paginated response format
      let pendingBonuses = [];
      if (
        backendResponse &&
        typeof backendResponse === 'object' &&
        Array.isArray(backendResponse.data)
      ) {
        pendingBonuses = backendResponse.data;
      } else if (Array.isArray(backendResponse)) {
        pendingBonuses = backendResponse;
      }

      this.log(`Found ${pendingBonuses.length} pending bonuses:`, 'info');

      if (pendingBonuses.length === 0) {
        this.log('No pending bonuses found', 'warning');
        return {
          success: true,
          details: 'No pending bonuses to manage',
          pendingCount: 0,
        };
      }

      // Store pending bonus IDs for potential cancellation
      this.pendingBonusIds = [];

      pendingBonuses.forEach((bonus, index) => {
        const amount = (parseFloat(bonus.amount) / 100).toFixed(2);
        const expiresAt = bonus.expiresAt
          ? new Date(bonus.expiresAt).toLocaleDateString()
          : 'Never';

        this.log(
          `  Bonus ${index + 1}: ${bonus.bonusType} - $${amount} (User: ${bonus.userId}, Expires: ${expiresAt})`,
          'info',
        );

        this.pendingBonusIds.push(bonus.id);
      });

      return {
        success: true,
        details: `Found ${pendingBonuses.length} pending bonuses`,
        pendingCount: pendingBonuses.length,
        bonuses: pendingBonuses,
      };
    } catch (error) {
      this.log(`Find Pending Bonuses failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test9_cancelPendingBonuses() {
    this.log('Test 9: Cancel Pending Bonuses', 'bonus');

    try {
      if (!this.pendingBonusIds || this.pendingBonusIds.length === 0) {
        this.log('No pending bonuses to cancel', 'warning');
        return {
          success: true,
          details: 'No bonuses to cancel',
          cancelledCount: 0,
        };
      }

      // Use the new admin panel bonuses endpoint for batch cancellation
      const bonusesToCancel = this.pendingBonusIds.slice(
        0,
        Math.min(2, this.pendingBonusIds.length),
      );

      this.log(`Attempting to cancel ${bonusesToCancel.length} bonuses using admin panel:`, 'info');

      try {
        const result = await this.makeRequest('/bonuses/cancel-batch', 'POST', {
          bonusIds: bonusesToCancel,
          reason: 'Cancelled via admin simulator for testing',
        });

        const cancelledCount = result.success || 0;
        const failedCount = result.failed ? result.failed.length : 0;

        this.log(
          `Cancellation summary: ${cancelledCount} cancelled, ${failedCount} failed`,
          'info',
        );

        if (cancelledCount > 0) {
          this.log(`✅ Successfully cancelled ${cancelledCount} bonuses`, 'success');
        }
        if (failedCount > 0) {
          this.log(`⚠️  Failed to cancel ${failedCount} bonuses`, 'warning');
        }

        return {
          success: cancelledCount > 0,
          details: `Cancelled ${cancelledCount}/${bonusesToCancel.length} bonuses`,
          cancelledCount,
          failedCount,
          attempted: bonusesToCancel.length,
        };
      } catch (error) {
        this.log(`❌ Failed to cancel bonuses: ${error.message}`, 'error');
        return {
          success: false,
          details: 'Cancellation failed',
          error: error.message,
        };
      }
    } catch (error) {
      this.log(`Cancel Pending Bonuses failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test10_updateAllLevelUpBonuses() {
    this.log('Test 10: Update All Level Up Bonuses (*10)', 'bonus');

    try {
      // Get all current tiers
      const allTiers = await this.makeRequest('/vip-tiers', 'GET');
      this.log(`Found ${allTiers.length} tiers to update`, 'info');

      let updatedCount = 0;
      let skippedCount = 0;

      for (const tier of allTiers) {
        if (tier.levelUpBonusAmount && parseFloat(tier.levelUpBonusAmount) > 0) {
          const currentAmount = parseFloat(tier.levelUpBonusAmount);
          const newAmount = (currentAmount * 10).toFixed(2);

          this.log(
            `Updating Level ${tier.level} (${tier.name}): $${(currentAmount / 100).toFixed(2)} → $${(newAmount / 100).toFixed(2)}`,
            'info',
          );

          const updateData = {
            name: tier.name,
            description: tier.description,
            isForVip: tier.isForVip,
            imageUrl: tier.imageUrl,
            wagerRequirement: tier.wagerRequirement,
            levelUpBonusAmount: newAmount,
            rakebackPercentage: tier.rakebackPercentage,
            rankUpBonusAmount: tier.rankUpBonusAmount,
            weeklyBonusPercentage: tier.weeklyBonusPercentage,
            monthlyBonusPercentage: tier.monthlyBonusPercentage,
          };

          await this.makeRequest(`/vip-tiers/${tier.id}`, 'PUT', updateData);
          updatedCount++;
        } else {
          this.log(`Skipping Level ${tier.level} (${tier.name}): no levelUpBonusAmount`, 'warning');
          skippedCount++;
        }
      }

      this.log(
        `✅ Level up bonuses updated: ${updatedCount} updated, ${skippedCount} skipped`,
        'success',
      );

      return {
        success: true,
        details: `Updated ${updatedCount}/${allTiers.length} tier bonuses`,
        updatedCount,
        skippedCount,
        totalTiers: allTiers.length,
      };
    } catch (error) {
      this.log(`Update level up bonuses failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test11_finalVerification() {
    this.log('Test 11: Final State Verification', 'info');

    try {
      const finalTiers = await this.makeRequest('/vip-tiers');

      this.log(`Final VIP tiers count: ${finalTiers.length}`, 'info');
      this.log('Final VIP tiers:', 'info');

      finalTiers
        .sort((a, b) => a.level - b.level)
        .forEach((tier) => {
          const wagerUSD = (parseFloat(tier.wagerRequirement) / 100).toFixed(0);
          const levelUpBonus = tier.levelUpBonusAmount
            ? `$${(parseFloat(tier.levelUpBonusAmount) / 100).toFixed(2)}`
            : 'None';
          this.log(
            `  Level ${tier.level}: ${tier.name} - Wager: $${wagerUSD}, Bonus: ${levelUpBonus}`,
            'info',
          );
        });

      const requiredLevels = [0, 1, 2, 3];
      const finalLevels = finalTiers.map((t) => t.level).sort((a, b) => a - b);
      const missingLevels = requiredLevels.filter((level) => !finalLevels.includes(level));

      if (missingLevels.length > 0) {
        this.log(`❌ FINAL CHECK FAILED: Missing levels ${missingLevels.join(', ')}`, 'error');
        return { success: false, error: 'Final validation failed' };
      }

      this.log('✅ Final verification passed - all required levels present', 'success');

      return {
        success: true,
        details: `Final state verified: ${finalTiers.length} tiers`,
        finalCount: finalTiers.length,
        levels: finalLevels,
      };
    } catch (error) {
      this.log(`Final Verification failed: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  printSummary() {
    this.log('\n' + '='.repeat(80), 'info');
    this.log('ADMIN VIP TIER SIMULATOR - SUMMARY REPORT', 'info');
    this.log('='.repeat(80), 'info');

    const tests = [
      { name: 'Admin Authentication', key: 'test1' },
      { name: 'Get Initial VIP Tiers', key: 'test2' },
      { name: 'Create New VIP Tier', key: 'test3' },
      { name: 'Update VIP Tier', key: 'test4' },
      { name: 'Validate Level Restrictions', key: 'test5' },
      { name: 'Verify Changes', key: 'test6' },
      { name: 'Delete Created Tiers', key: 'test7' },
      { name: 'Find Pending Bonuses', key: 'test8' },
      { name: 'Cancel Pending Bonuses', key: 'test9' },
      { name: 'Update All Level Up Bonuses', key: 'test10' },
      { name: 'Final Verification', key: 'test11' },
    ];

    let passedTests = 0;
    let totalTests = tests.length;

    tests.forEach((test) => {
      const result = this.results[test.key];
      if (result) {
        const status = result.success ? '✅ PASS' : '❌ FAIL';
        const details = result.details || result.error || 'No details';
        this.log(`${status} - ${test.name}: ${details}`, result.success ? 'success' : 'error');
        if (result.success) passedTests++;
      } else {
        this.log(`⚪ SKIP - ${test.name}: Not executed`, 'warning');
      }
    });

    this.log('='.repeat(80), 'info');
    this.log(
      `FINAL RESULT: ${passedTests}/${totalTests} tests passed`,
      passedTests === totalTests ? 'success' : 'error',
    );

    if (passedTests === totalTests) {
      this.log('🎉 All VIP tier management operations completed successfully!', 'success');
      this.log('✅ Admin can safely manage BonusVipTierEntity with proper validations', 'success');
    } else {
      this.log('⚠️  Some tests failed - review the errors above', 'warning');
    }

    this.log('='.repeat(80), 'info');
  }

  async runAllTests() {
    this.log('🚀 Starting Admin VIP Tier Management Simulator...', 'info');
    this.log(`Admin API: ${ADMIN_API_BASE}`, 'info');
    this.log(`Admin Email: ${ADMIN_CREDENTIALS.email}`, 'info');
    this.log('='.repeat(80), 'info');

    const tests = [
      { name: 'test1_adminAuthentication', key: 'test1' },
      { name: 'test2_getInitialVipTiers', key: 'test2' },
      { name: 'test3_createNewVipTier', key: 'test3' },
      { name: 'test4_updateVipTier', key: 'test4' },
      { name: 'test5_validateLevelRestrictions', key: 'test5' },
      { name: 'test6_verifyChanges', key: 'test6' },
      { name: 'test7_deleteCreatedTiers', key: 'test7' },
      { name: 'test8_findPendingBonuses', key: 'test8' },
      { name: 'test9_cancelPendingBonuses', key: 'test9' },
      { name: 'test10_updateAllLevelUpBonuses', key: 'test10' },
      { name: 'test11_finalVerification', key: 'test11' },
    ];

    for (const test of tests) {
      try {
        this.log(`\n--- Running ${test.name} ---`, 'test');
        const result = await this[test.name]();
        this.results[test.key] = result;

        if (!result.success) {
          this.log(`❌ Test ${test.name} failed, continuing with next test...`, 'error');
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        this.log(`💥 Test ${test.name} crashed: ${error.message}`, 'error');
        this.results[test.key] = { success: false, error: error.message };
      }
    }

    this.printSummary();
  }
}

if (require.main === module) {
  const simulator = new AdminVipTierSimulator();
  simulator.runAllTests().catch((error) => {
    console.error('💥 Simulator crashed:', error);
    process.exit(1);
  });
}

export default AdminVipTierSimulator;
