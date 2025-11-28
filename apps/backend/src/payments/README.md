TODO: All assets should be configurable at the database level not .env level. They should all be able to be added/configured dynamically from the admin panel.

# Payments Module

## Overview

This module provides endpoints to:

- Retrieve or generate user deposit addresses with network support
- Get list of available assets with network options
- Process webhook notifications from Fireblocks

## New Features

### Multi-Network Asset Support

The module now supports cryptocurrencies that exist on multiple networks:

- **USDC**: Ethereum, Polygon, Solana, Tron
- **USDT**: Ethereum, Tron, Polygon, Solana

### Network Selection

For multi-network assets, users must specify the network when requesting deposit addresses.

## API Endpoints

### GET /v1/payments/available-assets

Returns list of all available cryptocurrencies with their network options.

**Response:**

```json
{
  "assets": [
    {
      "symbol": "BTC",
      "name": "Bitcoin",
      "decimals": 8,
      "requiresNetworkSelection": false
    },
    {
      "symbol": "USDC",
      "name": "USD Coin",
      "decimals": 6,
      "requiresNetworkSelection": true,
      "networks": [
        {
          "id": "ethereum",
          "name": "Ethereum",
          "description": "ERC-20 token"
        },
        {
          "id": "polygon",
          "name": "Polygon",
          "description": "Polygon network"
        }
      ]
    }
  ]
}
```

### GET /v1/payments/deposit-address

Get deposit address for a specific asset and network.

**Query Parameters:**

- `asset` (required): Asset symbol (BTC, ETH, USDC, etc.)
- `network` (optional): Network identifier (required for USDC, USDT)

**Examples:**

```bash
# Bitcoin (no network required)
GET /v1/payments/deposit-address?asset=BTC

# USDC on Ethereum
GET /v1/payments/deposit-address?asset=USDC&network=ethereum

# USDT on Tron
GET /v1/payments/deposit-address?asset=USDT&network=tron
```

**Response:**

```json
{
  "address": "0x742d35Cc6634C0532925a3b8D4C9db96590c6C87",
  "qrCode": "data:image/svg+xml;base64,..."
}
```

### Validation Rules

- For assets that require network selection (USDC, USDT), the `network` parameter is mandatory
- The specified network must be supported by the asset
- Invalid network combinations will return validation errors

## Configuration

### Fireblocks API Credentials

Before using this module, obtain and configure your Fireblocks API credentials:

- In the Fireblocks Console, navigate to **Settings → API Keys** and create a new key pair.
- Copy the public API key and set it in your `.env` as `FIREBLOCKS_API_KEY`.
- In the Fireblocks Console, navigate to **Vault Accounts → [Your Vault]** and copy the Vault Account ID; set it as `FIREBLOCKS_VAULT_ACCOUNT_ID` (if using the default account, set `0`).
- Download the generated private key file, rename it to `fireblocks_secret.key`, and place it at the project root.

### Webhook Configuration

1. In the Fireblocks console, create a webhook for `transaction` events.
2. Set the webhook URL to:
   ```
   https://<your-domain>/v1/payments/fireblocks-webhook
   ```
3. Copy the webhook public key from Fireblocks and save it to a file named `fireblocks_webhook_pubkey.pem` in the project root directory.

### Environment Variables

```bash
# Fireblocks API credentials
FIREBLOCKS_API_KEY=your_api_key
FIREBLOCKS_VAULT_ACCOUNT_ID=0
FIREBLOCKS_API_URL=https://sandbox-api.fireblocks.io  # or production URL

# Supported assets (comma-separated)
ACTIVE_ASSETS=BTC,ETH,USDC,USDT,LTC,DOGE,TRX,XRP,SOL

# Currency Rate Validation (for Fireblocks API rates)

## Overview
The system now fetches cryptocurrency rates from Fireblocks infrastructure with periodic updates.

## Key Changes Made
- **Rate Update Frequency**: Changed from hourly to every 4 hours to comply with Fireblocks rate limiting best practices
- **Source**: Uses Fireblocks infrastructure for price management

## Configuration
- Fireblocks rate updates every 4 hours (0 */4 * * *)
- Cache TTL: 5 minutes for real-time price requests
- Automatic cleanup of old rate records after 30 days
```

