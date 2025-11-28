import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import * as nacl from 'tweetnacl';
import { verifySolanaSignature } from './solana-signature.util';

describe('verifySolanaSignature', () => {
  let keypair: Keypair;
  let publicKey: string;
  let validMessage: string;
  let validSignature: string;

  beforeEach(() => {
    keypair = Keypair.generate();
    publicKey = keypair.publicKey.toBase58();
    validMessage = 'Test message for signing';

    const messageBytes = new TextEncoder().encode(validMessage);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
    validSignature = bs58.encode(signature);
  });

  it('should verify valid signature correctly', () => {
    const signatureBuffer = bs58.decode(validSignature).buffer;
    const result = verifySolanaSignature(validMessage, signatureBuffer, publicKey);
    expect(result).toBe(true);
  });

  it('should reject invalid signature', () => {
    const invalidSignature = new ArrayBuffer(64); // Invalid signature buffer
    const result = verifySolanaSignature(validMessage, invalidSignature, publicKey);
    expect(result).toBe(false);
  });

  it('should reject signature with wrong message', () => {
    const wrongMessage = 'Different message';
    const signatureBuffer = bs58.decode(validSignature).buffer;
    const result = verifySolanaSignature(wrongMessage, signatureBuffer, publicKey);
    expect(result).toBe(false);
  });

  it('should reject signature with wrong public key', () => {
    const anotherKeypair = Keypair.generate();
    const wrongPublicKey = anotherKeypair.publicKey.toBase58();
    const signatureBuffer = bs58.decode(validSignature).buffer;
    const result = verifySolanaSignature(validMessage, signatureBuffer, wrongPublicKey);
    expect(result).toBe(false);
  });

  it('should handle invalid public key gracefully', () => {
    const invalidPublicKey = 'invalid-public-key';
    const signatureBuffer = bs58.decode(validSignature).buffer;
    const result = verifySolanaSignature(validMessage, signatureBuffer, invalidPublicKey);
    expect(result).toBe(false);
  });

  it('should handle empty message', () => {
    const emptyMessage = '';
    const messageBytes = new TextEncoder().encode(emptyMessage);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
    const signatureBuffer = signature.buffer;

    const result = verifySolanaSignature(emptyMessage, signatureBuffer, publicKey);
    expect(result).toBe(true);
  });

  it('should handle special characters in message', () => {
    const specialMessage = 'Message with special chars: !@#$%^&*()_+-=[]{}|;:,.<>?';
    const messageBytes = new TextEncoder().encode(specialMessage);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
    const signatureBuffer = signature.buffer;

    const result = verifySolanaSignature(specialMessage, signatureBuffer, publicKey);
    expect(result).toBe(true);
  });

  it('should handle Unicode characters in message', () => {
    const unicodeMessage = 'Unicode test: 🔐 signature test';
    const messageBytes = new TextEncoder().encode(unicodeMessage);
    const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
    const signatureBuffer = signature.buffer;

    const result = verifySolanaSignature(unicodeMessage, signatureBuffer, publicKey);
    expect(result).toBe(true);
  });
});
