#!/usr/bin/env node

import axios from 'axios';

// Minimal simulator to trigger ONE major rank-up (e.g., Bronze -> Silver)
// and rely on backend to send Intercom message on rank change.

const API_BASE = process.env.TEST_BACKEND_URL || 'http://localhost:3000/v1';
const SIMULATOR_SECRET = process.env.VIP_SIMULATOR_SECRET || 'dev-secret-123';

const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test@example.com',
  password: process.env.TEST_USER_PASSWORD || 'TestPassword123',
};

function log(msg, type = 'info') {
  const ts = new Date().toLocaleTimeString();
  const icon = { info: 'ℹ️', ok: '✅', err: '❌', step: '▶️' }[type] || '•';
  console.log(`[${ts}] ${icon} ${msg}`);
}

async function req(endpoint, method = 'GET', body, token) {
  const cfg = {
    method,
    url: `${API_BASE}${endpoint}`,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined && body !== null && method.toUpperCase() !== 'GET') {
    cfg.data = body;
  }
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  if (endpoint.includes('vip-bonus-simulator'))
    cfg.headers['x-simulator-secret'] = SIMULATOR_SECRET;
  try {
    const { data } = await axios(cfg);
    return data;
  } catch (e) {
    const status = e.response?.status;
    const message = e.response?.data?.message || e.message;
    throw new Error(`HTTP ${status || 'ERROR'} ${endpoint}: ${JSON.stringify(message)}`);
  }
}

async function main() {
  log('Rank-up Intercom simulator started', 'step');
  log(`API: ${API_BASE}`);

  // 1) Login
  log('Authenticating test user...', 'step');
  const login = await req('/auth/login/email', 'POST', {
    email: TEST_USER.email,
    password: TEST_USER.password,
  });
  const token = login.accessToken;
  const user = login.user;
  log(`Logged in as ${user.id}`, 'ok');

  // 2) Clean slate
  log('Resetting VIP/user stats...', 'step');
  await req('/vip-bonus-simulator/reset-user-stats', 'POST', { userId: user.id }, token);

  // 3) Load tiers and current status (use raw simulator endpoint to avoid public endpoint variations)
  const tiers = await req('/vip-bonus-simulator/vip-tiers', 'GET', null, token); // cents
  const status = await req('/bonus/vip-status', 'GET', null, token);
  const currentLevel = status.currentLevel || 0;
  const currentWagerCents = parseInt(status.currentWager || '0');
  log(`Current: level=${currentLevel}, wager=$${(currentWagerCents / 100).toFixed(2)}`);

  // Major ranks first levels in our system
  const majorFirstLevels = [1, 5, 9, 13, 17, 20, 23];
  const targetLevel = majorFirstLevels.find((lvl) => lvl > currentLevel) || 1;
  const targetTier = tiers.find((t) => t.level === targetLevel);
  if (!targetTier) throw new Error(`Target tier ${targetLevel} not found`);

  // 4) Place a single simulator session bet to cross into target major rank
  const targetWagerCents = Math.max(0, Math.round(parseFloat(targetTier.wagerRequirement))); // raw cents
  const neededCents = Math.max(0, targetWagerCents - currentWagerCents + 100);
  log(
    `Targeting major rank level ${targetLevel} (${targetTier.name}), placing +$${(neededCents / 100).toFixed(2)} wager...`,
    'step',
  );
  await req(
    '/vip-bonus-simulator/simulate-game-session',
    'POST',
    {
      userId: user.id,
      games: [{ betAmount: String(neededCents), winAmount: '0' }],
    },
    token,
  );

  // 5) Wait and verify
  await new Promise((r) => setTimeout(r, 600));
  const after = await req('/bonus/vip-status', 'GET', null, token);
  log(
    `After: level=${after.currentLevel}, tier=${after.tierName}, wager=$${(parseInt(after.currentWager) / 100).toFixed(2)}`,
  );

  if ((after.currentLevel || 0) >= targetLevel)
    log(`Major rank crossed to ${targetTier.name}`, 'ok');
  else log(`Did not reach target level ${targetLevel}`, 'err');

  // 6) Instruction: check Intercom
  console.log('\n=== Intercom check ===');
  console.log('- Open the Intercom test frontend and use the same userId.');
  console.log('- You should see an automatic message about the new rank.');
  console.log('(The backend sends it on major rank change via IntercomService)');
}

main().catch((e) => {
  log(e.message, 'err');
  process.exit(1);
});
