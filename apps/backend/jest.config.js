module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '../../tsconfig.spec.json',
      },
    ],
  },
  collectCoverageFrom: ['src/**/*.(t|j)s', '!src/**/*.spec.ts', '!src/**/*.e2e-spec.ts'],
  coverageDirectory: './coverage',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  moduleNameMapper: {
    '^@zetik/shared-entities$': '<rootDir>/../../libs/shared-entities/src/index.ts',
    '^@zetik/common$': '<rootDir>/../../libs/common/src/index.ts',
  },
  modulePathIgnorePatterns: ['<rootDir>/../../libs/shared-entities/dist/'],
  moduleDirectories: ['node_modules', '<rootDir>/../../node_modules'],
  modulePaths: ['<rootDir>/../../node_modules'],
};
