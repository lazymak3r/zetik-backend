import * as rs from 'jsrsasign';

export class SignatureUtils {
  static createSignature(privateKey, payload: string): string {
    const sign = new rs.KJUR.crypto.Signature({ alg: 'SHA256withECDSA' });
    sign.init(privateKey);
    const signHex = sign.signString(payload);
    return rs.hextob64(signHex);
  }

  static verifySignature(publicKey, payload: string, signature: string): boolean {
    const sig = new rs.KJUR.crypto.Signature({ alg: 'SHA256withECDSA' });
    sig.init(publicKey);
    sig.updateString(payload);
    return sig.verify(rs.b64nltohex(signature));
  }
}
