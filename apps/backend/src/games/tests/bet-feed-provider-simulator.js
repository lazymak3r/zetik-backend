#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-require-imports */
const axios = require('axios');
const io = require('socket.io-client');
const { randomUUID } = require('crypto');

// Config
const API_BASE = process.env.TEST_BACKEND_URL || 'http://localhost:4000/v1';
const WS_URL = process.env.TEST_WS_URL || 'http://localhost:4000/bet-feed';

// Test user
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'TestPassword123',
};

// Provider payload defaults
const DEV = process.env.PROVIDER_DEV || 'pragmaticplay';
const GAME = process.env.PROVIDER_GAME || 'sugar-rush';

class ProviderBetFeedSimulator {
  constructor() {
    this.token = null;
    this.user = null;
    this.socket = null;
    this.connected = false;
    this.receivedProvider = [];
  }

  log(msg, type = 'info') {
    const t = new Date().toLocaleTimeString();
    const p = { info: '📋', success: '✅', error: '❌', ws: '🔌', test: '🧪' }[type] || 'ℹ️';
    console.log(`[${t}] ${p} ${msg}`);
  }

  async login() {
    this.log('Authenticating user...', 'test');
    const res = await axios.post(`${API_BASE}/auth/login/email`, TEST_USER);
    this.token = res.data.accessToken;
    this.user = res.data.user;
    this.log(`Authenticated as ${this.user.id}`, 'success');
  }

  async connectWS() {
    this.log('Connecting WS...', 'ws');
    return new Promise((resolve, reject) => {
      this.socket = io(WS_URL, { auth: { token: this.token }, transports: ['websocket'] });
      this.socket.on('connect', () => {
        this.connected = true;
        this.log(`WS connected: ${this.socket.id}`, 'ws');
        resolve();
      });
      this.socket.on('bet-feed-delta', (data) => {
        const items = data?.data?.newBets || [];
        for (const it of items) {
          if (it.game?.gameType === 'PROVIDER') {
            this.receivedProvider.push(it);
            this.log(
              `PROVIDER WS: ${it.game.name} | code=${it.game.gameCode} | asset=${it.cryptoAsset}`,
              'success',
            );
          }
        }
      });
      this.socket.on('connect_error', (e) => reject(e instanceof Error ? e : new Error(String(e))));
    });
  }

  async simulateProviderBet() {
    this.log('Simulating ST8 debit/credit...', 'test');
    const transactionId = randomUUID();
    const providerTxId = randomUUID();
    const sessionToken = randomUUID();
    const roundId = randomUUID();

    // debit
    await axios.post(
      `${API_BASE}/provider-games/st8/debit`,
      {
        player: this.user.id,
        site: 'test-site',
        token: sessionToken,
        transaction_id: transactionId,
        round: roundId,
        amount: '0.10',
        currency: 'USD',
        game_code: GAME,
        developer_code: DEV,
        provider_kind: 'debit',
        provider: {
          transaction_id: providerTxId,
          amount: '0.10',
          currency: 'USD',
          player: this.user.id,
        },
      },
      { headers: { 'x-st8-signature': 'dev' } },
    );
    this.log(`Debit ok: ${transactionId}`, 'success');

    // credit
    await axios.post(
      `${API_BASE}/provider-games/st8/credit`,
      {
        player: this.user.id,
        site: 'test-site',
        token: sessionToken,
        transaction_id: randomUUID(),
        round: roundId,
        amount: '0.25',
        currency: 'USD',
        game_code: GAME,
        developer_code: DEV,
        provider_kind: 'credit',
        provider: {
          transaction_id: providerTxId, // must match debit
          amount: '0.25',
          currency: 'USD',
          player: this.user.id,
        },
      },
      { headers: { 'x-st8-signature': 'dev' } },
    );
    this.log(`Credit ok`, 'success');
  }

  async run() {
    console.log('🧪 Bet Feed Provider Simulator');
    console.log('═'.repeat(60));
    console.log(`API: ${API_BASE}`);
    console.log(`WS:  ${WS_URL}`);
    console.log('═'.repeat(60));

    await this.login();
    await this.connectWS();
    await this.simulateProviderBet();

    // wait for WS
    await new Promise((r) => setTimeout(r, 3000));

    if (this.receivedProvider.length === 0) {
      this.log('No provider bets received over WS yet, checking REST...', 'warning');
      const res = await axios.get(`${API_BASE}/bet-feed/all-bets`);
      const bets = res.data?.bets || [];
      const providers = bets.filter((b) => b.game?.gameType === 'PROVIDER');
      if (providers.length > 0) {
        this.log(
          `API PROVIDER: ${providers[0].game.name} | code=${providers[0].game.gameCode}`,
          'success',
        );
      } else {
        this.log('❌ No provider bets found via REST either', 'error');
        process.exit(1);
      }
    }

    this.log('✅ Provider simulator finished', 'success');
    process.exit(0);
  }
}

new ProviderBetFeedSimulator().run().catch((e) => {
  console.error('❌ Simulator error:', e?.response?.data || e.message || e);
  process.exit(1);
});
