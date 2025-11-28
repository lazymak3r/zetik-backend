import { config } from 'dotenv';
import { join } from 'path';
config({
  path: [join(process.cwd(), 'apps/backend/.env'), join(process.cwd(), '.env')],
});

import {
  AdminAuditLogEntity,
  AdminEntity,
  ApiKeyEntity,
  DefaultAvatarEntity,
  SystemSettingEntity,
} from '@zetik/shared-entities';
import { DataSource } from 'typeorm';
import { getDataSourceConfig } from './data-source';

export function getMigrationDataSourceConfig() {
  const dsConfig = getDataSourceConfig();
  return {
    ...dsConfig,
    migrations: ['src/migrations/*.ts'],
    entities: [
      // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
      ...(dsConfig.entities as Array<Function>),
      AdminEntity,
      AdminAuditLogEntity,
      ApiKeyEntity,
      SystemSettingEntity,
      DefaultAvatarEntity,
    ],
  };
}

export const AppDataSource = new DataSource(getMigrationDataSourceConfig());
