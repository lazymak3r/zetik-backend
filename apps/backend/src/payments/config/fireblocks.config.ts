import { registerAs } from '@nestjs/config';
import { AssetTypeEnum } from '@zetik/shared-entities';
import * as env from 'env-var';

// ACTIVE_ASSETS: comma-separated list of supported asset symbols (e.g. 'BTC,ETH')
export const fireblocksConfig = registerAs('fireblocks', () => {
  const apiKey = env.get('FIREBLOCKS_API_KEY').required().asString();
  const apiSecret = env.get('FIREBLOCKS_API_SECRET').required().asString();
  const apiUrl = env.get('FIREBLOCKS_API_URL').required().asString();
  const vaultAccountId = env.get('FIREBLOCKS_VAULT_ACCOUNT_ID').required().asString();
  const rawAssets = env.get('ACTIVE_ASSETS').required().asString();
  const configuredAssets = rawAssets
    .split(',')
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
  if (configuredAssets.length === 0) {
    throw new Error('ACTIVE_ASSETS must include at least one asset');
  }
  const invalidAssets = configuredAssets.filter(
    (asset) => !Object.values(AssetTypeEnum).includes(asset as AssetTypeEnum),
  );
  if (invalidAssets.length > 0) {
    throw new Error(`Unsupported assets in ACTIVE_ASSETS: ${invalidAssets.join(', ')}`);
  }
  const supportedAssets = configuredAssets as AssetTypeEnum[];
  const webhookPublicKey = env.get('FIREBLOCKS_WEBHOOK_PUBLIC_KEY').required().asString();
  const webhookSandboxPublicKey = env
    .get('FIREBLOCKS_WEBHOOK_SANDBOX_PUBLIC_KEY')
    .required()
    .asString();

  return {
    apiKey,
    apiSecret: Buffer.from(apiSecret, 'base64').toString(),
    apiUrl,
    vaultAccountId,
    supportedAssets,
    webhookPublicKey: Buffer.from(webhookPublicKey, 'base64').toString(),
    webhookSandboxPublicKey: Buffer.from(webhookSandboxPublicKey, 'base64').toString(),
  };
});
