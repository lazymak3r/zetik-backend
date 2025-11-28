import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions, QueryRunner } from 'typeorm';

/**
 * Test database utilities for integration testing.
 * Provides real database operations for testing business logic.
 */

// Test database configuration
export const getTestDatabaseConfig = (): DataSourceOptions => ({
  type: 'postgres',
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5432'),
  username: process.env.TEST_DB_USERNAME || 'postgres',
  password: process.env.TEST_DB_PASSWORD || 'postgres',
  database: process.env.TEST_DB_DATABASE || 'zetik_test',
  entities: ['src/**/*.entity.ts'],
  synchronize: true, // Only for test database
  dropSchema: true, // Clean slate for each test run
  logging: process.env.TEST_DB_LOGGING === 'true',
});

// Database test utilities class
export class DatabaseTestUtils {
  private dataSource: DataSource;
  private queryRunner!: QueryRunner;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  async setupTransaction(): Promise<QueryRunner> {
    this.queryRunner = this.dataSource.createQueryRunner();
    await this.queryRunner.connect();
    await this.queryRunner.startTransaction();
    return this.queryRunner;
  }

  async rollbackTransaction(): Promise<void> {
    if (this.queryRunner) {
      await this.queryRunner.rollbackTransaction();
      await this.queryRunner.release();
    }
  }

  async commitTransaction(): Promise<void> {
    if (this.queryRunner) {
      await this.queryRunner.commitTransaction();
      await this.queryRunner.release();
    }
  }

  async cleanDatabase(): Promise<void> {
    const entities = this.dataSource.entityMetadatas;

    // Disable foreign key checks
    await this.dataSource.query('SET session_replication_role = replica;');

    // Truncate all tables
    for (const entity of entities) {
      await this.dataSource.query(`TRUNCATE "${entity.tableName}" RESTART IDENTITY CASCADE;`);
    }

    // Re-enable foreign key checks
    await this.dataSource.query('SET session_replication_role = DEFAULT;');
  }

  async seedBasicData(): Promise<void> {
    // Seed essential configuration data needed for tests
    await this.dataSource.query(`
      INSERT INTO game_config (game_type, house_edge, max_multiplier, is_active, configuration)
      VALUES 
        ('blackjack', '1.5', '2.1', true, '{"minBet": "0.01", "maxBet": "1000"}'),
        ('dice', '1.0', '99.0', true, '{"minBet": "0.01", "maxBet": "1000"}'),
        ('crash', '1.0', '10000.0', true, '{"minBet": "0.01", "maxBet": "100"}')
      ON CONFLICT (game_type) DO NOTHING;
    `);

    await this.dataSource.query(`
      INSERT INTO bonus_vip_tier (name, required_wager, bonus_percentage, cashback_percentage, max_bonus, is_active)
      VALUES 
        ('Bronze', '0', '0.1', '0.5', '10', true),
        ('Silver', '1000', '0.15', '0.75', '25', true),
        ('Gold', '5000', '0.2', '1.0', '50', true)
      ON CONFLICT (name) DO NOTHING;
    `);
  }
}

// Integration test base class
export abstract class IntegrationTestBase {
  protected app!: INestApplication;
  protected dataSource!: DataSource;
  protected dbUtils!: DatabaseTestUtils;

  protected async setupIntegrationTest(moduleMetadata: any): Promise<void> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(getTestDatabaseConfig()), ...moduleMetadata.imports],
      controllers: moduleMetadata.controllers || [],
      providers: moduleMetadata.providers || [],
    }).compile();

    this.app = moduleFixture.createNestApplication();
    await this.app.init();

    this.dataSource = moduleFixture.get<DataSource>(DataSource);
    this.dbUtils = new DatabaseTestUtils(this.dataSource);

    // Clean and seed the database
    await this.dbUtils.cleanDatabase();
    await this.dbUtils.seedBasicData();
  }

  protected async teardownIntegrationTest(): Promise<void> {
    if (this.dbUtils) {
      await this.dbUtils.cleanDatabase();
    }

    if (this.dataSource) {
      await this.dataSource.destroy();
    }

    if (this.app) {
      await this.app.close();
    }
  }
}

// Helper function to create test module with database
export const createTestModuleWithDatabase = async (metadata: any): Promise<TestingModule> => {
  return Test.createTestingModule({
    imports: [TypeOrmModule.forRoot(getTestDatabaseConfig()), ...metadata.imports],
    controllers: metadata.controllers || [],
    providers: metadata.providers || [],
  }).compile();
};

// Transaction test wrapper
export const withDatabaseTransaction = (testFn: (queryRunner: QueryRunner) => Promise<void>) => {
  return async () => {
    let dataSource: DataSource | undefined;
    let queryRunner: QueryRunner | undefined;

    try {
      dataSource = new DataSource(getTestDatabaseConfig());
      await dataSource.initialize();

      queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      await testFn(queryRunner);

      await queryRunner.rollbackTransaction(); // Always rollback in tests
    } finally {
      if (queryRunner) {
        await queryRunner.release();
      }
      if (dataSource) {
        await dataSource.destroy();
      }
    }
  };
};

// Database connection health check
export const checkDatabaseConnection = async (): Promise<boolean> => {
  let dataSource: DataSource | undefined;

  try {
    dataSource = new DataSource(getTestDatabaseConfig());
    await dataSource.initialize();

    // Simple query to test connection
    await dataSource.query('SELECT 1 as test');

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Database connection failed:', errorMessage);
    return false;
  } finally {
    if (dataSource) {
      await dataSource.destroy();
    }
  }
};

// Performance testing utilities
export class PerformanceTestUtils {
  static async measureExecutionTime<T>(
    operation: () => Promise<T>,
    iterations: number = 1,
  ): Promise<{ result: T; averageTime: number; totalTime: number }> {
    const startTime = process.hrtime.bigint();
    let result: T;

    for (let i = 0; i < iterations; i++) {
      result = await operation();
    }

    const endTime = process.hrtime.bigint();
    const totalTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    const averageTime = totalTime / iterations;

    return {
      result: result!,
      averageTime,
      totalTime,
    };
  }

  static async benchmarkDatabaseOperation<T>(
    operation: () => Promise<T>,
    expectedMaxTime: number = 1000, // milliseconds
  ): Promise<void> {
    const { averageTime } = await this.measureExecutionTime(operation, 10);

    if (averageTime > expectedMaxTime) {
      throw new Error(`Operation too slow: ${averageTime}ms > ${expectedMaxTime}ms`);
    }
  }
}

// Memory leak detection
export class MemoryTestUtils {
  private static initialMemory: NodeJS.MemoryUsage;

  static startMemoryMonitoring(): void {
    this.initialMemory = process.memoryUsage();
  }

  static checkMemoryLeak(thresholdMB: number = 50): void {
    const currentMemory = process.memoryUsage();
    const heapGrowth = (currentMemory.heapUsed - this.initialMemory.heapUsed) / 1024 / 1024;

    if (heapGrowth > thresholdMB) {
      console.warn(`Potential memory leak detected: ${heapGrowth.toFixed(2)}MB growth`);
    }
  }
}
