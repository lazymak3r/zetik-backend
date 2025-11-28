import { ProviderDeveloperEntity } from '@zetik/shared-entities';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { BalanceModule } from '../src/balance/balance.module';
import { commonConfig } from '../src/config/common.config';
import { databaseConfig } from '../src/config/database.config';
import { providerGamesConfig } from '../src/config/provider-games.config';
import { AppDataSource } from '../src/data-source';
import { ProviderGamesModule } from '../src/provider-games/provider-games.module';
import { UsersModule } from '../src/users/users.module';
import { defaultTestData, seedTestDatabase } from './utils/test-utils';

describe('ProviderGamesController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let testLogger: Logger;

  beforeAll(async () => {
    testLogger = new Logger('ProviderGamesTest');

    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            load: [commonConfig, databaseConfig, providerGamesConfig],
          }),
          TypeOrmModule.forRoot({ ...AppDataSource.options }),
          EventEmitterModule.forRoot(),
          ProviderGamesModule,
          BalanceModule,
          UsersModule,
        ],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();

      dataSource = moduleFixture.get<DataSource>(DataSource);

      // Clean up all data from provider tables before seeding
      await dataSource.query('DELETE FROM games.provider_game_sessions');
      await dataSource.query('DELETE FROM games.provider_games');
      await dataSource.query('DELETE FROM games.provider_developers');
      await dataSource.query('DELETE FROM games.provider_categories');

      // Seed test data
      await seedTestDatabase(
        dataSource,
        defaultTestData.categories,
        defaultTestData.developers,
        defaultTestData.games,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      testLogger.error(`Error setting up test environment: ${errorMessage}`);
      throw error;
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('GET /provider-games/games', () => {
    it('should return all games with proper relations', async () => {
      const response = await request(app.getHttpServer()).get('/provider-games/games').expect(200);

      expect(response.body).toHaveProperty('games');
      expect(Array.isArray(response.body.games)).toBe(true);
      expect(response.body.games.length).toBe(defaultTestData.games.length);

      // Verify first game properties
      const game = response.body.games.find((g) => g.code === defaultTestData.games[0].code);
      expect(game).toBeDefined();
      expect(game.name).toBe(defaultTestData.games[0].name);
      expect(game.enabled).toBe(defaultTestData.games[0].enabled);
    });

    it('should filter games by developer name when developer query param is provided', async () => {
      const developer = defaultTestData.developers[0].name;

      const { body } = await request(app.getHttpServer())
        .get(`/provider-games/games?developer=${encodeURIComponent(developer)}`)
        .expect(200);

      expect(body).toHaveProperty('games');
      expect(Array.isArray(body.games)).toBe(true);

      body.games.forEach((game) => {
        // Verify developer relation
        expect(game.developer).toBeDefined();
        expect(game.developer.name).toBe(defaultTestData.games[0].developerName);
        expect(game.developer.code).toBeDefined();

        // Verify category relation
        expect(game.category).toBeDefined();
        expect(game.category.name).toBe(defaultTestData.games[0].categoryName);
        expect(game.category.type).toBeDefined();
      });

      const expectedGamesCount = defaultTestData.games.filter(
        (game) => game.developerName === developer,
      ).length;

      expect(body.games.length).toBe(expectedGamesCount);
    });

    it('should return empty array when filtering by non-existent developer', async () => {
      const nonExistentDeveloper = 'NonExistentDeveloperName';

      const response = await request(app.getHttpServer())
        .get(`/provider-games/games?developer=${encodeURIComponent(nonExistentDeveloper)}`)
        .expect(200);

      expect(response.body).toHaveProperty('games');
      expect(Array.isArray(response.body.games)).toBe(true);
      expect(response.body.games.length).toBe(0);
    });
  });

  describe('GET /provider-games/developers', () => {
    it('should return all developers with correct properties and game counts', async () => {
      const response = await request(app.getHttpServer())
        .get('/provider-games/developers')
        .expect(200);

      expect(response.body).toHaveProperty('developers');
      expect(Array.isArray(response.body.developers)).toBe(true);
      expect(response.body.developers.length).toBe(defaultTestData.developers.length);

      // Verify a specific developer exists with correct properties
      const developer = response.body.developers.find(
        (d) => d.name === defaultTestData.developers[0].name,
      );
      expect(developer).toBeDefined();
      expect(developer.code).toBe(defaultTestData.developers[0].code);
      expect(Array.isArray(developer.restrictedTerritories)).toBe(true);
      expect(Array.isArray(developer.prohibitedTerritories)).toBe(true);

      // Verify prohibited territories match
      if (defaultTestData.developers[0].prohibitedTerritories?.length) {
        expect(developer.prohibitedTerritories).toEqual(
          expect.arrayContaining(defaultTestData.developers[0].prohibitedTerritories),
        );
      }

      // Verify gamesCount property exists and has the correct value for each developer
      response.body.developers.forEach((dev) => {
        expect(dev).toHaveProperty('gamesCount');
        expect(typeof dev.gamesCount).toBe('number');

        // Count games for this developer in test data
        const expectedCount = defaultTestData.games.filter(
          (game) => game.developerName === dev.name,
        ).length;

        expect(dev.gamesCount).toBe(expectedCount);
      });
    });

    it('should not return disabled developers', async () => {
      const developerRepo = dataSource.getRepository(ProviderDeveloperEntity);
      const disabledDeveloper = await developerRepo.save({
        name: 'Disabled Developer',
        code: 'disabled',
        enabled: false,
      });

      const response = await request(app.getHttpServer())
        .get('/provider-games/developers')
        .expect(200);

      expect(response.body).toHaveProperty('developers');
      expect(Array.isArray(response.body.developers)).toBe(true);

      const disabledDev = response.body.developers.find((d) => d.name === disabledDeveloper.name);
      expect(disabledDev).toBeUndefined();

      await developerRepo.delete({ name: disabledDeveloper.name });
    });
  });

  describe('GET /provider-games/categories', () => {
    it('should return all categories with correct data', async () => {
      const response = await request(app.getHttpServer())
        .get('/provider-games/categories')
        .expect(200);

      expect(response.body).toHaveProperty('categories');
      expect(Array.isArray(response.body.categories)).toBe(true);
      expect(response.body.categories.length).toBe(defaultTestData.categories.length);

      // Verify a specific category exists with correct properties
      const category = response.body.categories.find(
        (c) => c.name === defaultTestData.categories[0].name,
      );
      expect(category).toBeDefined();
      expect(category.type).toBe(defaultTestData.categories[0].type);
    });
  });

  describe('GET /provider-games/games/:code', () => {
    it('should return game by code with proper relations', async () => {
      const testGameCode = defaultTestData.games[0].code;

      const response = await request(app.getHttpServer())
        .get(`/provider-games/games/${testGameCode}`)
        .expect(200);

      expect(response.body).toHaveProperty('game');
      expect(response.body.game).toBeDefined();
      expect(response.body.game.code).toBe(testGameCode);
      expect(response.body.game.name).toBe(defaultTestData.games[0].name);
      expect(response.body.game.enabled).toBe(defaultTestData.games[0].enabled);

      // Verify developer relation
      expect(response.body.game.developer).toBeDefined();
      expect(response.body.game.developer.name).toBe(defaultTestData.games[0].developerName);
      expect(response.body.game.developer.code).toBeDefined();

      // Verify category relation
      expect(response.body.game.category).toBeDefined();
      expect(response.body.game.category.name).toBe(defaultTestData.games[0].categoryName);
      expect(response.body.game.category.type).toBeDefined();

      // Verify other game properties
      expect(response.body.game.bonusTypes).toEqual(defaultTestData.games[0].bonusTypes);
      expect(response.body.game.themes).toEqual(defaultTestData.games[0].themes);
      expect(response.body.game.features).toEqual(defaultTestData.games[0].features);
      expect(response.body.game.rtp).toBe(defaultTestData.games[0].rtp);
      expect(response.body.game.volatility).toBe(defaultTestData.games[0].volatility);
      expect(response.body.game.funMode).toBe(defaultTestData.games[0].funMode);
    });

    it('should return null game when game with non-existent code is requested', async () => {
      const nonExistentGameCode = 'non_existent_game_code';

      const response = await request(app.getHttpServer())
        .get(`/provider-games/games/${nonExistentGameCode}`)
        .expect(200);

      expect(response.body).toHaveProperty('game');
      expect(response.body.game).toBeNull();
    });

    it('should return proper response structure for getGameByCode endpoint', async () => {
      const testGameCode = defaultTestData.games[1].code; // Use second game for variety

      const response = await request(app.getHttpServer())
        .get(`/provider-games/games/${testGameCode}`)
        .expect(200);

      // Verify response structure matches GetGameResponseDto
      expect(response.body).toHaveProperty('game');
      expect(typeof response.body === 'object').toBe(true);
      expect(Object.keys(response.body)).toEqual(['game']);

      // Verify game object structure when game exists
      if (response.body.game !== null) {
        expect(response.body.game).toHaveProperty('code');
        expect(response.body.game).toHaveProperty('name');
        expect(response.body.game).toHaveProperty('enabled');
        expect(response.body.game).toHaveProperty('developer');
        expect(response.body.game).toHaveProperty('category');
        expect(response.body.game).toHaveProperty('createdAt');
        expect(response.body.game).toHaveProperty('updatedAt');
      }
    });
  });
});
