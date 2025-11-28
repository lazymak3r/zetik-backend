#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */
const axios = require('axios');
const { io } = require('socket.io-client');

// Configuration
const API_BASE = process.env.TEST_BACKEND_URL || 'http://localhost:3000/v1';
const STATS_WS_URL = 'http://localhost:3000/stats'; // Stats namespace

// User credentials - USER MUST BE REGISTERED BEFORE RUNNING TESTS
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'TestPassword123',
};

class StatsClientSimulator {
  constructor() {
    this.token = null;
    this.user = null;
    this.socket = null;
    this.connected = false;
    this.statsCount = 0;
    this.startTime = Date.now();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const prefix =
      {
        info: '📋',
        success: '✅',
        error: '❌',
        warning: '⚠️',
        websocket: '🔌',
        stats: '📊',
        auth: '🔐',
      }[type] || 'ℹ️';

    console.log(`[${timestamp}] [+${elapsed}s] ${prefix} ${message}`);
  }

  async authenticate() {
    this.log('Authenticating user...', 'auth');

    try {
      const response = await axios.post(`${API_BASE}/auth/login/email`, {
        email: TEST_USER.email,
        password: TEST_USER.password,
      });

      this.token = response.data.accessToken;
      this.user = response.data.user;

      this.log(`Authentication successful! User ID: ${this.user.id}`, 'success');
      return true;
    } catch (error) {
      this.log(`Authentication failed: ${error.response?.data?.message || error.message}`, 'error');
      return false;
    }
  }

  async connectToStatsWebSocket() {
    this.log('Connecting to Stats WebSocket...', 'websocket');

    return new Promise((resolve, reject) => {
      this.socket = io(STATS_WS_URL, {
        auth: { token: this.token },
        transports: ['websocket'],
      });

      // Connection successful
      this.socket.on('connect', () => {
        this.connected = true;
        this.log(`WebSocket connected! Socket ID: ${this.socket.id}`, 'websocket');
      });

      // Server confirms connection
      this.socket.on('connected', (data) => {
        this.log('Stats server confirmed connection', 'success');
        this.log(`  Message: ${data.message}`, 'info');
        this.log(`  User ID: ${data.userId}`, 'info');
        this.log(`  Timestamp: ${data.timestamp}`, 'info');
        resolve(true);
      });

      // Handle stats updates
      this.socket.on('online-stats', (data) => {
        this.statsCount++;
        const statsType = this.statsCount === 1 ? 'initial' : 'periodic';
        this.log(`📊 STATS UPDATE #${this.statsCount} (${statsType}):`, 'stats');
        this.log(`  Active Users: ${data.activeUsers}`, 'stats');
        this.log(`  Timestamp: ${data.timestamp}`, 'info');

        if (this.statsCount > 1) {
          this.log(`  ⏰ This was a 25-second interval update`, 'stats');
        } else {
          this.log(`  🚀 This was an immediate connection update`, 'stats');
        }
      });

      // Handle connection errors
      this.socket.on('connect_error', (error) => {
        this.log(`WebSocket connection error: ${error.message}`, 'error');
        reject(new Error(error.message || 'WebSocket connection error'));
      });

      // Handle disconnection
      this.socket.on('disconnect', (reason) => {
        this.connected = false;
        this.log(`WebSocket disconnected: ${reason}`, 'websocket');
      });

      // Handle server errors
      this.socket.on('error', (error) => {
        this.log(`Server error: ${error.message || JSON.stringify(error)}`, 'error');
        if (error.code === 'AUTH_FAILED') {
          reject(new Error('Authentication failed on WebSocket'));
        }
      });

      // Connection timeout
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 5000);
    });
  }

  async runSimulation() {
    console.log('🚀 Stats WebSocket Client Simulator');
    console.log('═'.repeat(50));
    console.log(`📋 Testing with user: ${TEST_USER.email}`);
    console.log(`🌐 Backend URL: ${API_BASE}`);
    console.log(`🔌 Stats WebSocket URL: ${STATS_WS_URL}`);
    console.log('');
    console.log('📋 This test will:');
    console.log('   1. Connect to /stats namespace');
    console.log('   2. Show immediate stats (should be 1 active user)');
    console.log('   3. Monitor 25-second interval updates');
    console.log('   4. Disconnect and show final stats (should be 0)');
    console.log('═'.repeat(50));
    console.log('');

    try {
      // Step 1: Authenticate
      if (!(await this.authenticate())) {
        this.log('❌ Authentication failed, stopping test', 'error');
        process.exit(1);
      }

      this.log('Waiting 2 seconds before connecting to WebSocket...', 'info');
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Step 2: Connect to WebSocket
      await this.connectToStatsWebSocket();

      this.log('📊 Now monitoring stats updates...', 'stats');
      this.log('   - You should see 1 active user immediately', 'info');
      this.log('   - Then periodic updates every 25 seconds', 'info');
      this.log('   - Press Ctrl+C to disconnect and test cleanup', 'info');
      console.log('');

      // Keep connection alive to receive periodic updates
      // Let it run for some time to see at least 2 periodic updates
      await new Promise((resolve) => {
        let updateCount = 0;

        // Monitor stats updates
        this.socket.on('online-stats', () => {
          updateCount++;

          // After receiving a few updates, we can demonstrate disconnection
          if (updateCount >= 3) {
            // Initial + 2 periodic
            this.log('📋 Received enough updates, will disconnect in 5 seconds...', 'info');
            setTimeout(() => {
              resolve();
            }, 5000);
          }
        });

        // Safety timeout - disconnect after 2 minutes even if we don't get enough updates
        setTimeout(() => {
          this.log('⏰ Timeout reached, disconnecting...', 'warning');
          resolve();
        }, 120000); // 2 minutes
      });

      // Step 3: Disconnect and observe cleanup
      this.log('🔌 Disconnecting from WebSocket...', 'websocket');
      this.socket.disconnect();

      this.log('Waiting 5 seconds for server cleanup...', 'info');
      await new Promise((resolve) => setTimeout(resolve, 5000));

      this.log('✅ Simulation completed successfully!', 'success');
      this.log('', 'info');
      this.log('📊 EXPECTED BEHAVIOR:', 'stats');
      this.log('   1. Active users should be 1 when you connected', 'info');
      this.log('   2. Stats updates should occur every 25 seconds', 'info');
      this.log('   3. After disconnect, active users should drop to 0', 'info');
      this.log('   (You can verify by connecting another client)', 'info');
    } catch (error) {
      this.log(`Simulation failed: ${error.message}`, 'error');
      console.error('Full error:', error);
      process.exit(1);
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n');
  console.log('👋 Shutting down gracefully...');
  console.log('📊 This disconnect should reduce active users by 1');
  process.exit(0);
});

// Run the simulation
const simulator = new StatsClientSimulator();
simulator.runSimulation().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
