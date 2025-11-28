import { verifyGoogleIdToken } from './google-id-token.util';

// Mock the OAuth2Client
const mockVerifyIdToken = jest.fn();

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

describe('Google ID Token Utils', () => {
  const clientId = 'test-client-id.apps.googleusercontent.com';
  const validIdToken = 'valid.id.token';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyGoogleIdToken', () => {
    it('should verify valid Google ID token', async () => {
      const mockPayload = {
        sub: '123456789',
        email: 'test@gmail.com',
        email_verified: true,
        name: 'Test User',
        picture: 'https://example.com/photo.jpg',
        given_name: 'Test',
        family_name: 'User',
        locale: 'en',
        aud: clientId,
        iss: 'accounts.google.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const mockTicket = {
        getPayload: () => mockPayload,
      };

      mockVerifyIdToken.mockResolvedValue(mockTicket);

      const result = await verifyGoogleIdToken(validIdToken, clientId);

      expect(result).toEqual({
        sub: '123456789',
        email: 'test@gmail.com',
        email_verified: true,
        name: 'Test User',
        picture: 'https://example.com/photo.jpg',
        given_name: 'Test',
        family_name: 'User',
        locale: 'en',
        aud: clientId,
        iss: 'accounts.google.com',
        exp: mockPayload.exp,
        iat: mockPayload.iat,
      });
    });

    it('should return null for invalid token', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

      const result = await verifyGoogleIdToken('invalid.token', clientId);

      expect(result).toBeNull();
    });

    it('should return null for token with invalid issuer', async () => {
      const mockPayload = {
        sub: '123456789',
        email: 'test@gmail.com',
        email_verified: true,
        name: 'Test User',
        aud: clientId,
        iss: 'invalid.issuer.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const mockTicket = {
        getPayload: () => mockPayload,
      };

      mockVerifyIdToken.mockResolvedValue(mockTicket);

      const result = await verifyGoogleIdToken(validIdToken, clientId);

      expect(result).toBeNull();
    });

    it('should return null for token with wrong audience', async () => {
      const mockPayload = {
        sub: '123456789',
        email: 'test@gmail.com',
        email_verified: true,
        name: 'Test User',
        aud: 'wrong-client-id',
        iss: 'accounts.google.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const mockTicket = {
        getPayload: () => mockPayload,
      };

      mockVerifyIdToken.mockResolvedValue(mockTicket);

      const result = await verifyGoogleIdToken(validIdToken, clientId);

      expect(result).toBeNull();
    });

    it('should return null for unverified email', async () => {
      const mockPayload = {
        sub: '123456789',
        email: 'test@gmail.com',
        email_verified: false,
        name: 'Test User',
        aud: clientId,
        iss: 'accounts.google.com',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };

      const mockTicket = {
        getPayload: () => mockPayload,
      };

      mockVerifyIdToken.mockResolvedValue(mockTicket);

      const result = await verifyGoogleIdToken(validIdToken, clientId);

      expect(result).toBeNull();
    });

    it('should return null when no payload returned', async () => {
      const mockTicket = {
        getPayload: () => null,
      };

      mockVerifyIdToken.mockResolvedValue(mockTicket);

      const result = await verifyGoogleIdToken(validIdToken, clientId);

      expect(result).toBeNull();
    });
  });
});
