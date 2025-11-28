# Crypto Assets Configuration

This configuration defines all supported cryptocurrencies and their Fireblocks network mappings.

## Supported Assets

### Native Blockchain Assets

- **BTC** (Bitcoin) - Native Bitcoin network
- **ETH** (Ethereum) - Native Ethereum network
- **LTC** (Litecoin) - Native Litecoin network
- **DOGE** (Dogecoin) - Native Dogecoin network
- **TRX** (Tron) - Native Tron network
- **XRP** (Ripple) - Native Ripple network
- **SOL** (Solana) - Native Solana network

### Multi-Network Assets

These assets require network selection as they exist on multiple blockchains:

#### USDC (USD Coin)

- **Ethereum** - ERC-20 token
- **Polygon** - Polygon network
- **Solana** - SPL token
- **Tron** - TRC-20 token

#### USDT (Tether USD)

- **Ethereum** - ERC-20 token
- **Tron** - TRC-20 token
- **Polygon** - Polygon network
- **Solana** - SPL token

## Fireblocks Asset IDs

### Testnet vs Mainnet

The configuration supports both testnet and mainnet environments:

- **Testnet**: Used for development/testing (e.g., `BTC_TEST`, `ETH_TEST3`)
- **Mainnet**: Used for production (e.g., `BTC`, `ETH`)

### Network-Specific Assets

For multi-network assets like USDC and USDT, Fireblocks uses different asset IDs:

```typescript
// USDC Examples
USDC_ETH; // USDC on Ethereum
USDC_POLYGON; // USDC on Polygon
USDC_SOL; // USDC on Solana
USDC_TRX; // USDC on Tron

// USDT Examples
USDT_ETH; // USDT on Ethereum
USDT_TRX; // USDT on Tron
USDT_POLYGON; // USDT on Polygon
USDT_SOL; // USDT on Solana
```

## Usage

### Getting Fireblocks Asset ID

```typescript
import { getFireblocksAssetId } from './crypto-assets.config';

// Get testnet Bitcoin asset ID
const btcTestId = getFireblocksAssetId(AssetTypeEnum.BTC, true);
// Returns: 'BTC_TEST'

// Get mainnet Ethereum asset ID
const ethMainId = getFireblocksAssetId(AssetTypeEnum.ETH, false);
// Returns: 'ETH'

// Get USDC on Ethereum testnet
const usdcEthTest = getFireblocksAssetId(AssetTypeEnum.USDC, true, 'ethereum');
// Returns: 'USDC_TEST'

// Get USDC on Ethereum mainnet
const usdcEthMain = getFireblocksAssetId(AssetTypeEnum.USDC, false, 'ethereum');
// Returns: 'USDC_ETH'
```

### Converting Fireblocks ID to Asset Type

```typescript
import { getAssetFromFireblocksId } from './crypto-assets.config';

const asset = getAssetFromFireblocksId('BTC_TEST');
// Returns: AssetTypeEnum.BTC

const usdcAsset = getAssetFromFireblocksId('USDC_ETH');
// Returns: AssetTypeEnum.USDC
```

## Configuration Structure

Each asset configuration includes:

- `symbol`: Internal asset enum value
- `name`: Human-readable name
- `decimals`: Number of decimal places
- `fireblocksAssetIds`: Fireblocks asset ID mappings
- `requiresNetworkSelection`: Whether network selection is needed
- `supportedNetworks`: List of supported networks (for multi-network assets)

## Environment Configuration

Set the following environment variables:

```bash
# Fireblocks API credentials
FIREBLOCKS_API_KEY=your_api_key
FIREBLOCKS_VAULT_ACCOUNT_ID=0
FIREBLOCKS_API_URL=https://sandbox-api.fireblocks.io  # or production URL

# Supported assets (comma-separated)
ACTIVE_ASSETS=BTC,ETH,USDC,USDT,LTC,DOGE,TRX,XRP,SOL
```

## Important Notes

1. **Network Selection**: For USDC and USDT, users must specify which network they want to use
2. **Testnet Default**: The system defaults to testnet asset IDs for development
3. **Asset Validation**: Only assets listed in `ACTIVE_ASSETS` environment variable are enabled
4. **Fireblocks Compatibility**: Asset IDs must match exactly with Fireblocks supported assets
