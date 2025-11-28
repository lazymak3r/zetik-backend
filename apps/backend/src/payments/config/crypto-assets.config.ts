import { AssetTypeEnum } from '@zetik/shared-entities';

export interface CryptoAssetConfig {
  symbol: AssetTypeEnum;
  name: string;
  decimals: number;
  fireblocksAssetIds: {
    testnet: string;
    mainnet: string;
    networks?: {
      [network: string]: {
        testnet: string;
        mainnet: string;
      };
    };
  };
  requiresNetworkSelection?: boolean;
  supportedNetworks?: string[];
}

export const CRYPTO_ASSETS_CONFIG: Record<AssetTypeEnum, CryptoAssetConfig> = {
  [AssetTypeEnum.BTC]: {
    symbol: AssetTypeEnum.BTC,
    name: 'Bitcoin',
    decimals: 8,
    fireblocksAssetIds: {
      testnet: 'BTC_TEST',
      mainnet: 'BTC',
    },
  },

  [AssetTypeEnum.ETH]: {
    symbol: AssetTypeEnum.ETH,
    name: 'Ethereum',
    decimals: 18,
    fireblocksAssetIds: {
      testnet: 'ETH_TEST5', // corrected from ETH_TEST3
      mainnet: 'ETH',
    },
  },

  [AssetTypeEnum.USDC]: {
    symbol: AssetTypeEnum.USDC,
    name: 'USD Coin',
    decimals: 6,
    requiresNetworkSelection: true,
    supportedNetworks: ['bsc', 'ethereum'],
    fireblocksAssetIds: {
      // Default BSC mapping
      testnet: 'USDC_BSC',
      mainnet: 'USDC_BSC',
      networks: {
        bsc: {
          testnet: 'USDC_BSC',
          mainnet: 'USDC_BSC',
        },
        ethereum: {
          // Ethereum Testnet (Sepolia)
          testnet: 'USDC_ETH_TEST5_AN74', // Fireblocks API ID for USDC on Sepolia
          mainnet: 'USDC', // Fireblocks API ID for USDC on Ethereum mainnet
          // contractAddress: '0x1c7D...9C7238'
        },
      },
    },
  },

  [AssetTypeEnum.USDT]: {
    symbol: AssetTypeEnum.USDT,
    name: 'Tether USD',
    decimals: 6,
    requiresNetworkSelection: true,
    supportedNetworks: ['bsc'],
    fireblocksAssetIds: {
      testnet: 'USDT_BSC_TEST', // corrected from USDT_ERC20
      mainnet: 'USDT_BSC',
      networks: {
        bsc: {
          testnet: 'USDT_BSC_TEST',
          mainnet: 'USDT_BSC',
        },
      },
    },
  },

  [AssetTypeEnum.LTC]: {
    symbol: AssetTypeEnum.LTC,
    name: 'Litecoin',
    decimals: 8,
    fireblocksAssetIds: {
      testnet: 'LTC_TEST',
      mainnet: 'LTC',
    },
  },

  [AssetTypeEnum.DOGE]: {
    symbol: AssetTypeEnum.DOGE,
    name: 'Dogecoin',
    decimals: 8,
    fireblocksAssetIds: {
      testnet: 'DOGE_TEST',
      mainnet: 'DOGE',
    },
  },

  [AssetTypeEnum.TRX]: {
    symbol: AssetTypeEnum.TRX,
    name: 'Tron',
    decimals: 6,
    fireblocksAssetIds: {
      testnet: 'TRX_TEST',
      mainnet: 'TRX',
    },
  },

  [AssetTypeEnum.XRP]: {
    symbol: AssetTypeEnum.XRP,
    name: 'Ripple',
    decimals: 6,
    fireblocksAssetIds: {
      testnet: 'XRP_TEST',
      mainnet: 'XRP',
    },
  },

  [AssetTypeEnum.SOL]: {
    symbol: AssetTypeEnum.SOL,
    name: 'Solana',
    decimals: 9,
    fireblocksAssetIds: {
      testnet: 'SOL_TEST',
      mainnet: 'SOL',
    },
  },
};

export function getFireblocksAssetId(
  asset: AssetTypeEnum,
  isTestnet: boolean = true,
  network?: string,
): string {
  const config = CRYPTO_ASSETS_CONFIG[asset];
  if (!config) {
    throw new Error(`Unsupported asset: ${asset}`);
  }

  if (network && config.fireblocksAssetIds.networks?.[network]) {
    return isTestnet
      ? config.fireblocksAssetIds.networks[network].testnet
      : config.fireblocksAssetIds.networks[network].mainnet;
  }

  return isTestnet ? config.fireblocksAssetIds.testnet : config.fireblocksAssetIds.mainnet;
}

export function getAssetFromFireblocksId(fireblocksId: string): AssetTypeEnum | null {
  for (const [asset, config] of Object.entries(CRYPTO_ASSETS_CONFIG)) {
    const { testnet, mainnet, networks } = config.fireblocksAssetIds;

    if (fireblocksId === testnet || fireblocksId === mainnet) {
      return asset as AssetTypeEnum;
    }

    if (networks) {
      for (const networkConfig of Object.values(networks)) {
        if (fireblocksId === networkConfig.testnet || fireblocksId === networkConfig.mainnet) {
          return asset as AssetTypeEnum;
        }
      }
    }
  }

  return null;
}
