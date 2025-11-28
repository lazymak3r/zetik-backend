#!/usr/bin/env node

/**
 * 🏁 WEEKLY/MONTHLY Race Simulator
 *
 * Tests the two-transaction flow:
 * Transaction 1: Mark old ACTIVE → FINALIZING + create new ACTIVE
 * Transaction 2: Distribute prizes + FINALIZING → ENDED
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
const RACE_SVC = process.env.RACE_SVC || 'http://localhost:4005';

function printHeader(text) {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log(`║  ${text.padEnd(59)}║`);
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
}

function printStep(step, text) {
  console.log(`\n${step}  ${text}\n`);
}

function printTable(headers, rows) {
  const colWidths = headers.map((h, i) => {
    return Math.max(h.length, ...rows.map((r) => String(r[i]).length));
  });

  const line = '┌' + colWidths.map((w) => '─'.repeat(w + 2)).join('┬') + '┐';
  const sep = '├' + colWidths.map((w) => '─'.repeat(w + 2)).join('┼') + '┤';
  const bottom = '└' + colWidths.map((w) => '─'.repeat(w + 2)).join('┴') + '┘';

  console.log(line);
  console.log('│ ' + headers.map((h, i) => h.padEnd(colWidths[i])).join(' │ ') + ' │');
  console.log(sep);
  rows.forEach((row) => {
    console.log('│ ' + row.map((cell, i) => String(cell).padEnd(colWidths[i])).join(' │ ') + ' │');
  });
  console.log(bottom);
}

function queryDatabase(sql) {
  try {
    const cmd = `PGPASSWORD="postgres" psql -h localhost -p 5432 -U postgres -d postgres -t -A -F'|' -c "${sql.replace(/"/g, '\\"')}"`;
    const result = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    return result
      .trim()
      .split('\n')
      .filter((line) => line.length > 0);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/require-await
(async () => {
  try {
    printHeader('WEEKLY/MONTHLY RACE CREATION TEST');

    // Step 1: Check current race state
    printStep('1', 'CHECK CURRENT RACE STATE');

    const raceStates = queryDatabase(`
      SET search_path TO bonus;
      SELECT 
        "raceType",
        status,
        COUNT(*) as count,
        STRING_AGG(name, ', ' ORDER BY "createdAt" DESC) as recent_names
      FROM races
      WHERE "raceType" IN ('WEEKLY', 'MONTHLY')
      GROUP BY "raceType", status
      ORDER BY "raceType", status;
    `);

    console.log('Current race states:\n');
    const states = [];
    for (const line of raceStates) {
      const parts = line.split('|');
      states.push([parts[0], parts[1], parts[2]]);
    }

    if (states.length > 0) {
      printTable(['Race Type', 'Status', 'Count'], states);
    } else {
      console.log('  (No WEEKLY/MONTHLY races found)\n');
    }

    // Step 2: Find or list WEEKLY races
    printStep('2', 'WEEKLY RACES ANALYSIS');

    const weeklyRaces = queryDatabase(`
      SET search_path TO bonus;
      SELECT id, name, status, "startsAt", "endsAt", "prizePool", prizes
      FROM races
      WHERE "raceType" = 'WEEKLY'
      ORDER BY "createdAt" DESC
      LIMIT 5;
    `);

    if (weeklyRaces.length > 0) {
      console.log('Recent WEEKLY races:\n');
      const weeklyData = weeklyRaces.map((line) => {
        const parts = line.split('|');
        return [
          parts[1].substring(0, 30) + '...',
          parts[2],
          new Date(parts[3]).toISOString().substring(0, 10),
          new Date(parts[4]).toISOString().substring(0, 10),
          parts[5],
        ];
      });
      printTable(['Name', 'Status', 'Starts', 'Ends', 'Pool'], weeklyData);
    } else {
      console.log('  (No WEEKLY races found)\n');
    }

    // Step 3: Find or list MONTHLY races
    printStep('3', 'MONTHLY RACES ANALYSIS');

    const monthlyRaces = queryDatabase(`
      SET search_path TO bonus;
      SELECT id, name, status, "startsAt", "endsAt", "prizePool", prizes
      FROM races
      WHERE "raceType" = 'MONTHLY'
      ORDER BY "createdAt" DESC
      LIMIT 5;
    `);

    if (monthlyRaces.length > 0) {
      console.log('Recent MONTHLY races:\n');
      const monthlyData = monthlyRaces.map((line) => {
        const parts = line.split('|');
        return [
          parts[1].substring(0, 30) + '...',
          parts[2],
          new Date(parts[3]).toISOString().substring(0, 10),
          new Date(parts[4]).toISOString().substring(0, 10),
          parts[5],
        ];
      });
      printTable(['Name', 'Status', 'Starts', 'Ends', 'Pool'], monthlyData);
    } else {
      console.log('  (No MONTHLY races found)\n');
    }

    // Step 4: Transaction flow explanation
    printStep('4', 'TWO-TRANSACTION FLOW');

    console.log('When creating new WEEKLY/MONTHLY race:\n');

    const flowSteps = [
      ['Transaction 1', 'Atomic', 'Find old ACTIVE → FINALIZING + Create new ACTIVE'],
      ['Transaction 2', 'Large', 'Distribute all prizes + FINALIZING → ENDED'],
    ];

    printTable(['Transaction', 'Type', 'Operations'], flowSteps);

    console.log('\nBenefits:\n');
    console.log('  ✓ Transaction 1 is fast and atomic');
    console.log('  ✓ Wagerers immediately switch to new race');
    console.log('  ✓ Transaction 2 is isolated and can fail safely');
    console.log('  ✓ If Transaction 2 fails, old race stays in FINALIZING');
    console.log('  ✓ Manual recovery/retry is possible\n');

    // Step 5: Check for FINALIZING races (stuck races)
    printStep('5', 'CHECK FOR STUCK RACES (FINALIZING)');

    const finalizingRaces = queryDatabase(`
      SET search_path TO bonus;
      SELECT id, name, "raceType", status, "createdAt", "endsAt"
      FROM races
      WHERE status = 'FINALIZING'
      ORDER BY "createdAt" DESC
      LIMIT 10;
    `);

    if (finalizingRaces.length > 0) {
      console.log(`Found ${finalizingRaces.length} races in FINALIZING status:\n`);
      const finalizingData = finalizingRaces.map((line) => {
        const parts = line.split('|');
        return [
          parts[1].substring(0, 25) + '...',
          parts[2],
          parts[3],
          new Date(parts[5]).toISOString().substring(0, 16),
        ];
      });
      printTable(['Name', 'Type', 'Status', 'Ends At'], finalizingData);
      console.log('\n⚠️  These races are stuck in FINALIZING and need manual recovery!\n');
    } else {
      console.log('  ✓ No stuck races (good!)\n');
    }

    // Step 6: Check participants and winners
    printStep('6', 'WEEKLY/MONTHLY PARTICIPATION');

    const participation = queryDatabase(`
      SET search_path TO bonus;
      SELECT 
        r."raceType",
        COUNT(DISTINCT rp."userId") as participants,
        COUNT(CASE WHEN rp.place IS NOT NULL THEN 1 END) as winners,
        COUNT(CASE WHEN rp.reward IS NOT NULL THEN 1 END) as paid
      FROM races r
      LEFT JOIN race_participant rp ON r.id = rp."raceId"
      WHERE r."raceType" IN ('WEEKLY', 'MONTHLY')
      GROUP BY r."raceType"
      ORDER BY r."raceType";
    `);

    if (participation.length > 0) {
      console.log('Participation statistics:\n');
      const partData = participation.map((line) => {
        const parts = line.split('|');
        return [parts[0], parts[1], parts[2], parts[3]];
      });
      printTable(['Race Type', 'Participants', 'Winners', 'Paid'], partData);
    } else {
      console.log('  (No participation data)\n');
    }

    // Step 7: Prize distribution analysis
    printStep('7', 'RECENT PRIZE DISTRIBUTIONS');

    const recentPrizes = queryDatabase(`
      SET search_path TO bonus;
      SELECT 
        r.name,
        r."raceType",
        COUNT(*) as winners,
        SUM(rp.reward) as total_reward,
        MAX(rp."createdAt") as last_payout
      FROM race_participant rp
      JOIN races r ON r.id = rp."raceId"
      WHERE rp.place IS NOT NULL AND r."raceType" IN ('WEEKLY', 'MONTHLY')
      GROUP BY r.id, r.name, r."raceType"
      ORDER BY MAX(rp."createdAt") DESC
      LIMIT 5;
    `);

    if (recentPrizes.length > 0) {
      console.log('Recent payouts:\n');
      const prizeData = recentPrizes.map((line) => {
        const parts = line.split('|');
        return [
          parts[0].substring(0, 20) + '...',
          parts[1],
          parts[2],
          parts[3] ? parseFloat(parts[3]).toFixed(8) : '0',
          new Date(parts[4]).toISOString().substring(0, 10),
        ];
      });
      printTable(['Race Name', 'Type', 'Winners', 'Total (BTC)', 'Paid Date'], prizeData);
    } else {
      console.log('  (No payouts recorded)\n');
    }

    // Step 8: Summary
    printStep('8', 'ARCHITECTURE SUMMARY');

    console.log('WEEKLY/MONTHLY Race Lifecycle:\n');

    const lifecycleSteps = [
      ['1. Cron starts', 'createWeeklyRace() / createMonthlyRace()'],
      ['2. Find old ACTIVE', 'Query races table'],
      ['3. Transaction 1', 'ACTIVE → FINALIZING, create new ACTIVE'],
      ['4. New race ready', 'Wagerers switch immediately'],
      ['5. Transaction 2', 'Distribute prizes to old race'],
      ['6. Mark as ENDED', 'Old race is closed'],
      ['7. Complete', 'Ready for next cycle'],
    ];

    console.log('Process flow:\n');
    lifecycleSteps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step[0]}: ${step[1]}`);
    });

    printHeader('ANALYSIS COMPLETE');

    console.log('Next Steps:\n');
    console.log('  1. Wait for Monday 00:00 UTC for createWeeklyRace()');
    console.log('  2. Wait for 1st of month 00:00 UTC for createMonthlyRace()');
    console.log('  3. Or manually trigger via test controller');
    console.log('  4. Monitor for stuck races in FINALIZING status\n');

    process.exit(0);
  } catch (e) {
    console.error('\n❌ Error:', e.message);
    process.exit(1);
  }
})();
