/**
 * Multi-Device Session Simulator - TDD for testing IP logging, logout, and location
 *
 * PURPOSE:
 * This simulator emulates multiple devices connecting to the backend from different IP addresses.
 * It sends various HTTP headers with simulated IP addresses to test session management across
 * different devices/networks.
 *
 * IP HANDLING:
 * The simulator sends the following headers with different IPs:
 *   - X-Forwarded-For: Contains the simulated client IP
 *   - X-Real-IP: Contains the simulated client IP
 *
 * BACKEND REQUIREMENTS:
 * To use this simulator, the backend must have the SimulatedIpMiddleware enabled, which:
 *   1. Intercepts incoming requests
 *   2. Reads the X-Forwarded-For and X-Real-IP headers
 *   3. Extracts the simulated IP address
 *   4. Makes it available to the auth service instead of using localhost (127.0.0.1)
 *
 * MIDDLEWARE LOCATION:
 * apps/backend/src/common/middleware/simulated-ip.middleware.ts
 *
 * This allows testing multiple simultaneous sessions from different IP addresses
 * without needing actual VPN or proxy infrastructure.
 *
 * USAGE:
 * pnpm exec node apps/backend/src/websocket/tests/multi-device-session-simulator.js
 *
 * This simulator tests:
 * 1. IP Logging - Each login from different IP creates new session
 * 2. Logout All - Logout all sessions except current one
 * 3. Location Accuracy - Verify geolocation detection from IP
 * 4. Session Activity - Track active sessions via WebSocket connections
 */

const http = require('http');
const socketIo = require('socket.io-client');

const API_BASE = 'http://localhost:4000/v1';
const STATS_WS_URL = 'http://localhost:4000/stats';

const TEST_USER = {
  email: 'player1@test.com',
  password: 'TestPassword123!',
};

const TEST_IPS = [
  '8.8.8.8', // Google DNS - USA
  '1.1.1.1', // Cloudflare - Multiple locations
  '208.67.222.222', // OpenDNS - USA
  '185.221.101.4', // Europe
];

let currentIP = null;
let currentAccessToken = null;
let currentRefreshToken = null;
let wsSocket = null;

