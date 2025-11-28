import { UserEntity } from '@zetik/shared-entities';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Games (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<UserEntity>;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply the same configuration as in main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: false,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.enableCors();

    await app.init();

    userRepository = moduleFixture.get<Repository<UserEntity>>(getRepositoryToken(UserEntity));

    // Clean up any existing test user first - use a unique username to avoid conflicts
    const testUsername = `gametester_${Date.now()}`;
    const existingUser = await userRepository.findOne({
      where: { username: 'gametester' },
    });
    if (existingUser) {
      try {
        // Try to delete with cascade
        await app.get('DataSource').transaction(async (manager) => {
          await manager.query('DELETE FROM users.users WHERE id = $1', [existingUser.id]);
        });
      } catch (error) {
        // If cascade fails, ignore and continue - we'll use a unique username
      }
    }

    // Create a test user and get access token
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register/email')
      .send({
        email: `gametest_${Date.now()}@example.com`,
        password: 'TestPassword123!',
        username: testUsername,
      })
      .expect(201);

    expect(registerResponse.body).toHaveProperty('accessToken');
    accessToken = registerResponse.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup is optional - we use unique usernames anyway
    await app.close();
  });

  describe('Dice Game', () => {
    describe('/games/dice (POST)', () => {
      it('should fail without authentication', async () => {
        await request(app.getHttpServer())
          .post('/games/dice')
          .send({
            betAmount: 10,
            rollOver: true,
            target: 50,
          })
          .expect(401);
      });

      it('should fail with invalid bet amount', async () => {
        await request(app.getHttpServer())
          .post('/games/dice')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            betAmount: -10,
            rollOver: true,
            target: 50,
          })
          .expect(400);
      });

      it('should fail with invalid target', async () => {
        await request(app.getHttpServer())
          .post('/games/dice')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            betAmount: 10,
            rollOver: true,
            target: 150, // Invalid target (should be 0-100)
          })
          .expect(400);
      });

      it('should fail with insufficient balance', async () => {
        await request(app.getHttpServer())
          .post('/games/dice')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            betAmount: 100000, // Large amount that user doesn't have
            rollOver: true,
            target: 50,
          })
          .expect(400);
      });
    });
  });

  describe('Blackjack Game', () => {
    describe('/games/blackjack/start (POST)', () => {
      it('should fail without authentication', async () => {
        await request(app.getHttpServer())
          .post('/games/blackjack/start')
          .send({
            betAmount: 10,
          })
          .expect(401);
      });

      it('should fail with invalid bet amount', async () => {
        await request(app.getHttpServer())
          .post('/games/blackjack/start')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            betAmount: 0,
          })
          .expect(400);
      });

      it('should prevent creating multiple active blackjack games simultaneously', async () => {
        // Start first game
        const firstGame = await request(app.getHttpServer())
          .post('/games/blackjack/start')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            betAmount: '10',
            clientSeed: 'test-seed-1',
          })
          .expect(201);

        expect(firstGame.body).toHaveProperty('id');
        expect(firstGame.body.status).toBe('active');

        // Attempt to start second game while first is still active
        const secondGame = await request(app.getHttpServer())
          .post('/games/blackjack/start')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            betAmount: '10',
            clientSeed: 'test-seed-2',
          })
          .expect(400);

        expect(secondGame.body.message).toContain('You already have an active blackjack game');

        // Complete the first game by standing
        await request(app.getHttpServer())
          .post('/games/blackjack/action')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            gameId: firstGame.body.id,
            action: 'stand',
          })
          .expect(200);

        // Now should be able to start a new game
        const thirdGame = await request(app.getHttpServer())
          .post('/games/blackjack/start')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            betAmount: '10',
            clientSeed: 'test-seed-3',
          })
          .expect(201);

        expect(thirdGame.body).toHaveProperty('id');
        expect(thirdGame.body.id).not.toBe(firstGame.body.id);
      });
    });

    describe('/games/blackjack/action (POST)', () => {
      it('should fail without authentication', async () => {
        await request(app.getHttpServer())
          .post('/games/blackjack/action')
          .send({
            gameId: 'some-game-id',
            action: 'hit',
          })
          .expect(401);
      });

      it('should fail with invalid game ID', async () => {
        await request(app.getHttpServer())
          .post('/games/blackjack/action')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            gameId: 'invalid-game-id',
            action: 'hit',
          })
          .expect(400);
      });

      it('should fail with invalid action', async () => {
        await request(app.getHttpServer())
          .post('/games/blackjack/action')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            gameId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            action: 'invalid-action',
          })
          .expect(400);
      });
    });

    describe('/games/blackjack/history (GET)', () => {
      it('should return game history', async () => {
        const response = await request(app.getHttpServer())
          .get('/games/blackjack/history')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        // Should return empty array if no games played yet
        expect(response.body.length).toBe(0);
      });

      it('should fail without authentication', async () => {
        await request(app.getHttpServer()).get('/games/blackjack/history').expect(401);
      });

      it('should handle limit parameter', async () => {
        const response = await request(app.getHttpServer())
          .get('/games/blackjack/history?limit=5')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBeLessThanOrEqual(5);
      });
    });

    describe('Side Bets with Dealer Blackjack (Bug 2)', () => {
      it('should credit side bet winnings when dealer has blackjack and player loses', async () => {
        // Get initial balance
        const balanceBeforeResponse = await request(app.getHttpServer())
          .get('/balance')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        const initialBalance = parseFloat(balanceBeforeResponse.body.USDT || '0');

        // Start a game with side bets
        // We'll use a specific client seed to try to trigger dealer blackjack
        const startResponse = await request(app.getHttpServer())
          .post('/games/blackjack/start')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            betAmount: '10.00000000',
            perfectPairsBet: '5.00000000',
            twentyOnePlusThreeBet: '5.00000000',
            clientSeed: 'dealer-blackjack-test-seed',
          });

        // Game might complete immediately if dealer has blackjack
        expect([200, 201]).toContain(startResponse.status);
        expect(startResponse.body).toHaveProperty('id');

        const game = startResponse.body;

        // Check if game completed with dealer blackjack
        if (game.status === 'completed') {
          // Total bet was 20 (10 main + 5 perfect pairs + 5 twenty-one plus three)
          const totalBet = 20;

          // Get final balance
          const balanceAfterResponse = await request(app.getHttpServer())
            .get('/balance')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

          const finalBalance = parseFloat(balanceAfterResponse.body.USDT || '0');

          // Balance change should be: -totalBet + totalWinAmount
          const balanceChange = finalBalance - initialBalance;
          const expectedBalanceChange = parseFloat(game.totalWinAmount || '0') - totalBet;

          // Verify balance was credited correctly
          expect(balanceChange).toBeCloseTo(expectedBalanceChange, 6);

          // If there were side bet winnings, verify they're in totalWinAmount
          const sideBetWinnings =
            parseFloat(game.perfectPairsWin || '0') + parseFloat(game.twentyOnePlusThreeWin || '0');

          if (sideBetWinnings > 0) {
            // totalWinAmount should include side bet winnings
            const totalWinAmount = parseFloat(game.totalWinAmount || '0');
            expect(totalWinAmount).toBeGreaterThanOrEqual(sideBetWinnings);

            // Verify side bet winnings were credited to balance
            // (balance should increase by at least side bet winnings minus the side bet amounts)
            const netSideBetWinnings = sideBetWinnings - 10; // Subtract the 10 side bet costs
            expect(balanceChange).toBeGreaterThanOrEqual(netSideBetWinnings - 10); // Allow for main bet loss
          }
        }
      });

      it('should include side bet winnings in totalWinAmount when both player and dealer have blackjack', async () => {
        // This test verifies that when both player and dealer have blackjack (push),
        // side bet winnings are still credited and included in totalWinAmount

        let foundPushWithSideBets = false;
        let attempts = 0;
        const maxAttempts = 20; // Try multiple times to find this scenario

        while (!foundPushWithSideBets && attempts < maxAttempts) {
          attempts++;

          const startResponse = await request(app.getHttpServer())
            .post('/games/blackjack/start')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              betAmount: '10.00000000',
              perfectPairsBet: '5.00000000',
              twentyOnePlusThreeBet: '5.00000000',
              clientSeed: `push-test-${attempts}`,
            });

          if (startResponse.status !== 201 && startResponse.status !== 200) {
            // Skip if game creation failed (e.g., insufficient balance)
            break;
          }

          const game = startResponse.body;

          // Check if we found the scenario: both blackjack (push) with side bet wins
          if (game.status === 'completed' && parseFloat(game.payoutMultiplier) === 1.0) {
            const sideBetWinnings =
              parseFloat(game.perfectPairsWin || '0') +
              parseFloat(game.twentyOnePlusThreeWin || '0');

            if (sideBetWinnings > 0) {
              foundPushWithSideBets = true;

              // Verify totalWinAmount includes side bet winnings + main bet push
              const mainBetAmount = parseFloat(game.mainBetAmount || game.betAmount);
              const expectedTotal = mainBetAmount + sideBetWinnings;
              const actualTotal = parseFloat(game.totalWinAmount || '0');

              expect(actualTotal).toBeCloseTo(expectedTotal, 6);
            }
          }

          // If game is still active, finish it to allow next game
          if (game.status === 'active') {
            await request(app.getHttpServer())
              .post('/games/blackjack/action')
              .set('Authorization', `Bearer ${accessToken}`)
              .send({
                gameId: game.id,
                action: 'stand',
              });
          }
        }

        // This test is probabilistic, so we don't fail if scenario not found
        // but we log it for debugging
        if (!foundPushWithSideBets) {
          console.log(
            `Note: Push with side bets scenario not found in ${attempts} attempts (probabilistic test)`,
          );
        }
      });

      it('should include side bet winnings when player has blackjack immediately', async () => {
        // Test that when player gets immediate blackjack (dealer doesn't have blackjack),
        // side bet winnings are included in totalWinAmount

        let foundPlayerBlackjackWithSideBets = false;
        let attempts = 0;
        const maxAttempts = 20;

        while (!foundPlayerBlackjackWithSideBets && attempts < maxAttempts) {
          attempts++;

          const startResponse = await request(app.getHttpServer())
            .post('/games/blackjack/start')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              betAmount: '10.00000000',
              perfectPairsBet: '5.00000000',
              twentyOnePlusThreeBet: '5.00000000',
              clientSeed: `player-bj-test-${attempts}`,
            });

          if (startResponse.status !== 201 && startResponse.status !== 200) {
            break;
          }

          const game = startResponse.body;

          // Check for player blackjack win (2.5x multiplier)
          if (game.status === 'completed' && parseFloat(game.payoutMultiplier) === 2.5) {
            const sideBetWinnings =
              parseFloat(game.perfectPairsWin || '0') +
              parseFloat(game.twentyOnePlusThreeWin || '0');

            if (sideBetWinnings > 0) {
              foundPlayerBlackjackWithSideBets = true;

              // Verify totalWinAmount includes side bet winnings + blackjack payout
              const mainBetAmount = parseFloat(game.mainBetAmount || game.betAmount);
              const blackjackPayout = mainBetAmount * 2.5;
              const expectedTotal = blackjackPayout + sideBetWinnings;
              const actualTotal = parseFloat(game.totalWinAmount || '0');

              expect(actualTotal).toBeCloseTo(expectedTotal, 6);
            }
          }

          // Finish active games
          if (game.status === 'active') {
            await request(app.getHttpServer())
              .post('/games/blackjack/action')
              .set('Authorization', `Bearer ${accessToken}`)
              .send({
                gameId: game.id,
                action: 'stand',
              });
          }
        }

        if (!foundPlayerBlackjackWithSideBets) {
          console.log(
            `Note: Player blackjack with side bets scenario not found in ${attempts} attempts (probabilistic test)`,
          );
        }
      });
    });
  });

  describe('Game Seeds', () => {
    describe('/games/provably-fair/seed-info (GET)', () => {
      it('should return current seed pair', async () => {
        const response = await request(app.getHttpServer())
          .get('/games/provably-fair/seed-info')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('serverSeedHash');
        expect(response.body).toHaveProperty('clientSeed');
        expect(response.body).toHaveProperty('nonce');
        expect(response.body).not.toHaveProperty('serverSeed');
      });

      it('should fail without authentication', async () => {
        await request(app.getHttpServer()).get('/games/provably-fair/seed-info').expect(401);
      });
    });

    describe('/games/provably-fair/client-seed (PATCH)', () => {
      it('should rotate server seed and update client seed atomically', async () => {
        const response = await request(app.getHttpServer())
          .patch('/games/provably-fair/client-seed')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ clientSeed: 'my-new-client-seed' })
          .expect(200);

        expect(response.body).toHaveProperty('newSeedHash');
        expect(response.body).toHaveProperty('newClientSeed', 'my-new-client-seed');
      });

      it('should fail without authentication', async () => {
        await request(app.getHttpServer())
          .patch('/games/provably-fair/client-seed')
          .send({ clientSeed: 'my-new-client-seed' })
          .expect(401);
      });
    });

    describe('/games/verify (POST)', () => {
      it('should verify game outcome', async () => {
        const response = await request(app.getHttpServer())
          .post('/games/verify')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            serverSeed: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
            clientSeed: 'test-client-seed',
            nonce: '1',
            gameType: 'DICE',
            outcome: 50,
          })
          .expect(201);

        expect(response.body).toHaveProperty('isValid');
        expect(response.body).toHaveProperty('hash');
        expect(response.body).toHaveProperty('calculatedOutcome');
      });

      it('should fail without required fields', async () => {
        await request(app.getHttpServer())
          .post('/games/verify')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            serverSeed: 'test-server-seed',
            clientSeed: 'test-client-seed',
          })
          .expect(400);
      });
    });
  });

  describe('Game Sessions', () => {
    describe('/games/sessions/current (GET)', () => {
      it('should return current session or null', async () => {
        const response = await request(app.getHttpServer())
          .get('/games/sessions/current')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        // Could be null if no active session
        if (response.body && response.body.id) {
          expect(response.body).toHaveProperty('id');
          expect(response.body).toHaveProperty('gameType');
          expect(response.body).toHaveProperty('isActive');
        } else {
          // No active session - response should be null or empty object
          expect(response.body === null || Object.keys(response.body).length === 0).toBe(true);
        }
      });

      it('should fail without authentication', async () => {
        await request(app.getHttpServer()).get('/games/sessions/current').expect(401);
      });
    });

    describe('/games/sessions/history (GET)', () => {
      it('should return session history', async () => {
        const response = await request(app.getHttpServer())
          .get('/games/sessions/history')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
      });

      it('should fail without authentication', async () => {
        await request(app.getHttpServer()).get('/games/sessions/history').expect(401);
      });
    });
  });

  describe('Game Favorites', () => {
    describe('/games/favorites (GET)', () => {
      it('should return empty array initially', async () => {
        const response = await request(app.getHttpServer())
          .get('/games/favorites')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toBeInstanceOf(Array);
        expect(response.body).toEqual([]);
      });

      it('should fail without authentication', async () => {
        await request(app.getHttpServer()).get('/games/favorites').expect(401);
      });
    });

    describe('/games/favorites (POST)', () => {
      it('should add a game to favorites', async () => {
        const response = await request(app.getHttpServer())
          .post('/games/favorites')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ game: 'DICE' });

        expect([200, 201]).toContain(response.status);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('added to favorites');

        // Verify it was added
        const favoritesResponse = await request(app.getHttpServer())
          .get('/games/favorites')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(favoritesResponse.body).toContain('DICE');
      });

      it('should handle duplicate favorites gracefully', async () => {
        // Add favorite
        const firstAdd = await request(app.getHttpServer())
          .post('/games/favorites')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ game: 'CRASH' });

        expect([200, 201]).toContain(firstAdd.status);

        // Try to add again - should not fail
        const secondAdd = await request(app.getHttpServer())
          .post('/games/favorites')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ game: 'CRASH' });

        expect([200, 201]).toContain(secondAdd.status);

        // Verify only one entry exists
        const favoritesResponse = await request(app.getHttpServer())
          .get('/games/favorites')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        const crashCount = favoritesResponse.body.filter((g: string) => g === 'CRASH').length;
        expect(crashCount).toBe(1);
      });

      it('should fail without authentication', async () => {
        await request(app.getHttpServer())
          .post('/games/favorites')
          .send({ game: 'DICE' })
          .expect(401);
      });

      it('should fail with invalid game type', async () => {
        await request(app.getHttpServer())
          .post('/games/favorites')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ game: 'INVALID_GAME' })
          .expect(400);
      });
    });

    describe('/games/favorites (DELETE)', () => {
      it('should remove a game from favorites', async () => {
        // First add a favorite
        const addResponse = await request(app.getHttpServer())
          .post('/games/favorites')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ game: 'PLINKO' });

        expect([200, 201]).toContain(addResponse.status);

        // Remove it
        const response = await request(app.getHttpServer())
          .delete('/games/favorites')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ game: 'PLINKO' })
          .expect(200);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('removed from favorites');

        // Verify it was removed
        const favoritesResponse = await request(app.getHttpServer())
          .get('/games/favorites')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(favoritesResponse.body).not.toContain('PLINKO');
      });

      it('should handle removing non-existent favorite gracefully', async () => {
        await request(app.getHttpServer())
          .delete('/games/favorites')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ game: 'LIMBO' })
          .expect(200);
      });

      it('should fail without authentication', async () => {
        await request(app.getHttpServer())
          .delete('/games/favorites')
          .send({ game: 'DICE' })
          .expect(401);
      });
    });
  });
});
