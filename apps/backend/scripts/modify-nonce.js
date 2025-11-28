#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

// Load environment variables from .env file
function loadEnv() {
  const envPaths = [
    join(__dirname, '../.env'), // apps/backend/.env
    join(__dirname, '../../../.env'), // root .env
  ];

  for (const envPath of envPaths) {
    if (existsSync(envPath)) {
      console.log(`Loading environment from: ${envPath}`);
      const envContent = readFileSync(envPath, 'utf8');
      const envLines = envContent.split('\n');

      envLines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
          if (key && value !== undefined) {
            process.env[key] = value;
          }
        }
      });
      break;
    }
  }
}

async function modifyNonce() {
  const args = process.argv.slice(2);

  if (args.length !== 2) {
    console.log('Usage: node modify-nonce.js <userId> <newNonce>');
    console.log('Example: node modify-nonce.js 00348aae-a0b1-4e9d-8b98-49dad4179d11 12345');
    process.exit(1);
  }

  const [userId, newNonce] = args;

  // Load environment variables
  loadEnv();

  // Database connection using environment variables
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_DATABASE || 'postgres',
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  console.log(
    `Connecting to database: ${client.host}:${client.port}/${client.database} as ${client.user}`,
  );

  try {
    await client.connect();
    console.log('Connected to database');

    // Get current active seed pair and nonce
    const currentResult = await client.query(
      'SELECT id, nonce FROM games.seed_pairs WHERE "userId" = $1 AND "isActive" = true',
      [userId],
    );

    if (currentResult.rows.length === 0) {
      console.error('No active seed pair found for user');
      process.exit(1);
    }

    const seedPairId = currentResult.rows[0].id;
    const currentNonce = currentResult.rows[0].nonce;
    console.log(`Current nonce: ${currentNonce} (seed pair ID: ${seedPairId})`);

    // Update nonce
    client.query('UPDATE games.seed_pairs SET nonce = $1 WHERE id = $2', [newNonce, seedPairId]);

    console.log(`✅ Updated nonce from ${currentNonce} to ${newNonce}`);
    console.log('You can now replay scenarios with the same seed + nonce combination');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

modifyNonce();
