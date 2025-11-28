import { computeTokenHash } from './token-hash.util';

describe('computeTokenHash', () => {
  it('should generate SHA256 hash from token', () => {
    const token = 'test-token-12345';
    const hash = computeTokenHash(token);

    // SHA256 produces 64 hex characters
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should be deterministic - same token produces same hash', () => {
    const token = 'test-token-12345';
    const hash1 = computeTokenHash(token);
    const hash2 = computeTokenHash(token);

    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different tokens', () => {
    const token1 = 'test-token-1';
    const token2 = 'test-token-2';

    const hash1 = computeTokenHash(token1);
    const hash2 = computeTokenHash(token2);

    expect(hash1).not.toBe(hash2);
  });

  it('should handle long tokens', () => {
    const token = 'a'.repeat(1000);
    const hash = computeTokenHash(token);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should handle special characters in token', () => {
    const token = 'test.token-_$#@!~';
    const hash = computeTokenHash(token);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
