# Zetik Casino Backend

This project requires Node.js v24 or higher.

Configure environment variables:

```bash
cp .env.example .env
cp .env.example ./test/.env
cp fireblocks_secret.key.example fireblocks_secret.key
```

Start the application:

```bash
docker-compose down -v
docker-compose up -d
pnpm start
```

Note: Database schemas are automatically created on application startup. If you're having issues with missing schemas, restart the application or manually run the SQL script:

```bash
docker exec -i zetik_postgres psql -U postgres -d postgres < docker-postgres.sql
```

### Local development

For public url
Register https://dashboard.ngrok.com/signup
`brew install ngrok/ngrok/ngrok`
`ngrok config add-authtoken 2x78...`
`pnpm start:dev`
then `ngrok http 3000`

returns `Forwarding https://d2fe-174-216-215-22.ngrok-free.app` use for webhook in your Fireblocks console

---# Payments Module

## Overview

This module provides endpoints to:

- Retrieve or generate user deposit addresses
- Synchronize transactions from Fireblocks

## Configuration

### Fireblocks API Credentials

Before using this module, obtain and configure your Fireblocks API credentials:

- In the Fireblocks Console, navigate to **Settings → API Keys** and create a new key pair.
- Copy the public API key and set it in your `.env` as `FIREBLOCKS_API_KEY`.
- In the Fireblocks Console, navigate to **Vault Accounts → [Your Vault]** and copy the Vault Account ID; set it as `FIREBLOCKS_VAULT_ACCOUNT_ID` (if using the default account, set `0`).
- Download the generated private key file, rename it to `fireblocks_secret.key`, and place it at the project root.

1. In the Fireblocks console, create a webhook
2. Set the webhook URL to:
   ```
   https://<your-domain>/v1/payments/fireblocks-webhook
   ```

## Endpoints

### GET /v1/payments/deposits-address/{asset}

Retrieves an existing deposit address for the specified asset or generates a new one if none exists.

**Path Parameters:**

- `asset` (string): Asset symbol (e.g., `BTC`).

**Response:**

```json
{ "address": "string" }
```

## Testing

The project includes comprehensive unit and E2E tests with automated coverage reporting.

- **Test Documentation**: See [TESTING.md](./TESTING.md) for detailed testing guide
- **Coverage Report**: Run `pnpm test:report` to generate `TEST_COVERAGE.md`
- **Quick Commands**:
  - `pnpm test` - Run unit tests
  - `pnpm test:e2e` - Run E2E tests
  - `pnpm test:all` - Run all tests and generate report
  - `pnpm create-test-user` - Creates a test user with 100 USDT deposit

### Creating a Test User

To create a test user with a 100 USDT deposit, run:

```bash
pnpm create-test-user
```

The script will create a user with a random email and username, and fund their balance with 100 USDT. After execution, the script will display login information (email and password) for the created user.

## Usage

To fund a testnet BTC address, you can use any public faucet:

- https://bitcoinfaucet.uo1.net/
- https://coinfaucet.eu/en/btc-testnet

## Processing Logic

1. When a deposit transaction completes, Fireblocks sends a `transaction` event to the webhook endpoint.
