import { AssetTypeEnum } from '@zetik/shared-entities';

/**
 * Generate consistent address keys for wallet storage
 * For USDC/USDT with network: USDC_ETH, USDC_BSC, USDT_ETH, USDT_BSC
 * For other assets: use asset symbol (BTC, LTC, ETH, etc.)
 */
export function getAddressKey(asset: AssetTypeEnum, network?: string): string {
  // For USDC/USDT with network, create compound key
  if ((asset === AssetTypeEnum.USDC || asset === AssetTypeEnum.USDT) && network) {
    // Map full network names to short codes
    const networkMap: Record<string, string> = {
      ethereum: 'ETH',
      bsc: 'BSC',
      solana: 'SOL',
      tron: 'TRX',
    };

    const networkShort = networkMap[network] || network.toUpperCase();
    return `${asset}_${networkShort}`;
  }

  // For other assets, use asset symbol directly
  return asset;
}
