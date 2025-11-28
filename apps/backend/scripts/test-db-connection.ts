import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

// Load environment variables
dotenv.config({ quiet: true });

async function testConnection() {
  console.log('🔌 Testing database connection...\n');

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'postgres',
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Database connection successful!\n');

    console.log('📋 Connection Details:');
    console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`   Port: ${process.env.DB_PORT || '5432'}`);
    console.log(`   Database: ${process.env.DB_DATABASE || 'postgres'}`);
    console.log(`   Username: ${process.env.DB_USERNAME || 'postgres'}\n`);

    // Test query

    const result = await dataSource.query('SELECT version()');

    console.log('📊 PostgreSQL Version:', result[0].version);

    // Check schemas
    const schemaQuery = `
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name IN ('users', 'payments', 'balance', 'bonus', 'games')
      ORDER BY schema_name;
    `;

    const schemas = await dataSource.query(schemaQuery);

    console.log('\n📚 Available Schemas:');

    if (schemas.length > 0) {
      schemas.forEach((schema: any) => {
        console.log(`   ✓ ${schema.schema_name}`);
      });
    } else {
      console.log('   ⚠️  No application schemas found. Run setup script to create them.');
    }

    await dataSource.destroy();
    console.log('\n✅ Database test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed!\n');
    console.error('Error:', error instanceof Error ? error.message : String(error));
    console.error('\nPlease ensure:');
    console.error('1. PostgreSQL is running (docker compose up -d postgres)');
    console.error('2. Database credentials in .env are correct');
    console.error('3. Database exists and is accessible');
    process.exit(1);
  }
}

// Run the test
void testConnection();