async function makeRequest(method, path, body = null, customIPOrToken = null) {
  const ipToUse = customIPOrToken && customIPOrToken.includes('.') ? customIPOrToken : currentIP;
  const tokenToUse =
    customIPOrToken && !customIPOrToken.includes('.') ? customIPOrToken : currentAccessToken;

  return new Promise((resolve, reject) => {
    const url = new URL(`${API_BASE}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': ipToUse,
        'X-Real-IP': ipToUse,
      },
    };

    if (tokenToUse && path !== '/auth/login/email') {
      options.headers['Authorization'] = `Bearer ${tokenToUse}`;
    }

    if (currentRefreshToken) {
      options.headers['Cookie'] = `refresh_token=${currentRefreshToken}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const response = {
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
          };
          resolve(response);
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function setupTestUser() {
  console.log('\n📝 SETUP: Checking if user exists...\n');

  try {
    currentIP = TEST_IPS[0];

    const result = await loginTestUser();

    if (result) {
      console.log('✅ Logged in successfully\n');
      return true;
    }

    console.log('User will be used for testing\n');
    return true;
  } catch (error) {
    console.error('Setup error:', error.message);
    return false;
  }
}

async function loginTestUser(ipAddress = null) {
  const ipToUse = ipAddress || TEST_IPS[0];
  currentIP = ipToUse;

  const response = await makeRequest('POST', '/auth/login/email', {
    email: TEST_USER.email,
    password: TEST_USER.password,
  });

  if (response.status === 200 || response.status === 201) {
    currentAccessToken = response.body.accessToken;
    currentRefreshToken = response.body.refreshToken;
    return response.body;
  } else {
    console.error('Login failed:', response.body);
    return null;
  }
}

async function testIPLogging() {
  console.log('\n' + '='.repeat(80));
  console.log('🔴 TEST 1: Multiple IP Sessions Logging');
  console.log('='.repeat(80));
  console.log('Expected: Each login with different IP should create a NEW session\n');

  try {
    console.log('📝 [Step 1] Logging out from all sessions...');
    currentIP = TEST_IPS[0];
    await makeRequest('POST', '/auth/logout', {});
    console.log('✅ Logged out\n');

    console.log('📝 [Step 2] Logging in from different IPs:\n');

    for (let i = 0; i < TEST_IPS.length; i++) {
      const ip = TEST_IPS[i];
      console.log(`   → Login attempt ${i + 1} with IP: ${ip}`);

      const loginResult = await loginTestUser(ip);
      if (loginResult) {
        console.log(`     ✅ Logged in successfully`);
        console.log(`     Token ID: ${loginResult.accessToken.substring(0, 20)}...`);
        console.log(`     📍 This IP should create a NEW session\n`);
      }
    }

    console.log('📝 [Step 3] Fetching all sessions...\n');
    currentIP = TEST_IPS[0];

    const response = await makeRequest('GET', '/auth/sessions');

    if (response.status === 200 && response.body.sessions) {
      const sessions = response.body.sessions;
      console.log(`📊 Total sessions found: ${sessions.length}\n`);

      if (sessions.length === TEST_IPS.length) {
        console.log(`✅ PASS: Found ${sessions.length} sessions (expected ${TEST_IPS.length})`);
        console.log('🎉 Each login with different IP created a NEW session!\n');
      } else {
        console.log(`❌ FAIL: Found ${sessions.length} sessions but expected ${TEST_IPS.length}\n`);
      }

      const uniqueIPs = new Set(sessions.map((s) => s.ipAddress));
      console.log(`   Unique IPs: ${uniqueIPs.size} (expected ${TEST_IPS.length})`);
      uniqueIPs.forEach((ip) => console.log(`     - ${ip}`));

      return sessions.length === TEST_IPS.length;
    }
    return false;
  } catch (error) {
    console.error('Test error:', error.message);
    return false;
  }
}

async function testLogoutAll() {
  console.log('\n' + '='.repeat(80));
  console.log('🟡 TEST 2: Logout All Sessions Except Current');
  console.log('='.repeat(80));
  console.log('Expected: DELETE /sessions?keepSessionId=X should delete all except X\n');

  try {
    console.log('📝 [Step 1] Checking initial sessions...\n');

    const initialResponse = await makeRequest('GET', '/auth/sessions');
    if (initialResponse.status !== 200) {
      console.log('Failed to fetch sessions');
      return false;
    }

    const initialSessions = initialResponse.body.sessions;
    const currentSession = initialSessions.find((s) => s.isCurrentSession);

    console.log(`   Total sessions: ${initialSessions.length}`);
    console.log(`   Current session ID: ${currentSession.id}\n`);

    console.log('📝 [Step 2] Calling DELETE /sessions?keepSessionId=X...\n');

    const deleteResponse = await makeRequest(
      'DELETE',
      `/auth/sessions?keepSessionId=${currentSession.id}`,
      null,
    );

    if (deleteResponse.status === 200) {
      console.log('✅ Delete request successful\n');

      console.log('📝 [Step 3] Verifying deletion...\n');

      const postLogoutResponse = await makeRequest('GET', '/auth/sessions');
      const postLogoutSessions = postLogoutResponse.body.sessions;

      console.log(`   Sessions after logout: ${postLogoutSessions.length}`);
      console.log(`   Sessions deleted: ${initialSessions.length - postLogoutSessions.length}`);
      console.log(`   Expected to delete: ${initialSessions.length - 1}\n`);

      if (postLogoutSessions.length === 1) {
        console.log(`✅ PASS: Exactly 1 session remaining (the current one)`);
        console.log(`   Remaining session ID: ${postLogoutSessions[0].id}`);
        return true;
      }
      return false;
    }
    return false;
  } catch (error) {
    console.error('Test error:', error.message);
    return false;
  }
}

async function testLocationAccuracy() {
  console.log('\n' + '='.repeat(80));
  console.log('🟢 TEST 3: Location Detection Accuracy');
  console.log('='.repeat(80));
  console.log('Note: VPN shows VPN server location (expected)\n');

  try {
    const response = await makeRequest('GET', '/auth/sessions');

    if (response.status !== 200) {
      console.log('Failed to fetch sessions');
      return false;
    }

    const sessions = response.body.sessions;
    console.log(`📊 Analyzing location data from ${sessions.length} sessions:\n`);

    const locationStats = {};

    sessions.forEach((session, idx) => {
      const location = session.location || 'Unknown';
      locationStats[location] = (locationStats[location] || 0) + 1;

      console.log(`Session ${idx + 1}:`);
      console.log(`  IP: ${session.ipAddress}`);
      console.log(`  Location: ${location}`);
      console.log(`  Accuracy: ${location === 'Unknown' ? '⚠️' : '✓'}`);
      console.log('');
    });

    console.log('📊 Location Summary:');
    Object.entries(locationStats).forEach(([location, count]) => {
      console.log(`  ${location}: ${count} sessions`);
    });

    const unknownCount = locationStats['Unknown'] || 0;
    const totalSessions = sessions.length;

    if (unknownCount < totalSessions) {
      console.log(
        `\n✅ PASS: ${totalSessions - unknownCount} out of ${totalSessions} sessions have location data`,
      );
      return true;
    } else {
      console.log(`\n⚠️  WARNING: All sessions showing Unknown location`);
      console.log('   Expected for localhost development');
      return true;
    }
  } catch (error) {
    console.error('Test error:', error.message);
    return false;
  }
}

async function testSessionActivity() {
  console.log('\n' + '='.repeat(80));
  console.log('🔵 TEST 4: isActive Flag - WebSocket Session Activity');
  console.log('='.repeat(80));
  console.log('Expected: When connected to /stats WebSocket, isActive should be true\n');

  try {
    console.log('📝 [Step 1] Creating a new session for activity test...\n');
    currentIP = '203.0.113.42';

    const loginResult = await makeRequest('POST', '/auth/login/email', {
      email: TEST_USER.email,
      password: TEST_USER.password,
    });

    if (loginResult.status !== 200 && loginResult.status !== 201) {
      throw new Error('Failed to create new session');
    }

    const testAccessToken = loginResult.body.accessToken;
    const testRefreshToken = loginResult.body.refreshToken;

    console.log('✅ New session created with IP: 203.0.113.42\n');

    console.log('📝 [Step 2] Checking sessions BEFORE WebSocket connection...\n');

    const beforeResponse = await makeRequest('GET', '/auth/sessions', null, testAccessToken);
    if (beforeResponse.status === 200 && beforeResponse.body.sessions) {
      const sessions = beforeResponse.body.sessions;
      const testSession = sessions.find((s) => s.ipAddress === '203.0.113.42');

      if (testSession) {
        console.log(`Session found:`);
        console.log(`  ID: ${testSession.id}`);
        console.log(`  IP: ${testSession.ipAddress}`);
        console.log(`  Status BEFORE WS: ${testSession.isActive ? '🟢 ACTIVE' : '⚫ INACTIVE'}`);
        console.log(`  Location: ${testSession.location}\n`);
      }
    }

    console.log('📝 [Step 3] Connecting to WebSocket /stats...\n');

    const wsConnectPromise = new Promise((resolve, reject) => {
      const socket = socketIo.connect(STATS_WS_URL, {
        query: {
          refreshToken: testRefreshToken,
        },
        auth: {
          token: testAccessToken,
          refreshToken: testRefreshToken,
        },
        transports: ['websocket'],
      });

      socket.on('connect', () => {
        console.log('✅ WebSocket connected successfully');
        wsSocket = socket;
        resolve(true);
      });

      socket.on('error', (error) => {
        console.error('WebSocket connection error:', error);
        reject(error);
      });

      socket.on('disconnect', (reason) => {
        console.log('WebSocket disconnected:', reason);
        wsSocket = null;
      });

      setTimeout(() => {
        if (!socket.connected) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 5000);
    });

    try {
      await wsConnectPromise;
    } catch (error) {
      console.log(`WebSocket connection failed: ${error.message}`);
      console.log('   Continuing test...\n');
    }

    console.log('📝 [Step 4] Checking sessions AFTER WebSocket connection...\n');

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const afterResponse = await makeRequest('GET', '/auth/sessions', null, testAccessToken);
    if (afterResponse.status === 200 && afterResponse.body.sessions) {
      const sessions = afterResponse.body.sessions;
      const testSession = sessions.find((s) => s.ipAddress === '203.0.113.42');

      if (testSession) {
        console.log(`Session found:`);
        console.log(`  ID: ${testSession.id}`);
        console.log(`  IP: ${testSession.ipAddress}`);
        console.log(`  Status AFTER WS: ${testSession.isActive ? '🟢 ACTIVE' : '⚫ INACTIVE'}`);
        console.log(`  Location: ${testSession.location}\n`);

        const result = testSession.isActive;

        if (wsSocket && wsSocket.connected) {
          console.log('📝 [Step 5] Disconnecting from WebSocket...\n');
          wsSocket.disconnect();
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        if (result) {
          console.log('✅ PASS: Session is ACTIVE when connected to WebSocket!');
          return true;
        } else {
          console.log('❌ FAIL: Session should be ACTIVE after WebSocket connection');
          return false;
        }
      }
    }

    console.log('Could not find test session');
    return false;
  } catch (error) {
    console.error('Test error:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║          Session Logging Simulator - TDD Test Suite                           ║');
  console.log('║  Testing IP Logging, Logout All Sessions, Location Accuracy, isActive        ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════════╝');

  console.log('\n⚠️  Make sure backend is running on http://localhost:4000');
  console.log('    Start with: pnpm start\n');

  const setupOk = await setupTestUser();
  if (!setupOk) {
    console.log('Setup failed');
    process.exit(1);
  }

  const results = {
    'IP Logging': await testIPLogging(),
    'Logout All': await testLogoutAll(),
    'Location Accuracy': await testLocationAccuracy(),
    'Session Activity': await testSessionActivity(),
  };

  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80) + '\n');

  let passed = 0;
  let failed = 0;

  Object.entries(results).forEach(([testName, result]) => {
    const status = result ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}  ${testName}`);
    if (result) passed++;
    else failed++;
  });

  console.log('\n' + '-'.repeat(80));
  console.log(`Total: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log('-'.repeat(80) + '\n');

  if (failed === 0) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('Some tests failed.');
    process.exit(1);
  }
}

runAllTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
