import { OAuth2Client } from 'google-auth-library';

export interface IGoogleTokenPayload {
  sub: string; // Google user ID
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  locale?: string;
  aud: string; // audience (client ID)
  iss: string; // issuer
  exp: number; // expiration time
  iat: number; // issued at
}

export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
): Promise<IGoogleTokenPayload | null> {
  try {
    const client = new OAuth2Client();

    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      return null;
    }

    // Additional validation according to Google documentation
    if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
      return null;
    }

    if (payload.aud !== clientId) {
      return null;
    }

    if (!payload.email || !payload.email_verified) {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      email_verified: payload.email_verified,
      name: payload.name || '',
      picture: payload.picture,
      given_name: payload.given_name,
      family_name: payload.family_name,
      locale: payload.locale,
      aud: payload.aud,
      iss: payload.iss,
      exp: payload.exp || 0,
      iat: payload.iat || 0,
    };
  } catch {
    return null;
  }
}
