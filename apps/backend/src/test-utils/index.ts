/**
 * Test utilities index - centralized access to all testing infrastructure
 */

// Common providers for dependency injection
export * from './common-providers';

// Test data factories for consistent mock data
export * from './test-data-factory';

// Database testing utilities
export * from './test-database';

// Re-export commonly used testing libraries for convenience
export { INestApplication } from '@nestjs/common';
export { Test, TestingModule } from '@nestjs/testing';
export { DataSource, QueryRunner, Repository } from 'typeorm';

// Common Jest utilities
export const createMockRepository = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  findBy: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  create: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
  })),
});

export const createMockService = (methods: string[] = []) => {
  const mock = {};
  methods.forEach((method) => {
    mock[method] = jest.fn();
  });
  return mock;
};

// Common test patterns
export const expectToThrowAsync = async (promise: Promise<any>, expectedError?: any) => {
  try {
    await promise;
    throw new Error('Expected promise to throw, but it resolved');
  } catch (error) {
    if (expectedError) {
      expect(error).toBeInstanceOf(expectedError);
    }
    return error;
  }
};

// Test timing utilities
export const waitFor = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const retryUntil = async <T>(
  operation: () => Promise<T>,
  condition: (result: T) => boolean,
  maxRetries: number = 10,
  delayMs: number = 100,
): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    const result = await operation();
    if (condition(result)) {
      return result;
    }
    if (i < maxRetries - 1) {
      await waitFor(delayMs);
    }
  }
  throw new Error(`Operation did not meet condition after ${maxRetries} retries`);
};