## Supported Networks

### Ethereum Network

- **Assets**: ETH, USDC, USDT
- **Token Standard**: ERC-20 (for tokens)
- **Network ID**: `ethereum`

### Polygon Network

- **Assets**: USDC, USDT
- **Token Standard**: Polygon native
- **Network ID**: `polygon`

### Solana Network

- **Assets**: SOL, USDC, USDT
- **Token Standard**: SPL tokens
- **Network ID**: `solana`

### Tron Network

- **Assets**: TRX, USDC, USDT
- **Token Standard**: TRC-20 (for tokens)
- **Network ID**: `tron`

### Native Networks

- **Bitcoin**: BTC (native)
- **Litecoin**: LTC (native)
- **Dogecoin**: DOGE (native)
- **Ripple**: XRP (native)

## Error Handling

### Network Validation Errors

```json
{
  "statusCode": 400,
  "message": ["Network is required for USDC. Supported networks: ethereum, polygon, solana, tron"],
  "error": "Bad Request"
}
```

### Invalid Network Errors

```json
{
  "statusCode": 400,
  "message": ["Invalid network for USDT. Supported networks: ethereum, tron, polygon, solana"],
  "error": "Bad Request"
}
```

## Frontend Integration

### Getting Available Assets

```typescript
// Fetch available assets
const response = await fetch('/v1/payments/available-assets');
const { assets } = await response.json();

// Filter assets that require network selection
const multiNetworkAssets = assets.filter((asset) => asset.requiresNetworkSelection);

// Get networks for USDC
const usdcAsset = assets.find((asset) => asset.symbol === 'USDC');
const networks = usdcAsset?.networks || [];
```

### Requesting Deposit Address

```typescript
// For single-network assets
const btcAddress = await fetch('/v1/payments/deposit-address?asset=BTC');

// For multi-network assets
const usdcAddress = await fetch('/v1/payments/deposit-address?asset=USDC&network=ethereum');
```

## Important Notes

1. **Network Selection**: Always check `requiresNetworkSelection` before requesting deposit addresses
2. **Validation**: The API will validate network requirements and return appropriate error messages
3. **Fireblocks Compatibility**: All network configurations match Fireblocks asset IDs
4. **Address Uniqueness**: Each user gets a unique deposit address per asset/network combination

## Endpoints

### GET /v1/payments/deposits-address/{asset}

Retrieves an existing deposit address for the specified asset or generates a new one if none exists.

**Path Parameters:**

- `asset` (string): Asset symbol (e.g., `BTC`).

**Response:**

```json
{ "address": "string" }
```

### POST /v1/payments/fireblocks-webhook

Fetches the latest transactions (up to 100) from Fireblocks, upserts them into the `transactions` table, and returns synchronization statistics.

Transactions are fetched based on Fireblocks' `createdAt` timestamps: the service records the `createdAt` of the last synchronized transaction and, on subsequent calls, fetches from five minutes before that timestamp to ensure no records are missed.

**Response:**

```json
{
  "synced": "number",
  "creditedCount": "number",
  "creditedTotal": "string"
}
```

### POST /v1/payments/fireblocks-webhook

Processes incoming webhook notifications from Fireblocks. The endpoint verifies the signature if a webhook public key is configured.

**Headers:**

- `fireblocks-signature`: Signature provided by Fireblocks for webhook verification

**Body:**
A Fireblocks webhook payload containing transaction information.

**Response:**

```json
{
  "status": "success"
}
```

## Usage

To fund a testnet BTC address, you can use any public faucet:

- https://bitcoinfaucet.uo1.net/
- https://coinfaucet.eu/en/btc-testnet

## Processing Logic

1. When a deposit transaction is created or updated, Fireblocks sends a webhook notification to the endpoint.
2. The webhook handler verifies the signature and processes the transaction.
3. For deposit transactions, it identifies the user from the destination account name format `user_{userId}`.
4. The service then triggers synchronization to fetch and process the latest transactions.
5. Only `COMPLETED` deposit transactions that are not yet credited (`isCredited = false`) are processed.
6. User wallets matching the asset and address are credited within a single database transaction.
7. Each processed record in the `transactions` table is marked with `isCredited = true` and `creditedAt = NOW()`.
