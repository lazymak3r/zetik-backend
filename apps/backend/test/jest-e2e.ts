import { config as dotenvConfig } from 'dotenv';
import type { Config } from 'jest';
import * as path from 'node:path';

dotenvConfig({ quiet: true, path: path.resolve(__dirname, '../.env.test') });

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.e2e-spec.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/setup-e2e.ts'],
  maxWorkers: 1,
  forceExit: true,
  detectOpenHandles: true,
  globalSetup: '<rootDir>/global-setup.ts',
  globalTeardown: '<rootDir>/global-teardown.ts',
};

export default config;
