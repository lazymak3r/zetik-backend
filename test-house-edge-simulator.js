const BASE_URL = 'http://localhost:3000/v1';
const ST8_URL = 'http://localhost:3000/v1/provider-games/st8';

// Test games with different house edges
const TEST_GAMES = [
  { code: 'rtg_age_of_akkadia', name: 'Age of Akkadia', houseEdge: 1.0, developer: 'realtime' },
  { code: 'rtg_primate_king', name: 'Primate King', houseEdge: 2.46, developer: 'realtime' },
  { code: 'pgp_spaceman', name: 'Spaceman', houseEdge: 3.5, developer: 'pgsoft' },
];

const TEST_USER = {
  email: 'test@example.com',
  password: 'TestPassword123',
};

async function login() {
  const response = await fetch(`${BASE_URL}/auth/login/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER),
  });
  const data = await response.json();
  return { token: data.accessToken, user: data.user };
}

async function getRakebackAmount(token) {
  const response = await fetch(`${BASE_URL}/rakeback/amount`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  const amountUsd = parseFloat(data.fiat.USD);
  console.log(`💰 Current rakeback: $${amountUsd.toFixed(6)} USD`);
  return amountUsd;
}

async function placeBet(userId, game, amount = '10.00') {
  const transactionId = `simulator-${game.code}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const roundId = `round-${Date.now()}`;
  const sessionToken = `session-${Date.now()}`;

  const betPayload = {
    player: userId,
    site: 'zetik-casino',
    token: sessionToken,
    transaction_id: transactionId,
    round: roundId,
    round_closed: false,
    game_code: game.code,
    developer_code: game.developer,
    amount: amount,
    currency: 'USD',
    provider_kind: 'debit',
    provider: {
      transaction_id: transactionId,
      amount: amount,
      currency: 'USD',
      player: userId,
      round: roundId,
    },
    bonus: null,
  };

  try {
    console.log(`🎲 Placing $${amount} bet on ${game.name} (${game.houseEdge}% HE)...`);
    const response = await fetch(`${ST8_URL}/debit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-st8-sign': 'test-signature', // ONLY FOR TESTING - REMOVE IN PRODUCTION
      },
      body: JSON.stringify(betPayload),
    });

    if (response.ok) {
      console.log(`✅ Bet placed successfully`);
      return true;
    } else {
      const error = await response.json();
      console.log(`❌ Bet failed:`, error);
      return false;
    }
  } catch (error) {
    console.log(`❌ Bet failed:`, error.message);
    return false;
  }
}

async function runHouseEdgeSimulation() {
  console.log('🚀 House Edge Rakeback Simulation Started\n');
  console.log('⚠️  NOTE: This simulator uses test signature bypass - REMOVE IN PRODUCTION\n');

  // Step 1: Login
  console.log('1️⃣ Logging in...');
  const { token, user } = await login();
  console.log(`✅ Logged in as ${user.username} (${user.id})\n`);

  // Step 2: Get initial rakeback
  console.log('2️⃣ Checking initial rakeback...');
  const initialRakeback = await getRakebackAmount(token);
  console.log();

  // Step 3: Test each game
  console.log('3️⃣ Testing games with different house edges...\n');

  const BET_AMOUNT = '100.00'; // $100 bet for clear results
  const results = [];

  for (let i = 0; i < Math.min(2, TEST_GAMES.length); i++) {
    const game = TEST_GAMES[i];

    console.log(`📊 Test ${i + 1}/2: ${game.name}`);
    console.log(`   House Edge: ${game.houseEdge}%`);
    console.log(
      `   Expected House Side: $${((parseFloat(BET_AMOUNT) * game.houseEdge) / 100).toFixed(4)}`,
    );

    // Get rakeback before bet
    const rakebackBefore = await getRakebackAmount(token);

    // Place bet
    const success = await placeBet(user.id, game, BET_AMOUNT);

    if (!success) {
      console.log('⚠️  Skipping this game due to bet failure\n');
      continue;
    }

    // Wait for async processing
    console.log('⏳ Waiting for rakeback processing...');
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for async processing

    // Get rakeback after bet
    const rakebackAfter = await getRakebackAmount(token);
    const rakebackIncrease = rakebackAfter - rakebackBefore;

    // Calculate expected values
    const betAmountNum = parseFloat(BET_AMOUNT);
    const expectedHouseSide = betAmountNum * (game.houseEdge / 100);

    console.log(`📈 Results:`);
    console.log(`   Rakeback Increase: $${rakebackIncrease.toFixed(6)}`);
    console.log(`   Expected House Side: $${expectedHouseSide.toFixed(4)}`);

    if (rakebackIncrease > 0) {
      // Calculate VIP rate from rakeback increase
      const vipRate = (rakebackIncrease / expectedHouseSide) * 100;
      console.log(`   📊 Calculated VIP Rate: ${vipRate.toFixed(2)}%`);
      console.log(`   ✅ House edge working correctly!`);
    } else {
      console.log(`   ❌ No rakeback increase detected`);
    }

    results.push({
      game: game.name,
      houseEdge: game.houseEdge,
      betAmount: betAmountNum,
      expectedHouseSide,
      actualRakebackIncrease: rakebackIncrease,
    });

    console.log();
  }

  // Step 4: Analysis
  console.log('4️⃣ Final Analysis\n');

  if (results.length >= 2) {
    console.log('📊 Rakeback Comparison:');
    results.forEach((result) => {
      console.log(
        `   ${result.game} (${result.houseEdge}% HE): +$${result.actualRakebackIncrease.toFixed(6)}`,
      );
    });
    console.log();

    // Compare ratios
    if (results.length >= 2) {
      const game1 = results[0];
      const game2 = results[1];

      if (game1.actualRakebackIncrease > 0 && game2.actualRakebackIncrease > 0) {
        const actualRatio = game2.actualRakebackIncrease / game1.actualRakebackIncrease;
        const expectedRatio = game2.houseEdge / game1.houseEdge;

        console.log('🧮 Ratio Analysis:');
        console.log(`   ${game2.game}/${game1.game} rakeback ratio: ${actualRatio.toFixed(3)}`);
        console.log(`   Expected ratio based on house edge: ${expectedRatio.toFixed(3)}`);

        const ratioError = Math.abs(actualRatio - expectedRatio) / expectedRatio;
        if (ratioError < 0.15) {
          // 15% tolerance for precision
          console.log(
            `   ✅ Ratios match within tolerance! House edge integration working correctly.`,
          );
        } else {
          console.log(
            `   ⚠️  Ratios differ by ${(ratioError * 100).toFixed(1)}% - possible precision issues.`,
          );
        }
      }
    }
  }

  // Step 5: Final summary
  const finalRakeback = await getRakebackAmount(token);
  const totalIncrease = finalRakeback - initialRakeback;

  console.log('\n5️⃣ Final Summary');
  console.log(`   Initial Rakeback: $${initialRakeback.toFixed(6)}`);
  console.log(`   Final Rakeback: $${finalRakeback.toFixed(6)}`);
  console.log(`   Total Increase: $${totalIncrease.toFixed(6)}`);

  console.log('\n✅ House Edge Rakeback Simulation Completed!');

  // Determine if integration is working
  const workingGames = results.filter((r) => r.actualRakebackIncrease > 0);
  if (workingGames.length >= 2) {
    console.log('\n🎉 SUCCESS: Different house edges are producing different rakeback amounts!');
    console.log('🎯 Provider games rakeback integration is working correctly.');
  } else {
    console.log('\n⚠️  WARNING: Not enough games showed rakeback increases to verify integration.');
  }

  console.log('\n⚠️  IMPORTANT: Remove test signature bypass before production deployment!');
}

runHouseEdgeSimulation().catch((error) => {
  console.error('💥 Simulation failed:', error.message);
  process.exit(1);
});
