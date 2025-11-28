import { Test, TestingModule } from '@nestjs/testing';
import * as crypto from 'crypto';
import { BytesToFloatService } from './bytes-to-float.service';

/**
 * CRITICAL TEST SUITE: BytesToFloatService
 *
 * This test suite validates the Stake.com normalization algorithm implementation.
 * Any failures here could result in:
 * - Incorrect game outcomes
 * - House edge violations
 * - Division by zero errors in Limbo
 * - Financial losses
 *
 * Tests protect real money transactions.
 */
describe('BytesToFloatService - Critical Normalization Tests', () => {
  let service: BytesToFloatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BytesToFloatService],
    }).compile();

    service = module.get<BytesToFloatService>(BytesToFloatService);
  });

  describe('Basic Functionality Tests', () => {
    describe('singleBytesToFloat', () => {
      it('should convert all zero bytes to 0.0', () => {
        const bytes = Buffer.from([0x00, 0x00, 0x00, 0x00]);
        const result = service.singleBytesToFloat(bytes, 0);
        expect(result).toBe(0.0);
      });

      it('should convert all max bytes to value less than 1.0', () => {
        const bytes = Buffer.from([0xff, 0xff, 0xff, 0xff]);
        const result = service.singleBytesToFloat(bytes, 0);

        // CRITICAL: Must never reach 1.0
        expect(result).toBeLessThan(1.0);

        // Exact expected value
        const expected = 255 / 256 + 255 / 65536 + 255 / 16777216 + 255 / 4294967296;
        expect(result).toBeCloseTo(expected, 15);
      });

      it('should convert [0x80, 0x00, 0x00, 0x00] to exactly 0.5', () => {
        const bytes = Buffer.from([0x80, 0x00, 0x00, 0x00]);
        const result = service.singleBytesToFloat(bytes, 0);
        expect(result).toBe(0.5);
      });

      it('should convert [0xC0, 0x00, 0x00, 0x00] to exactly 0.75', () => {
        const bytes = Buffer.from([0xc0, 0x00, 0x00, 0x00]);
        const result = service.singleBytesToFloat(bytes, 0);
        expect(result).toBe(0.75);
      });

      it('should convert [0x40, 0x00, 0x00, 0x00] to exactly 0.25', () => {
        const bytes = Buffer.from([0x40, 0x00, 0x00, 0x00]);
        const result = service.singleBytesToFloat(bytes, 0);
        expect(result).toBe(0.25);
      });

      it('should handle offset parameter correctly', () => {
        const bytes = Buffer.from([0x00, 0x00, 0x80, 0x00, 0x00, 0x00]);
        const result = service.singleBytesToFloat(bytes, 2);
        expect(result).toBe(0.5);
      });

      it('should throw error when insufficient bytes', () => {
        const bytes = Buffer.from([0x00, 0x00, 0x00]);
        expect(() => service.singleBytesToFloat(bytes, 0)).toThrow('Insufficient bytes');
      });

      it('should throw error when offset exceeds buffer bounds', () => {
        const bytes = Buffer.from([0x00, 0x00, 0x00, 0x00]);
        expect(() => service.singleBytesToFloat(bytes, 1)).toThrow('Insufficient bytes');
      });
    });

    describe('bytesToFloat (multiple floats)', () => {
      it('should generate multiple floats from buffer', () => {
        const bytes = Buffer.from([
          0x00,
          0x00,
          0x00,
          0x00, // Float 1: 0.0
          0x80,
          0x00,
          0x00,
          0x00, // Float 2: 0.5
          0xc0,
          0x00,
          0x00,
          0x00, // Float 3: 0.75
        ]);

        const results = service.bytesToFloat(bytes, 0, 3);

        expect(results).toHaveLength(3);
        expect(results[0]).toBe(0.0);
        expect(results[1]).toBe(0.5);
        expect(results[2]).toBe(0.75);
      });

      it('should handle offset when generating multiple floats', () => {
        const bytes = Buffer.from([
          0xff,
          0xff, // Skip these
          0x00,
          0x00,
          0x00,
          0x00, // Float 1: 0.0
          0x80,
          0x00,
          0x00,
          0x00, // Float 2: 0.5
        ]);

        const results = service.bytesToFloat(bytes, 2, 2);

        expect(results).toHaveLength(2);
        expect(results[0]).toBe(0.0);
        expect(results[1]).toBe(0.5);
      });

      it('should throw error when insufficient bytes for count', () => {
        const bytes = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00]);
        expect(() => service.bytesToFloat(bytes, 0, 2)).toThrow('Insufficient bytes');
      });
    });
  });

  describe('Mathematical Verification Tests', () => {
    it('should match the mathematical formula exactly', () => {
      const testCases = [
        { bytes: [100, 50, 25, 10], hex: '64321a0a' },
        { bytes: [255, 128, 64, 32], hex: 'ff804020' },
        { bytes: [1, 2, 3, 4], hex: '01020304' },
        { bytes: [200, 150, 100, 50], hex: 'c8966432' },
      ];

      for (const testCase of testCases) {
        const bytes = Buffer.from(testCase.bytes);
        const result = service.singleBytesToFloat(bytes, 0);

        // Calculate expected value using the formula
        const expected =
          testCase.bytes[0] / 256 +
          testCase.bytes[1] / 65536 +
          testCase.bytes[2] / 16777216 +
          testCase.bytes[3] / 4294967296;

        expect(result).toBeCloseTo(expected, 15);
      }
    });

    it('should verify maximum value calculation', () => {
      const maxBytes = Buffer.from([255, 255, 255, 255]);
      const result = service.singleBytesToFloat(maxBytes, 0);

      // Mathematical proof
      const byte0 = 255 / 256; // = 0.99609375
      const byte1 = 255 / 65536; // = 0.00389099121...
      const byte2 = 255 / 16777216; // = 0.00001525879...
      const byte3 = 255 / 4294967296; // = 0.00000005960...

      const expected = byte0 + byte1 + byte2 + byte3;

      expect(result).toBeCloseTo(expected, 15);
      expect(result).toBeLessThan(1.0);
    });

    it('should produce uniform distribution characteristics', () => {
      // Test that sequential first bytes produce uniform spacing
      const values: number[] = [];
      for (let i = 0; i < 256; i++) {
        const bytes = Buffer.from([i, 0, 0, 0]);
        values.push(service.singleBytesToFloat(bytes, 0));
      }

      // Verify monotonically increasing
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]);
      }

      // Verify uniform spacing (1/256 = 0.00390625)
      const expectedSpacing = 1 / 256;
      for (let i = 1; i < values.length; i++) {
        const actualSpacing = values[i] - values[i - 1];
        expect(actualSpacing).toBeCloseTo(expectedSpacing, 10);
      }
    });
  });

  describe('Edge Case Tests', () => {
    it('should handle all possible single byte values', () => {
      for (let byteValue = 0; byteValue <= 255; byteValue++) {
        const bytes = Buffer.from([byteValue, 0, 0, 0]);
        const result = service.singleBytesToFloat(bytes, 0);

        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThan(1.0);
        expect(result).toBeCloseTo(byteValue / 256, 10);
      }
    });

    it('should never produce exactly 1.0 for any input', () => {
      // Test 10,000 random byte combinations
      for (let i = 0; i < 10000; i++) {
        const randomBytes = crypto.randomBytes(4);
        const result = service.singleBytesToFloat(randomBytes, 0);

        expect(result).toBeLessThan(1.0);
        expect(result).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Real-World Crypto Hash Integration', () => {
    it('should work with real HMAC-SHA512 hashes', () => {
      const serverSeed = 'test-server-seed';
      const clientSeed = 'test-client-seed';
      const nonce = '1';

      const hmac = crypto.createHmac('sha512', serverSeed);
      hmac.update(`${clientSeed}:${nonce}:LIMBO`);
      const hash = hmac.digest();

      // Extract first 4 bytes and normalize
      const result = service.singleBytesToFloat(hash, 0);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(1.0);
    });

    it('should produce deterministic results from same hash', () => {
      const hmac = crypto.createHmac('sha512', 'seed');
      hmac.update('data');
      const hash = hmac.digest();

      const result1 = service.singleBytesToFloat(hash, 0);
      const result2 = service.singleBytesToFloat(hash, 0);
      const result3 = service.singleBytesToFloat(hash, 0);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
  });

  describe('Performance Tests', () => {
    it('should process large numbers of floats efficiently', () => {
      const bytes = crypto.randomBytes(40000); // 10k floats * 4 bytes
      const startTime = performance.now();

      for (let i = 0; i < 10000; i++) {
        service.singleBytesToFloat(bytes, (i * 4) % (bytes.length - 4));
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should process 10k operations quickly (< 500ms)
      expect(duration).toBeLessThan(500);
    });
  });
});
