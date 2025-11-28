#!/usr/bin/env node

const API_BASE = process.env.TEST_BACKEND_URL || 'http://localhost:4000/v1';
const WS_BASE = process.env.TEST_WS_URL || 'ws://localhost:4000';

class AffiliateRaceSimulator {
  constructor() {
    this.mainUser = null;
    this.mainUserToken = null;
    this.referredUser = null;
    this.referredUserToken = null;
    this.affiliateCampaign = null;
    this.affiliateRace = null;
    this.weeklyRace = null;
    this.monthlyRace = null;
    this.ws = null;
    this.wsEvents = [];
    this.results = {};
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0,
        v = c == 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix =
      {
        info: '📋',
        success: '✅',
        error: '❌',
        warning: '⚠️',
        affiliate: '🤝',
        race: '🏁',
        bet: '💰',
        websocket: '🔌',
      }[type] || 'ℹ️';

    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async makeRequest(endpoint, method = 'GET', body = null, token = null) {
    const fetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      fetchOptions.headers.Authorization = `Bearer ${token}`;
    }

    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, fetchOptions);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(error.message);
    }
  }

  async test1_registerMainUser() {
    this.log('Test 1: Register Main User (Affiliate Campaign Owner)', 'info');

    try {
      const timestamp = Date.now();
      const userData = {
        email: `mainuser${timestamp}@example.com`,
        password: 'TestPassword123',
        username: `mainuser${timestamp}`,
      };

      const response = await this.makeRequest('/auth/register/email', 'POST', userData);

      this.mainUser = response.user;
      this.mainUserToken = response.accessToken;

      this.log(
        `Main user registered: ${this.mainUser.username} (ID: ${this.mainUser.id})`,
        'success',
      );

      return {
        success: true,
        details: `Main user ${this.mainUser.username} registered`,
        userId: this.mainUser.id,
      };
    } catch (error) {
      this.log(`Failed to register main user: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test2_createAffiliateCampaign() {
    this.log('Test 2: Create Affiliate Campaign', 'affiliate');

    try {
      const shortId = Date.now().toString().slice(-8);
      const campaignCode = `test${shortId}`;

      const response = await this.makeRequest(
        '/affiliate/campaigns',
        'POST',
        {
          name: `Test Campaign ${shortId}`,
          description: 'Testing affiliate and race integration',
          code: campaignCode,
        },
        this.mainUserToken,
      );

      this.affiliateCampaign = response;

      this.log(
        `Affiliate campaign created: ${this.affiliateCampaign.name} (Code: ${this.affiliateCampaign.code})`,
        'success',
      );

      return {
        success: true,
        details: `Campaign created with code ${this.affiliateCampaign.code}`,
        campaignId: this.affiliateCampaign.id,
      };
    } catch (error) {
      this.log(`Failed to create campaign: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test3_fundMainUser() {
    this.log('Test 3: Check Main User Balance', 'info');
    this.log(
      '⚠️  Manual step: Please fund main user balance via deposits or admin panel',
      'warning',
    );

    try {
      const balance = await this.makeRequest('/balance/wallets', 'GET', null, this.mainUserToken);

      const btcBalance = parseFloat(balance.primaryWallet?.balance || '0');
      const hasBalance = btcBalance > 0.1;

      if (hasBalance) {
        this.log(
          `Main user balance: ${balance.primaryWallet?.balance || '0'} ${balance.primaryWallet?.asset || 'N/A'}`,
          'success',
        );
      } else {
        this.log(
          `⚠️  Low balance: ${btcBalance} BTC. Please deposit at least 0.1 BTC to continue`,
          'warning',
        );
      }

      return {
        success: hasBalance,
        details: `Main user balance: ${balance.primaryWallet?.balance || '0'} BTC`,
      };
    } catch (error) {
      this.log(`Failed to check main user balance: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test4_createAffiliateRace() {
    this.log('Test 4: Create Affiliate Race', 'race');

    try {
      const response = await this.makeRequest(
        '/affiliate/races',
        'POST',
        {
          referralCode: this.affiliateCampaign.code,
          raceDuration: '1d',
          asset: 'BTC',
          fiat: null,
          prizes: [50000, 30000, 20000], // satoshi: 0.0005, 0.0003, 0.0002 BTC
        },
        this.mainUserToken,
      );

      this.affiliateRace = response;

      this.log(
        `Affiliate race created: ${this.affiliateRace.name} (Status: ${this.affiliateRace.status})`,
        'success',
      );
      this.log(`  Prize Pool: ${this.affiliateRace.prizePool} satoshi`, 'info');
      this.log(`  Starts: ${this.affiliateRace.startsAt}`, 'info');
      this.log(`  Ends: ${this.affiliateRace.endsAt}`, 'info');

      return {
        success: true,
        details: `Race ${this.affiliateRace.name} created`,
        raceId: this.affiliateRace.id,
      };
    } catch (error) {
      this.log(`Failed to create race: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test5_registerReferredUser() {
    this.log('Test 5: Register Referred User (via Referral Code)', 'info');

    try {
      const timestamp = Date.now();
      const userData = {
        email: `referred${timestamp}@example.com`,
        password: 'TestPassword123',
        username: `referred${timestamp}`,
        affiliateCampaignId: this.affiliateCampaign.code,
      };

      const response = await this.makeRequest('/auth/register/email', 'POST', userData);

      this.referredUser = response.user;
      this.referredUserToken = response.accessToken;

      this.log(
        `Referred user registered: ${this.referredUser.username} (ID: ${this.referredUser.id})`,
        'success',
      );
      this.log(`  Referral Code: ${this.affiliateCampaign.code}`, 'info');

      return {
        success: true,
        details: `Referred user ${this.referredUser.username} registered`,
        userId: this.referredUser.id,
      };
    } catch (error) {
      this.log(`Failed to register referred user: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test6_fundReferredUser() {
    this.log('Test 6: Check Referred User Balance', 'info');
    this.log(
      '⚠️  Manual step: Please fund referred user balance via deposits or admin panel',
      'warning',
    );

    try {
      const balance = await this.makeRequest(
        '/balance/wallets',
        'GET',
        null,
        this.referredUserToken,
      );

      const btcBalance = parseFloat(balance.primaryWallet?.balance || '0');
      const hasBalance = btcBalance > 0.01;

      if (hasBalance) {
        this.log(
          `Referred user balance: ${balance.primaryWallet?.balance || '0'} ${balance.primaryWallet?.asset || 'N/A'}`,
          'success',
        );
      } else {
        this.log(
          `⚠️  Low balance: ${btcBalance} BTC. Please deposit at least 0.01 BTC to continue`,
          'warning',
        );
      }

      return {
        success: hasBalance,
        details: `Referred user balance: ${balance.primaryWallet?.balance || '0'} BTC`,
      };
    } catch (error) {
      this.log(`Failed to check referred user balance: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  test7_checkAffiliateRaceStatus() {
    this.log('Test 7: Check Affiliate Race Status', 'race');
    this.log('⚠️  Manual step: Race will auto-activate at scheduled time', 'warning');

    if (!this.affiliateRace) {
      this.log('No affiliate race created', 'warning');
      return { success: false, error: 'No affiliate race created' };
    }

    try {
      // Check if race is PENDING or ACTIVE
      const isReady =
        this.affiliateRace.status === 'PENDING' || this.affiliateRace.status === 'ACTIVE';

      this.log(`  Race: ${this.affiliateRace.name}`, 'info');
      this.log(`  Status: ${this.affiliateRace.status}`, 'info');

      if (isReady) {
        this.log(`  ✅ Race is ready (${this.affiliateRace.status})`, 'success');
      } else {
        this.log(`  ⚠️  Race status: ${this.affiliateRace.status}`, 'warning');
      }

      return {
        success: isReady,
        details: `Race status: ${this.affiliateRace.status}`,
        raceId: this.affiliateRace.id,
      };
    } catch (error) {
      this.log(`Failed to check race status: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test7b_checkAffiliateRaceInCreatorList() {
    this.log('Test 7b: Check Affiliate Race in Creator List (GET /affiliate/races)', 'race');

    try {
      const response = await this.makeRequest('/affiliate/races', 'GET', null, this.mainUserToken);

      const racesCount = response.races?.length || 0;
      const activeRace = response.races?.find((r) => r.id === this.affiliateRace?.id);

      this.log(`  Total races in creator list: ${racesCount}`, 'info');

      if (activeRace) {
        this.log(`  ✅ Affiliate race found in list`, 'success');
        this.log(`    Name: ${activeRace.name}`, 'info');
        this.log(`    Status: ${activeRace.status}`, 'info');
        this.log(
          `    Has leaderboard: ${Array.isArray(activeRace.leaderboard) ? 'Yes' : 'No'}`,
          'info',
        );

        return {
          success: true,
          details: `Found active affiliate race in creator list with leaderboard`,
          raceFound: true,
          hasLeaderboard: Array.isArray(activeRace.leaderboard),
        };
      } else {
        this.log(`  ❌ Affiliate race NOT found in creator list`, 'error');
        return {
          success: false,
          details: `Affiliate race not found in /affiliate/races`,
          raceFound: false,
        };
      }
    } catch (error) {
      this.log(`Failed to check affiliate race in creator list: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test8_getActiveRaces() {
    this.log('Test 8: Get Active Races List', 'race');

    try {
      const response = await this.makeRequest('/bonus/races', 'GET', null, this.referredUserToken);

      const races = response.races || [];

      this.weeklyRace = races.find(
        (r) => r.sponsorId === null && r.referralCode === null && r.name.includes('Weekly'),
      );
      this.monthlyRace = races.find(
        (r) => r.sponsorId === null && r.referralCode === null && r.name.includes('Monthly'),
      );
      const affiliateRaceInList = races.find((r) => r.id === this.affiliateRace?.id);

      this.log(`Found ${races.length} active races`, 'success');
      this.log(`  Weekly Race: ${this.weeklyRace ? this.weeklyRace.name : 'NOT FOUND'}`, 'info');
      this.log(`  Monthly Race: ${this.monthlyRace ? this.monthlyRace.name : 'NOT FOUND'}`, 'info');
      this.log(
        `  Affiliate Race: ${affiliateRaceInList ? affiliateRaceInList.name : 'NOT FOUND'}`,
        'info',
      );

      return {
        success: true,
        details: `Found ${races.length} active races`,
        weeklyRaceFound: !!this.weeklyRace,
        monthlyRaceFound: !!this.monthlyRace,
        affiliateRaceFound: !!affiliateRaceInList,
      };
    } catch (error) {
      this.log(`Failed to get active races: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test9_placeBets() {
    this.log('Test 9: Place Bets (Dice Game)', 'bet');

    try {
      const betsToPlace = 5;
      let betsPlaced = 0;

      for (let i = 0; i < betsToPlace; i++) {
        const betPayload = {
          gameSessionId: this.generateUUID(),
          betAmount: '0.00001',
          betType: 'ROLL_OVER',
          targetNumber: 50,
          clientSeed: `test-${Date.now()}-${i}`,
        };

        const betResult = await this.makeRequest(
          '/games/dice/bet',
          'POST',
          betPayload,
          this.referredUserToken,
        );

        betsPlaced++;

        this.log(
          `  Bet ${i + 1}/${betsToPlace}: ${betResult.outcome} (Payout: ${betResult.payout || 0})`,
          'info',
        );

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      this.log(`Successfully placed ${betsPlaced} bets`, 'success');

      return {
        success: true,
        details: `Placed ${betsPlaced} bets`,
        betsPlaced,
      };
    } catch (error) {
      this.log(`Failed to place bets: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async connectWebSocket(token) {
    return new Promise((resolve, reject) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const WebSocket = require('ws');
        this.ws = new WebSocket(`${WS_BASE}?token=${token}`);

        this.ws.on('open', () => {
          this.log('WebSocket connected', 'info');
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data);
            if (message.event === 'race:leaderboard:update') {
              this.wsEvents.push(message);
              this.log(
                `  WS Event: race:leaderboard:update for race ${message.data?.raceId || 'unknown'}`,
                'info',
              );
            }
          } catch {
            // Ignore parsing errors
          }
        });

        this.ws.on('error', (error) => {
          this.log(`WebSocket error: ${error.message}`, 'warning');
        });

        setTimeout(() => {
          if (this.ws.readyState !== 1) {
            reject(new Error('WebSocket connection timeout'));
          }
        }, 5000);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  disconnectWebSocket() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  async test9b_checkWebSocketEvents() {
    this.log('Test 9b: Check WebSocket Events for All 3 Races', 'websocket');

    try {
      // Connect to WebSocket
      await this.connectWebSocket(this.referredUserToken);

      // Clear previous events
      this.wsEvents = [];

      // Subscribe to race updates
      if (this.ws && this.ws.readyState === 1) {
        this.ws.send(
          JSON.stringify({
            event: 'subscribe',
            data: { channel: 'race:leaderboard' },
          }),
        );
        this.log('  Subscribed to race:leaderboard channel', 'info');
      }

      // Place a bet to trigger events
      const betPayload = {
        gameSessionId: this.generateUUID(),
        betAmount: '0.00001',
        betType: 'ROLL_OVER',
        targetNumber: 50,
        clientSeed: `ws-test-${Date.now()}`,
      };

      await this.makeRequest('/games/dice/bet', 'POST', betPayload, this.referredUserToken);

      // Wait for events
      this.log('  Waiting 10 seconds for WebSocket events...', 'info');
      await new Promise((resolve) => setTimeout(resolve, 10000));

      // Check events
      const weeklyEvents = this.wsEvents.filter((e) => e.data?.raceId === this.weeklyRace?.id);
      const monthlyEvents = this.wsEvents.filter((e) => e.data?.raceId === this.monthlyRace?.id);
      const affiliateEvents = this.wsEvents.filter(
        (e) => e.data?.raceId === this.affiliateRace?.id,
      );

      this.log(`  Events received:`, 'info');
      this.log(
        `    Weekly race: ${weeklyEvents.length} events`,
        weeklyEvents.length > 0 ? 'success' : 'warning',
      );
      this.log(
        `    Monthly race: ${monthlyEvents.length} events`,
        monthlyEvents.length > 0 ? 'success' : 'warning',
      );
      this.log(
        `    Affiliate race: ${affiliateEvents.length} events`,
        affiliateEvents.length > 0 ? 'success' : 'warning',
      );

      const allRacesHaveEvents =
        weeklyEvents.length > 0 && monthlyEvents.length > 0 && affiliateEvents.length > 0;

      this.disconnectWebSocket();

      return {
        success: allRacesHaveEvents,
        details: `WS events: weekly=${weeklyEvents.length}, monthly=${monthlyEvents.length}, affiliate=${affiliateEvents.length}`,
        weeklyEvents: weeklyEvents.length,
        monthlyEvents: monthlyEvents.length,
        affiliateEvents: affiliateEvents.length,
      };
    } catch (error) {
      this.log(`Failed to check WebSocket events: ${error.message}`, 'error');
      this.disconnectWebSocket();
      return { success: false, error: error.message };
    }
  }

  async test10_checkRaceParticipation() {
    this.log('Test 10: Check Race Participation (All 3 Races)', 'race');

    try {
      this.log('Waiting 15 seconds for wager distribution...', 'info');
      await new Promise((resolve) => setTimeout(resolve, 15000));

      const results = {
        weeklyRace: null,
        monthlyRace: null,
        affiliateRace: null,
      };

      if (this.weeklyRace) {
        try {
          const stats = await this.makeRequest(
            `/bonus/races/${this.weeklyRace.id}/me`,
            'GET',
            null,
            this.referredUserToken,
          );
          results.weeklyRace = {
            found: true,
            place: stats.place,
            wagered: stats.wagered,
            prize: stats.prize,
          };
        } catch (error) {
          results.weeklyRace = { found: false, error: error.message };
        }
      }

      if (this.monthlyRace) {
        try {
          const stats = await this.makeRequest(
            `/bonus/races/${this.monthlyRace.id}/me`,
            'GET',
            null,
            this.referredUserToken,
          );
          results.monthlyRace = {
            found: true,
            place: stats.place,
            wagered: stats.wagered,
            prize: stats.prize,
          };
        } catch (error) {
          results.monthlyRace = { found: false, error: error.message };
        }
      }

      if (this.affiliateRace) {
        try {
          const stats = await this.makeRequest(
            `/bonus/races/${this.affiliateRace.id}/me`,
            'GET',
            null,
            this.referredUserToken,
          );
          results.affiliateRace = {
            found: true,
            place: stats.place,
            wagered: stats.wagered,
            prize: stats.prize,
          };
        } catch (error) {
          results.affiliateRace = { found: false, error: error.message };
        }
      }

      const weeklyOk = results.weeklyRace?.found === true;
      const monthlyOk = results.monthlyRace?.found === true;
      const affiliateOk = results.affiliateRace?.found === true;
      const allOk = weeklyOk && monthlyOk && affiliateOk;

      if (weeklyOk) {
        this.log(
          `  ✅ Weekly Race: Place ${results.weeklyRace.place || 'N/A'}, Wagered: $${results.weeklyRace.wagered || '0'}`,
          'success',
        );
      } else {
        this.log(`  ❌ Weekly Race: Not participating`, 'error');
      }

      if (monthlyOk) {
        this.log(
          `  ✅ Monthly Race: Place ${results.monthlyRace.place || 'N/A'}, Wagered: $${results.monthlyRace.wagered || '0'}`,
          'success',
        );
      } else {
        this.log(`  ❌ Monthly Race: Not participating`, 'error');
      }

      if (affiliateOk) {
        this.log(
          `  ✅ Affiliate Race: Place ${results.affiliateRace.place || 'N/A'}, Wagered: $${results.affiliateRace.wagered || '0'}`,
          'success',
        );
      } else {
        this.log(`  ❌ Affiliate Race: Not participating`, 'error');
      }

      if (allOk) {
        this.log('🎉 SUCCESS: User is participating in ALL 3 races!', 'success');
      }

      return {
        success: allOk,
        details: allOk
          ? 'User in all 3 races'
          : `Weekly: ${weeklyOk ? 'YES' : 'NO'}, Monthly: ${monthlyOk ? 'YES' : 'NO'}, Affiliate: ${affiliateOk ? 'YES' : 'NO'}`,
        weeklyRace: results.weeklyRace,
        monthlyRace: results.monthlyRace,
        affiliateRace: results.affiliateRace,
      };
    } catch (error) {
      this.log(`Failed to check participation: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test11_checkLeaderboards() {
    this.log('Test 11: Check Leaderboards', 'race');

    try {
      const results = {};

      if (this.weeklyRace) {
        try {
          const leaderboard = await this.makeRequest(
            `/bonus/races/${this.weeklyRace.id}/leaderboard`,
            'GET',
            null,
            this.referredUserToken,
          );

          const userEntry = leaderboard.leaderboard?.find(
            (entry) => entry.user?.id === this.referredUser.id,
          );

          results.weeklyRace = {
            totalParticipants: leaderboard.leaderboard?.length || 0,
            userFound: !!userEntry,
            userPlace: userEntry?.place,
            userWagered: userEntry?.wagered,
          };

          this.log(
            `  Weekly Race Leaderboard: ${results.weeklyRace.totalParticipants} participants`,
            'info',
          );
          this.log(
            `    User: ${results.weeklyRace.userFound ? `Place ${results.weeklyRace.userPlace}` : 'Not found'}`,
            results.weeklyRace.userFound ? 'success' : 'warning',
          );
        } catch (error) {
          results.weeklyRace = { error: error.message };
          this.log(`  Weekly Race Leaderboard: Error - ${error.message}`, 'error');
        }
      }

      if (this.affiliateRace && this.affiliateCampaign) {
        try {
          // Test NEW endpoint: GET /bonus/races/:referralCode/leaderboard
          const leaderboard = await this.makeRequest(
            `/bonus/races/${this.affiliateCampaign.code}/leaderboard`,
            'GET',
            null,
            this.referredUserToken,
          );

          const userEntry = leaderboard.leaderboard?.find(
            (entry) => entry.user?.id === this.referredUser.id,
          );

          results.affiliateRace = {
            totalParticipants: leaderboard.leaderboard?.length || 0,
            userFound: !!userEntry,
            userPlace: userEntry?.place,
            userWagered: userEntry?.wagered,
            testedNewEndpoint: true,
          };

          this.log(
            `  Affiliate Race Leaderboard (by referralCode): ${results.affiliateRace.totalParticipants} participants`,
            'info',
          );
          this.log(
            `    User: ${results.affiliateRace.userFound ? `Place ${results.affiliateRace.userPlace}` : 'Not found'}`,
            results.affiliateRace.userFound ? 'success' : 'warning',
          );
          this.log('    ✅ NEW endpoint /:referralCode/leaderboard works!', 'success');
        } catch (error) {
          results.affiliateRace = { error: error.message, testedNewEndpoint: false };
          this.log(`  Affiliate Race Leaderboard: Error - ${error.message}`, 'error');
        }
      }

      return {
        success: true,
        details: 'Leaderboards checked',
        results,
      };
    } catch (error) {
      this.log(`Failed to check leaderboards: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test12_checkRacesForParticipants() {
    this.log('Test 12: Check Available Races for Participants (GET /bonus/races)', 'race');

    try {
      const response = await this.makeRequest('/bonus/races', 'GET', null, this.referredUserToken);

      const racesCount = response.races?.length || 0;
      const hasWeekly = response.races?.some(
        (r) => !r.sponsorId && !r.referralCode && r.name.includes('Weekly'),
      );
      const hasMonthly = response.races?.some(
        (r) => !r.sponsorId && !r.referralCode && r.name.includes('Monthly'),
      );
      const hasAffiliate = response.races?.some((r) => r.sponsorId);

      this.log(`  Total available races for participants: ${racesCount}`, 'info');
      this.log(
        `  Weekly race: ${hasWeekly ? '✅ Present' : '⚠️ Missing'}`,
        hasWeekly ? 'success' : 'warning',
      );
      this.log(
        `  Monthly race: ${hasMonthly ? '✅ Present' : 'ℹ️ None'}`,
        hasMonthly ? 'success' : 'info',
      );
      this.log(`  Affiliate races: ${hasAffiliate ? '✅ Present' : 'ℹ️ None'}`, 'info');

      const isValid = racesCount >= 1;

      return {
        success: isValid,
        details: `Found ${racesCount} races (weekly: ${hasWeekly}, monthly: ${hasMonthly}, affiliate: ${hasAffiliate})`,
        racesCount,
        hasWeekly,
        hasMonthly,
        hasAffiliate,
      };
    } catch (error) {
      this.log(`Failed to check participant races: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test13_checkRacesForCreator() {
    this.log('Test 13: Check Races for Creator with Leaderboards (GET /affiliate/races)', 'race');

    try {
      const response = await this.makeRequest('/affiliate/races', 'GET', null, this.mainUserToken);

      const racesCount = response.races?.length || 0;
      const hasCurrent = response.races?.some(
        (r) => r.status === 'PENDING' || r.status === 'ACTIVE',
      );
      const hasPrevious = response.races?.some((r) => r.status === 'ENDED');
      const allHaveLeaderboards = response.races?.every((r) => Array.isArray(r.leaderboard));

      this.log(`  Total creator's races: ${racesCount} (max 2)`, 'info');
      this.log(`  Current race (PENDING/ACTIVE): ${hasCurrent ? '✅ Present' : 'ℹ️ None'}`, 'info');
      this.log(`  Previous race (ENDED): ${hasPrevious ? '✅ Present' : 'ℹ️ None'}`, 'info');
      this.log(
        `  All races have leaderboards: ${allHaveLeaderboards ? '✅ Yes' : '❌ No'}`,
        allHaveLeaderboards ? 'success' : 'error',
      );

      const isValid = racesCount <= 2 && allHaveLeaderboards;

      if (racesCount > 2) {
        this.log(`  ❌ ERROR: Found ${racesCount} races (expected max 2)`, 'error');
      }
      if (!allHaveLeaderboards) {
        this.log(`  ❌ ERROR: Some races missing leaderboard data`, 'error');
      }
      if (isValid) {
        this.log(`  ✅ Correct: max 2 races with leaderboards returned`, 'success');
      }

      return {
        success: isValid,
        details: `Creator has ${racesCount} race(s) with leaderboards (max 2), current: ${hasCurrent}, previous: ${hasPrevious}`,
        racesCount,
        hasCurrent,
        hasPrevious,
        allHaveLeaderboards,
      };
    } catch (error) {
      this.log(`Failed to check creator races: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test14_checkSimplifiedLogic() {
    this.log('Test 14: Verify Simplified Logic', 'race');

    try {
      // Check that participants see available races without status filters
      const participantRaces = await this.makeRequest(
        '/bonus/races',
        'GET',
        null,
        this.referredUserToken,
      );

      // Check that creators see max 2 races
      const creatorRaces = await this.makeRequest(
        '/affiliate/races',
        'GET',
        null,
        this.mainUserToken,
      );

      const participantCount = participantRaces.races?.length || 0;
      const creatorCount = creatorRaces.races?.length || 0;

      this.log(`  Participants see ${participantCount} available races`, 'info');
      this.log(`  Creator sees ${creatorCount} races (max 2)`, 'info');

      const isValid = creatorCount <= 2;

      if (isValid) {
        this.log(`  ✅ Simplified logic working correctly`, 'success');
      } else {
        this.log(`  ❌ Creator has more than 2 races`, 'error');
      }

      return {
        success: isValid,
        details: `Participants: ${participantCount}, Creator: ${creatorCount}/2`,
        participantCount,
        creatorCount,
      };
    } catch (error) {
      this.log(`Failed to check simplified logic: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  async test15_tryCreateDuplicateRace() {
    this.log('Test 15: Try Creating Duplicate Race (Should Fail)', 'race');

    try {
      // Try to create a second race while first one is still PENDING/ACTIVE
      await this.makeRequest(
        '/affiliate/races',
        'POST',
        {
          referralCode: this.affiliateCampaign.code,
          raceDuration: '1d',
          asset: 'BTC',
          fiat: null,
          prizes: [10000, 5000],
        },
        this.mainUserToken,
      );

      // If we get here, the request succeeded (BAD!)
      this.log(`  ❌ ERROR: Created duplicate race! Should have been blocked`, 'error');
      return {
        success: false,
        details: 'Duplicate race creation was NOT blocked',
        error: 'Expected 400 error but got success',
      };
    } catch (error) {
      // We EXPECT this to fail with 400
      if (error.message.includes('400')) {
        this.log(`  ✅ Duplicate race blocked correctly: ${error.message}`, 'success');
        return {
          success: true,
          details: 'Duplicate race creation blocked as expected',
          errorMessage: error.message,
        };
      } else {
        this.log(`  ❌ Unexpected error: ${error.message}`, 'error');
        return {
          success: false,
          details: 'Got error, but not the expected 400',
          error: error.message,
        };
      }
    }
  }

  printSummary() {
    console.log('\n============================================================');
    console.log('🏁 AFFILIATE & RACE SYSTEM TEST SUMMARY');
    console.log('============================================================');

    const tests = [
      'Test 1: Register Main User',
      'Test 2: Create Affiliate Campaign',
      'Test 3: Check Main User Balance',
      'Test 4: Create Affiliate Race',
      'Test 5: Register Referred User',
      'Test 6: Check Referred User Balance',
      'Test 7: Check Affiliate Race Status',
      'Test 7b: Check Affiliate Race in Creator List',
      'Test 8: Get Active Races',
      'Test 9: Place Bets',
      'Test 9b: Check WebSocket Events (All 3 Races)',
      'Test 10: Check Race Participation (All 3 Races)',
      'Test 11: Check Leaderboards',
      'Test 12: Check Available Races for Participants',
      'Test 13: Check Races for Creator - Max 2',
      'Test 14: Verify Simplified Logic',
      'Test 15: Try Creating Duplicate Race (Should Fail)',
    ];

    let passedCount = 0;

    // Map test names to result keys
    const testKeys = [1, 2, 3, 4, 5, 6, 7, '7b', 8, 9, '9b', 10, 11, 12, 13, 14, 15];

    tests.forEach((testName, index) => {
      const key = testKeys[index];
      const result = this.results[key];
      if (result?.success) {
        console.log(`✅ ${testName} - PASSED`);
        console.log(`   ${result.details}`);
        passedCount++;
      } else {
        console.log(`❌ ${testName} - FAILED`);
        if (result?.error) {
          console.log(`   Error: ${result.error}`);
        }
      }
    });

    console.log('\n------------------------------------------------------------');
    console.log(`📊 RESULTS: ${passedCount}/${tests.length} tests passed`);

    console.log('\n📋 TEST DATA:');
    console.log(`   Main User: ${this.mainUser?.email} (${this.mainUser?.id})`);
    console.log(
      `   Affiliate Campaign: ${this.affiliateCampaign?.name} (${this.affiliateCampaign?.code})`,
    );
    console.log(`   Affiliate Race: ${this.affiliateRace?.name} (${this.affiliateRace?.status})`);
    console.log(`   Referred User: ${this.referredUser?.email} (${this.referredUser?.id})`);
    console.log(`   Weekly Race: ${this.weeklyRace?.name || 'N/A'}`);
    console.log(`   Monthly Race: ${this.monthlyRace?.name || 'N/A'}`);

    if (passedCount === tests.length) {
      console.log('\n🎉 ALL TESTS PASSED! Affiliate & Race system working perfectly!');
    } else {
      console.log('\n⚠️  Some tests failed. Please check the errors above.');
    }
    console.log('============================================================');
  }

  cleanupBeforeTests() {
    console.log('\n⚠️  Manual cleanup required:');
    console.log('   - Use admin panel or database to clean old test data if needed');
    console.log('   - Fund test user accounts with BTC');
    console.log('   - Ensure weekly/monthly races are active');
    console.log('');
    return true;
  }

  async runAllTests() {
    console.log('🚀 Starting Affiliate & Race System Simulator');
    console.log(`🔗 Base URL: ${API_BASE}`);
    console.log('🎯 Focus: Affiliate campaigns, races, and user participation');
    console.log('');
    console.log('📋 Testing features:');
    console.log('   - GET /bonus/races (for participants: weekly + monthly + 1 affiliate race)');
    console.log('   - GET /affiliate/races (for creators: max 2 races with leaderboards)');
    console.log('   - GET /bonus/races/:referralCode/leaderboard');
    console.log('   - POST /affiliate/races (duplicate race prevention)');
    console.log('   - WebSocket race:leaderboard:update events (all 3 races)');

    // Show manual steps required
    this.cleanupBeforeTests();

    this.results = {};

    try {
      this.results[1] = await this.test1_registerMainUser();
      if (!this.results[1].success) throw new Error('Main user registration failed');

      this.results[2] = await this.test2_createAffiliateCampaign();
      if (!this.results[2].success) throw new Error('Campaign creation failed');

      this.results[3] = await this.test3_fundMainUser();
      if (!this.results[3].success) throw new Error('Main user funding failed');

      this.results[4] = await this.test4_createAffiliateRace();
      if (!this.results[4].success) throw new Error('Race creation failed');

      this.results[5] = await this.test5_registerReferredUser();
      if (!this.results[5].success) throw new Error('Referred user registration failed');

      this.results[6] = await this.test6_fundReferredUser();
      if (!this.results[6].success) throw new Error('Referred user funding failed');

      this.results[7] = this.test7_checkAffiliateRaceStatus();
      this.results['7b'] = await this.test7b_checkAffiliateRaceInCreatorList();
      this.results[8] = await this.test8_getActiveRaces();
      this.results[9] = await this.test9_placeBets();
      this.results['9b'] = await this.test9b_checkWebSocketEvents();
      this.results[10] = await this.test10_checkRaceParticipation();
      this.results[11] = await this.test11_checkLeaderboards();
      this.results[12] = await this.test12_checkRacesForParticipants();
      this.results[13] = await this.test13_checkRacesForCreator();
      this.results[14] = await this.test14_checkSimplifiedLogic();
      this.results[15] = await this.test15_tryCreateDuplicateRace();
    } catch (error) {
      console.log(`\n💥 Critical error: ${error.message}`);
    }

    this.printSummary();
  }
}

const simulator = new AffiliateRaceSimulator();
simulator.runAllTests().catch(console.error);
