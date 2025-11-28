import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import * as WAValidator from 'multicoin-address-validator';
import { AssetTypeEnum } from '../balance/enums/asset-type.enum';

@ValidatorConstraint({ name: 'AssetSpecificAddressValidator', async: false })
export class AssetSpecificAddressValidator implements ValidatorConstraintInterface {
  private isTestnet: boolean;

  constructor() {
    // Check if we're in testnet mode
    const apiUrl = process.env.FIREBLOCKS_API_URL || '';
    this.isTestnet = apiUrl.includes('sandbox');
  }

  validate(address: string, args: ValidationArguments): boolean {
    const object = args.object as any;
    const asset = object.asset as AssetTypeEnum;

    if (!asset || !address) return false;

    return this.validateAddressForAsset(asset, address);
  }

  defaultMessage(args: ValidationArguments) {
    const object = args.object as any;
    const asset = object.asset as AssetTypeEnum;
    return `Invalid ${asset} address format${this.isTestnet ? ' for testnet' : ''}`;
  }

  private validateAddressForAsset(asset: AssetTypeEnum, address: string): boolean {
    // Map your AssetTypeEnum to the coin codes used by the validator
    const coinCode = this.mapAssetToCoinCode(asset);

    if (!coinCode) {
      // For unsupported assets, do basic validation only
      return address.length >= 10 && address.length <= 256;
    }

    try {
      return WAValidator.validate(address, coinCode, this.isTestnet ? 'testnet' : 'prod');
    } catch (error) {
      console.error(`Error validating ${asset} address:`, error);
      return false;
    }
  }

  private mapAssetToCoinCode(asset: AssetTypeEnum): string | null {
    const coinMap: Record<AssetTypeEnum, string> = {
      [AssetTypeEnum.BTC]: 'BTC',
      [AssetTypeEnum.ETH]: 'ETH',
      [AssetTypeEnum.LTC]: 'LTC',
      [AssetTypeEnum.DOGE]: 'DOGE',
      [AssetTypeEnum.USDC]: 'ETH', // ERC-20 tokens use ETH addresses
      [AssetTypeEnum.USDT]: 'ETH', // ERC-20 tokens use ETH addresses
      [AssetTypeEnum.SOL]: 'SOL',
      [AssetTypeEnum.TRX]: 'TRX',
      [AssetTypeEnum.XRP]: 'XRP',
      // Add any other assets you support
    };

    return coinMap[asset] || null;
  }
}
