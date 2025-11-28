import bs58 from 'bs58';
import * as nacl from 'tweetnacl';

export function verifySolanaSignature(
  message: string,
  signature: ArrayBuffer,
  publicKey: string,
): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const sigUint8 = new Uint8Array(signature);
    const publicKeyBytes = bs58.decode(publicKey);

    return nacl.sign.detached.verify(messageBytes, sigUint8, publicKeyBytes);
  } catch {
    return false;
  }
}
