#!/usr/bin/env node

// This is a duplicate of crash-client-simulator.js configured for a second user
// Default credentials target test1@example.com; can be overridden by env vars

import { post } from 'axios';
import io from 'socket.io-client';

// Configuration
const API_BASE = process.env.TEST_BACKEND_URL || 'http://localhost:3000/v1';
const WS_URL = 'http://localhost:3000/crash';
const NOTIFICATION_WS_URL = 'http://localhost:3000/notifications';

// User credentials - USER MUST BE REGISTERED BEFORE RUNNING TESTS
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test1@example.com',
  password: process.env.TEST_USER_PASSWORD || 'TestPassword123',
};

// Test settings: amount to bet in crypto (BTC)
const TEST_BET_AMOUNT = process.env.TEST_BET_AMOUNT || '0.00001';

class CrashGameSimulator2 {
  constructor() {
    this.token = null;
    this.user = null;
    this.socket = null;
    this.notificationSocket = null;
    this.currentGameId = null;
    this.gameStatus = null;
    this.connected = false;
    this.inRoom = false;
    this.notificationConnected = false;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix =
      {
        info: '📋',
        success: '✅',
        error: '❌',
        warning: '⚠️',
        websocket: '🔌',
        game: '🎮',
        bet: '💰',
        cash: '💸',
        setup: '🔧',
      }[type] || 'ℹ️';

    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async login() {
    const response = await post(`${API_BASE}/auth/login/email`, {
      email: TEST_USER.email,
      password: TEST_USER.password,
    });
    this.token = response.data.accessToken;
    this.user = response.data.user;
    this.log(`Login ok. User ID: ${this.user.id}`, 'success');
  }

  async connectSockets() {
    this.socket = io(WS_URL, { auth: { token: this.token }, transports: ['websocket'] });
    this.notificationSocket = io(NOTIFICATION_WS_URL, {
      auth: { token: this.token },
      transports: ['websocket'],
    });

    await new Promise((resolve, reject) => {
      let ok = 0;
      const done = () => {
        ok += 1;
        if (ok === 2) resolve(true);
      };
      this.socket.on('connect', done);
      this.notificationSocket.on('connect', done);
      const to = setTimeout(() => reject(new Error('socket connect timeout')), 5000);
      this.socket.on('connect', () => clearTimeout(to));
    });

    // Basic listeners
    this.socket.on('crash:game_crashed', (data) => {
      this.log(
        `GAME CRASHED: ${data.data.crashPoint}x winners=${data.data.winnersExist} betId=${data.data.betId || 'n/a'} cashOutAt=${data.data.cashOutAt || 'n/a'}`,
        'game',
      );
    });

    this.socket.on('crash:bet_placed', (data) => {
      if (data?.data?.userId !== this.user.id) {
        this.log(`Other player bet: ${data.data.betAmount} ${data.data.asset}`, 'bet');
      }
    });
  }

  async joinRoom() {
    return new Promise((resolve) => {
      this.socket.emit('crash:join_room', { userId: this.user.id });
      this.socket.on('crash:room_joined', () => resolve(true));
    });
  }

  async run() {
    console.log('🚀 Crash Game Simulator 2 (test1@example.com)');
    console.log(`🌐 Backend: ${API_BASE}`);
    await this.login();
    await this.connectSockets();
    await this.joinRoom();

    // Optional: place a small auto bet to have a winner sometimes
    this.socket.on('crash:game_state', (data) => {
      if (data?.data?.status === 'WAITING' && !this._betPlaced) {
        this._betPlaced = true;
        const betData = { userId: this.user.id, betAmount: TEST_BET_AMOUNT, autoCashOutAt: '1.2' };
        this.log(
          `Placing small auto bet: ${betData.betAmount} BTC @ ${betData.autoCashOutAt}x`,
          'bet',
        );
        this.socket.emit('crash:place_bet', betData);
        setTimeout(() => {
          this._betPlaced = false;
        }, 15000);
      }
    });
  }
}

const sim2 = new CrashGameSimulator2();
sim2.run().catch((e) => {
  console.error(e);
  process.exit(1);
});
