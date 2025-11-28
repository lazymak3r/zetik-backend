import { UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';

/**
 * Exchange Google authorization code for tokens (access_token, id_token)
 * @param code - Authorization code from Google OAuth flow
 * @param clientId - Google OAuth Client ID
 * @param clientSecret - Google OAuth Client Secret
 * @param redirectUri - Redirect URI (must match Google Console configuration)
 * @returns ID token payload with user data
 */
export async function exchangeGoogleCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri?: string,
) {
  try {
    const client = new OAuth2Client(clientId, clientSecret, redirectUri);

    // Exchange authorization code for tokens
    const { tokens } = await client.getToken(code);

    if (!tokens.id_token) {
      throw new UnauthorizedException('No ID token received from Google');
    }

    // Verify and decode ID token
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: clientId,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new UnauthorizedException('Invalid ID token payload');
    }

    return payload;
  } catch (error) {
    if (error instanceof Error) {
      throw new UnauthorizedException(`Google OAuth error: ${error.message}`);
    }
    throw new UnauthorizedException('Failed to exchange Google authorization code');
  }
}
