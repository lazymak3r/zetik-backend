import { config } from 'dotenv';
import { resolve } from 'path';
config({ quiet: true, path: resolve(__dirname, '../.env.test') });

import { DataSource } from 'typeorm';
import { getMigrationDataSourceConfig } from '../src/data-source-migration';

export default async function globalSetup(): Promise<void> {
  console.log('🚀 Starting global e2e test setup...');
  try {
    const dbConfig = getConfig();
    const dataSource = new DataSource({
      ...dbConfig,
      migrations: ['src/migrations/*.ts'],
      migrationsRun: false, // We'll run them manually
    });

    console.log('🔌 Connecting to test database...');
    await dataSource.initialize();
    await dataSource.dropDatabase();

    console.log('🏃 Running migrations...');
    await dataSource.runMigrations();
    console.log('✅ Migrations completed successfully');

    // Close the connection
    await dataSource.destroy();

    console.log('✅ Global e2e test setup completed successfully');
  } catch (error) {
    console.error('❌ Global e2e test setup failed:', error);
    throw error;
  }
}

function getConfig() {
  return {
    ...getMigrationDataSourceConfig(),
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'postgres',
    database: 'zetik_test',
    synchronize: false,
  };
}
