import { AssetTypeEnum } from '@zetik/shared-entities';
import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import { CRYPTO_ASSETS_CONFIG } from '../config/crypto-assets.config';

// Object passed to validator must have an asset property
interface AssetValidationObject {
  asset: AssetTypeEnum;
}

export function IsNetworkRequiredForAsset(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNetworkRequiredForAsset',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const obj = args.object as AssetValidationObject;
          const asset = obj.asset;

          if (!asset) return true; // Let other validators handle missing asset

          const config = CRYPTO_ASSETS_CONFIG[asset];
          if (!config) return true; // Let other validators handle invalid asset

          // If asset requires network selection, network must be provided
          if (config.requiresNetworkSelection) {
            if (typeof value !== 'string') return false; // Network is required and must be a string

            // Check if provided network is supported
            return config.supportedNetworks?.includes(value) || false;
          }

          return true; // Network not required for this asset
        },
        defaultMessage(args: ValidationArguments) {
          const obj = args.object as AssetValidationObject;
          const asset = obj.asset;
          const config = CRYPTO_ASSETS_CONFIG[asset];

          if (config?.requiresNetworkSelection) {
            if (typeof args.value !== 'string') {
              return `Network is required for ${asset}. Supported networks: ${config.supportedNetworks?.join(', ')}`;
            }
            return `Invalid network for ${asset}. Supported networks: ${config.supportedNetworks?.join(', ')}`;
          }

          return 'Invalid network configuration';
        },
      },
    });
  };
}
