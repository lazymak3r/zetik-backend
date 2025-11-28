import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

export class PasswordUtil {
  private static readonly SALT_LENGTH = 32;
  private static readonly KEY_LENGTH = 64;

  static async hash(password: string): Promise<string> {
    const salt = randomBytes(this.SALT_LENGTH);
    const key = (await scryptAsync(password, salt, this.KEY_LENGTH)) as Buffer;

    return `${salt.toString('hex')}:${key.toString('hex')}`;
  }

  static async verify(password: string, hash: string): Promise<boolean> {
    const [saltHex, keyHex] = hash.split(':');
    if (!saltHex || !keyHex) {
      return false;
    }

    const salt = Buffer.from(saltHex, 'hex');
    const storedKey = Buffer.from(keyHex, 'hex');

    const derivedKey = (await scryptAsync(password, salt, this.KEY_LENGTH)) as Buffer;

    return timingSafeEqual(storedKey, derivedKey);
  }
}
