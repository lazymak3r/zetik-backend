import { PasswordUtil } from './password.util';

describe('PasswordUtil', () => {
  describe('hash', () => {
    it('should hash password and return salt:hash format', async () => {
      const password = 'testPassword123!';
      const hashed = await PasswordUtil.hash(password);

      expect(hashed).toMatch(/^[a-f0-9]{64}:[a-f0-9]{128}$/);
      expect(hashed.split(':')).toHaveLength(2);
    });

    it('should create different hashes for same password', async () => {
      const password = 'testPassword123!';
      const hash1 = await PasswordUtil.hash(password);
      const hash2 = await PasswordUtil.hash(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verify', () => {
    it('should verify correct password', async () => {
      const password = 'testPassword123!';
      const hashed = await PasswordUtil.hash(password);

      const isValid = await PasswordUtil.verify(password, hashed);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testPassword123!';
      const wrongPassword = 'wrongPassword123!';
      const hashed = await PasswordUtil.hash(password);

      const isValid = await PasswordUtil.verify(wrongPassword, hashed);
      expect(isValid).toBe(false);
    });

    it('should handle invalid hash format', async () => {
      const password = 'testPassword123!';
      const invalidHash = 'invalid-hash-format';

      const isValid = await PasswordUtil.verify(password, invalidHash);
      expect(isValid).toBe(false);
    });
  });
});
