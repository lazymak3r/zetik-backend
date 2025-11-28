import { config } from 'dotenv';
import { resolve } from 'path';
import { Client } from 'pg';

// Load test environment variables
config({ quiet: true, path: resolve(__dirname, '..', '.env.test') });

async function setupTestDatabase() {
  // Connect to postgres database to create test database
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    user: process.env.DB_USERNAME,
    password: String(process.env.DB_PASSWORD),
    database: 'postgres', // Connect to default postgres database
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL server');

    // Check if database exists
    const dbExistsResult = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [
      process.env.DB_DATABASE,
    ]);

    if (dbExistsResult.rows.length === 0) {
      // Create database if it doesn't exist
      await client.query(`CREATE DATABASE ${process.env.DB_DATABASE}`);
      console.log(`Created database: ${process.env.DB_DATABASE}`);
    } else {
      console.log(`Database ${process.env.DB_DATABASE} already exists`);
    }

    await client.end();

    // Now connect to the test database to create schemas
    const testClient = new Client({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10),
      user: process.env.DB_USERNAME,
      password: String(process.env.DB_PASSWORD),
      database: process.env.DB_DATABASE,
    });

    await testClient.connect();
    console.log(`Connected to ${process.env.DB_DATABASE} database`);

    // Create schemas with fixed names
    const schemas = [
      'users',
      'payments',
      'balance',
      'admin',
      'bonus',
      'games',
      'blog',
      'chat',
      'affiliate',
    ];

    for (const schema of schemas) {
      await testClient.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
      console.log(`Created schema: ${schema}`);
    }

    await testClient.end();
    console.log('Test database setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error setting up test database:', error);
    process.exit(1);
  }
}

setupTestDatabase();
