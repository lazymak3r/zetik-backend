const BASE_URL = 'http://localhost:3000/v1';
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'TestPassword123';

let authToken = '';

async function makeRequest(endpoint, method = 'GET', body = null, useAuth = true) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };
  if (useAuth && authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);

  const res = await fetch(url, config);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = `HTTP ${res.status}: ${typeof data === 'object' ? JSON.stringify(data) : String(data)}`;
    throw new Error(msg);
  }
  return data;
}

async function login() {
  const data = await makeRequest(
    '/auth/login/email',
    'POST',
    {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    },
    false,
  );
  authToken = data.accessToken;
  return data.user;
}

async function getPrimaryAsset() {
  const wallets = await makeRequest('/balance/wallets');
  const primary = wallets.find((w) => w.isPrimary);
  if (!primary) throw new Error('Primary wallet not found');
  return { asset: primary.asset, balance: primary.balance };
}

async function sendTip(toUsernameOrEmail, asset, amount, message) {
  try {
    const body = {
      toUsername: toUsernameOrEmail,
      amount: amount,
      asset: asset,
      publicTip: false,
      message,
    };
    const res = await makeRequest('/balance/tip', 'POST', body);
    console.log(`✅ Tip to '${toUsernameOrEmail}' accepted`);
    console.log(`   sendOperationId=${res.sendOperationId}`);
    console.log(`   receiveOperationId=${res.receiveOperationId}`);
    console.log(`   senderBalance=${res.senderBalance}`);
    console.log(`   receiverBalance=${res.receiverBalance}`);
    return { ok: true };
  } catch (err) {
    const msg = String(err.message || err);
    // For this check, getting 404 means lookup by username/email failed.
    // Getting 400 InsufficientBalance still proves username/email was resolved.
    const isNotFound = msg.includes('404') || msg.toLowerCase().includes('not found');
    if (isNotFound) {
      console.log(`❌ Tip to '${toUsernameOrEmail}' failed: user not found`);
      return { ok: false, notFound: true };
    }
    console.log(
      `⚠️ Tip to '${toUsernameOrEmail}' responded with error (likely OK for insufficient balance): ${msg}`,
    );
    return { ok: false, notFound: false };
  }
}

async function run() {
  console.log('🚀 Tip API simulator');
  console.log(`🔗 Base URL: ${BASE_URL}`);
  console.log(`📧 Login: ${TEST_EMAIL}`);

  const user = await login();
  console.log(`✅ Logged in as ${user.username} (${user.id})`);

  const { asset } = await getPrimaryAsset();
  console.log(`💼 Primary asset: ${asset}`);

  const amount = '0.00000100';
  const message = 'test tip';

  console.log('\n→ Sending tip by username: john_doe');
  await sendTip('john_doe', asset, amount, message);

  console.log('\n→ Sending tip by email: test1@example.com');
  await sendTip('test1@example.com', asset, amount, message);

  console.log('\n✅ Finished. Review logs above to confirm username/email resolution.');
}

run().catch((e) => {
  console.error('💥 Simulator failed:', e);
  process.exit(1);
});
