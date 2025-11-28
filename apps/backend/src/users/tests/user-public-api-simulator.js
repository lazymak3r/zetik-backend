// Using native fetch instead of axios

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
    const error = new Error(result.message || 'Request failed');
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
    const error = new Error(result.message || 'Request failed');
    error.response = { status: response.status, data: result };
    throw error;
  }

  return { data: result };
}

async function fetchPatch(url, data, headers = {}) {
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    const error = new Error(result.message || 'Request failed');
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

class UserPublicApiSimulator {
  constructor() {
    this.token = null;
    this.user = null;
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
      }[type] || 'ℹ️';

    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async testHttpAuth() {
    this.log('Testing HTTP Authentication', 'info');

    try {
      const response = await fetchPost(`${API_BASE}/auth/login/email`, {
        email: TEST_USER.email,
        password: TEST_USER.password,
      });

      this.token = response.data.accessToken;
      this.user = response.data.user;

      this.log(`Login successful! User ID: ${this.user.id}`, 'success');
      return true;
    } catch (error) {
      this.log(`Login failed: ${error.response?.data?.message || error.message}`, 'error');
      return false;
    }
  }

  async testUpdateHideStatistics(value = true) {
    this.log(`Testing Update Profile to set hideStatistics=${value}`, 'info');

    try {
      const updateData = {
        hideStatistics: value,
      };

      await fetchPatch(`${API_BASE}/users/profile`, updateData, {
        Authorization: `Bearer ${this.token}`,
      });

      this.log('Profile updated successfully', 'success');
      this.log(`Updated fields: ${JSON.stringify(updateData)}`, 'info');
      return true;
    } catch (error) {
      this.log(`Update failed: ${error.response?.data?.message || error.message}`, 'error');
      return false;
    }
  }

  async testGetPublicProfile(expectedHidden = false) {
    this.log(`Testing Get Public Profile (expected hidden: ${expectedHidden})`, 'info');

    try {
      const response = await fetchGet(`${API_BASE}/users/public/${this.user.id}`, {
        Authorization: `Bearer ${this.token}`,
      });

      const profile = response.data;

      this.log('Public profile retrieved successfully', 'success');
      this.log(`Profile data: ${JSON.stringify(profile, null, 2)}`, 'info');

      // Check if statistics are present
      const hasStatistics = profile.statistics && Object.keys(profile.statistics).length > 0;
      this.log(
        `Statistics present: ${hasStatistics ? 'YES (should be NO if hidden)' : 'NO'}`,
        hasStatistics ? 'error' : 'success',
      );

      // Check if hideStatistics field exists
      const hasHideField = 'hideStatistics' in profile;
      this.log(
        `hideStatistics field present: ${hasHideField ? 'YES' : 'NO (should be YES)'}`,
        hasHideField ? 'success' : 'error',
      );

      // If hideStatistics exists, log its value
      if (hasHideField) {
        this.log(`hideStatistics value: ${profile.hideStatistics}`, 'info');
      }

      // Logic: if expectedHidden=true, statistics should NOT be present (!hasStatistics should be true)
      // if expectedHidden=false, statistics should be present (hasStatistics should be true)
      const statisticsCorrect = expectedHidden ? !hasStatistics : hasStatistics;
      return statisticsCorrect && hasHideField;
    } catch (error) {
      this.log(
        `Get public profile failed: ${error.response?.data?.message || error.message}`,
        'error',
      );
      return false;
    }
  }

  async runTests() {
    this.log('Starting User Public API Simulator Tests', 'setup');

    const tests = [
      { name: 'HTTP Authentication', fn: () => this.testHttpAuth() },
      { name: 'Update hideStatistics to true', fn: () => this.testUpdateHideStatistics(true) },
      { name: 'Get Public Profile (hidden=true)', fn: () => this.testGetPublicProfile(true) },
      { name: 'Update hideStatistics to false', fn: () => this.testUpdateHideStatistics(false) },
      { name: 'Get Public Profile (hidden=false)', fn: () => this.testGetPublicProfile(false) },
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      this.log(`\n--- ${test.name} ---`, 'info');
      try {
        const result = await test.fn();
        if (result) {
          passed++;
          this.log(`✅ ${test.name} PASSED`, 'success');
        } else {
          failed++;
          this.log(`❌ ${test.name} FAILED`, 'error');
        }
      } catch (error) {
        failed++;
        this.log(`❌ ${test.name} ERROR: ${error.message}`, 'error');
      }

      // Add small delay between tests
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    this.log('\n=== Test Results ===', 'info');
    this.log(`✅ Passed: ${passed}`, 'success');
    this.log(`❌ Failed: ${failed}`, failed > 0 ? 'error' : 'info');
    this.log(`📊 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`, 'info');

    return { passed, failed, total: passed + failed };
  }
}

// Run the simulator
if (require.main === module) {
  const simulator = new UserPublicApiSimulator();
  simulator.runTests().catch(console.error);
}

module.exports = UserPublicApiSimulator;
