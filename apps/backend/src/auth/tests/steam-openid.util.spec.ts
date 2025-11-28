import { extractSteamId, getSteamUserData, verifySteamOpenId } from '../utils/steam-openid.util';

// Mock global fetch
global.fetch = jest.fn();

describe('Steam OpenID Utilities', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('extractSteamId', () => {
    it('should extract Steam ID from valid claimed ID', () => {
      const claimedId = 'https://steamcommunity.com/openid/id/76561198123456789';
      const result = extractSteamId(claimedId);
      expect(result).toBe('76561198123456789');
    });

    it('should extract Steam ID from HTTP claimed ID', () => {
      const claimedId = 'http://steamcommunity.com/openid/id/76561198987654321';
      const result = extractSteamId(claimedId);
      expect(result).toBe('76561198987654321');
    });

    it('should return null for invalid claimed ID format', () => {
      const invalidClaimedIds = [
        'https://steamcommunity.com/openid/id/',
        'https://example.com/openid/id/76561198123456789',
        'https://steamcommunity.com/id/76561198123456789',
        'invalid-url',
        '',
      ];

      invalidClaimedIds.forEach((claimedId) => {
        const result = extractSteamId(claimedId);
        expect(result).toBeNull();
      });
    });

    it('should return null for claimed ID with non-numeric Steam ID', () => {
      const claimedId = 'https://steamcommunity.com/openid/id/not-a-number';
      const result = extractSteamId(claimedId);
      expect(result).toBeNull();
    });
  });

  describe('verifySteamOpenId', () => {
    const mockOpenIdData = {
      openidAssocHandle: '{HMAC-SHA256}{12345678}{abcdef}',
      openidSigned:
        'openid.mode,openid.op_endpoint,openid.response_nonce,openid.return_to,openid.assoc_handle,openid.signed,openid.identity,openid.claimed_id',
      openidSig: 'mockSignature123',
      openidNs: 'http://specs.openid.net/auth/2.0',
      openidMode: 'id_res',
      openidOpEndpoint: 'https://steamcommunity.com/openid/login',
      openidClaimedId: 'https://steamcommunity.com/openid/id/76561198123456789',
      openidIdentity: 'https://steamcommunity.com/openid/id/76561198123456789',
      openidReturnTo: 'http://localhost:3000/auth/steam/callback',
      openidResponseNonce: '2024-01-01T12:00:00ZmockNonce',
    };

    it('should return true for valid Steam OpenID verification', async () => {
      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue('is_valid:true\n'),
      };

      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await verifySteamOpenId(mockOpenIdData);

      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'https://steamcommunity.com/openid/login',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: expect.stringContaining('openid.mode=check_authentication'),
        }),
      );
    });

    it('should return false for invalid Steam OpenID verification', async () => {
      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue('is_valid:false\n'),
      };

      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await verifySteamOpenId(mockOpenIdData);

      expect(result).toBe(false);
    });

    it('should return false when Steam server responds with error', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
      };

      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await verifySteamOpenId(mockOpenIdData);

      expect(result).toBe(false);
    });

    it('should return false when network request fails', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await verifySteamOpenId(mockOpenIdData);

      expect(result).toBe(false);
    });

    it('should send correct verification parameters to Steam', async () => {
      const mockResponse = {
        ok: true,
        text: jest.fn().mockResolvedValue('is_valid:true\n'),
      };

      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      await verifySteamOpenId(mockOpenIdData);

      const [url, options] = (fetch as jest.Mock).mock.calls[0];
      const body = options.body;

      expect(url).toBe('https://steamcommunity.com/openid/login');
      expect(body).toContain('openid.mode=check_authentication');
      expect(body).toContain(
        `openid.assoc_handle=${encodeURIComponent(mockOpenIdData.openidAssocHandle)}`,
      );
      expect(body).toContain(`openid.signed=${encodeURIComponent(mockOpenIdData.openidSigned)}`);
      expect(body).toContain(`openid.sig=${encodeURIComponent(mockOpenIdData.openidSig)}`);
    });
  });

  describe('getSteamUserData', () => {
    const steamId = '76561198123456789';
    const apiKey = 'test-api-key';

    const mockSteamApiResponse = {
      response: {
        players: [
          {
            steamid: '76561198123456789',
            personaname: 'TestUser',
            profileurl: 'https://steamcommunity.com/profiles/76561198123456789/',
            avatar:
              'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/ab/small.jpg',
            avatarmedium:
              'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/ab/medium.jpg',
            avatarfull:
              'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/ab/full.jpg',
            realname: 'Test User Real Name',
            loccountrycode: 'US',
          },
        ],
      },
    };

    it('should return user data for valid Steam ID', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(mockSteamApiResponse),
      };

      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getSteamUserData(steamId, apiKey);

      expect(result).toEqual({
        steamId: '76561198123456789',
        personaName: 'TestUser',
        profileUrl: 'https://steamcommunity.com/profiles/76561198123456789/',
        avatarUrl:
          'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/ab/full.jpg',
        realName: 'Test User Real Name',
        countryCode: 'US',
      });

      expect(fetch).toHaveBeenCalledWith(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`,
      );
    });

    it('should prefer full avatar over medium and small', async () => {
      const responseWithoutFull = {
        response: {
          players: [
            {
              steamid: '76561198123456789',
              personaname: 'TestUser',
              profileurl: 'https://steamcommunity.com/profiles/76561198123456789/',
              avatar:
                'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/ab/small.jpg',
              avatarmedium:
                'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/ab/medium.jpg',
            },
          ],
        },
      };

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(responseWithoutFull),
      };

      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getSteamUserData(steamId, apiKey);

      expect(result?.avatarUrl).toBe(
        'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/ab/medium.jpg',
      );
    });

    it('should return null when Steam API returns empty players array', async () => {
      const emptyResponse = {
        response: {
          players: [],
        },
      };

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(emptyResponse),
      };

      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getSteamUserData(steamId, apiKey);

      expect(result).toBeNull();
    });

    it('should return null when Steam API returns no response', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      };

      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getSteamUserData(steamId, apiKey);

      expect(result).toBeNull();
    });

    it('should return null when Steam API request fails', async () => {
      const mockResponse = {
        ok: false,
        status: 403,
      };

      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getSteamUserData(steamId, apiKey);

      expect(result).toBeNull();
    });

    it('should return null when network request fails', async () => {
      (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await getSteamUserData(steamId, apiKey);

      expect(result).toBeNull();
    });

    it('should handle optional fields correctly', async () => {
      const minimalResponse = {
        response: {
          players: [
            {
              steamid: '76561198123456789',
              personaname: 'MinimalUser',
              profileurl: 'https://steamcommunity.com/profiles/76561198123456789/',
            },
          ],
        },
      };

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue(minimalResponse),
      };

      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getSteamUserData(steamId, apiKey);

      expect(result).toEqual({
        steamId: '76561198123456789',
        personaName: 'MinimalUser',
        profileUrl: 'https://steamcommunity.com/profiles/76561198123456789/',
        avatarUrl: undefined,
        realName: undefined,
        countryCode: undefined,
      });
    });

    it('should handle malformed JSON response', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      };

      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await getSteamUserData(steamId, apiKey);

      expect(result).toBeNull();
    });
  });
});
