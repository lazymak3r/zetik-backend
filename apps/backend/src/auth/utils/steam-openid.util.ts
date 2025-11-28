export interface ISteamOpenIdData {
  openidAssocHandle: string;
  openidSigned: string;
  openidSig: string;
  openidNs: string;
  openidMode: string;
  openidOpEndpoint: string;
  openidClaimedId: string;
  openidIdentity: string;
  openidReturnTo: string;
  openidResponseNonce: string;
}

export interface ISteamUserData {
  steamId: string;
  personaName: string;
  profileUrl: string;
  avatarUrl?: string;
  realName?: string;
  countryCode?: string;
}

interface ISteamApiResponse {
  response: {
    players: Array<{
      steamid: string;
      personaname: string;
      profileurl: string;
      avatar?: string;
      avatarmedium?: string;
      avatarfull?: string;
      realname?: string;
      loccountrycode?: string;
    }>;
  };
}

/**
 * Verifies Steam OpenID token
 * @param params - OpenID parameters from Steam
 * @returns true if verification is successful, false otherwise
 */
export async function verifySteamOpenId(data: ISteamOpenIdData): Promise<boolean> {
  try {
    const params = new URLSearchParams({
      'openid.assoc_handle': data.openidAssocHandle,
      'openid.signed': data.openidSigned,
      'openid.sig': data.openidSig,
      'openid.ns': data.openidNs,
      'openid.mode': 'check_authentication',
      'openid.op_endpoint': data.openidOpEndpoint,
      'openid.claimed_id': data.openidClaimedId,
      'openid.identity': data.openidIdentity,
      'openid.return_to': data.openidReturnTo,
      'openid.response_nonce': data.openidResponseNonce,
    });

    const response = await fetch('https://steamcommunity.com/openid/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      return false;
    }

    const responseText = await response.text();
    return responseText.includes('is_valid:true');
  } catch (error) {
    console.error('Steam OpenID verification failed:', error);
    return false;
  }
}

/**
 * Extracts Steam ID from Claimed ID
 * @param claimedId - The claimed ID from Steam OpenID
 * @returns Steam ID string or null if not found
 */
export function extractSteamId(claimedId: string): string | null {
  const match = claimedId.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/);
  return match ? match[1] : null;
}

/**
 * Gets Steam user data via Web API
 * @param steamId - Steam user ID
 * @param apiKey - Steam Web API key
 * @returns Steam user data or null if not found
 */
export async function getSteamUserData(
  steamId: string,
  apiKey: string,
): Promise<ISteamUserData | null> {
  try {
    const response = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`,
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as ISteamApiResponse;
    const players = data.response?.players;

    if (!players || players.length === 0) {
      return null;
    }

    const player = players[0];
    return {
      steamId: player.steamid,
      personaName: player.personaname,
      profileUrl: player.profileurl,
      avatarUrl: player.avatarfull || player.avatarmedium || player.avatar,
      realName: player.realname,
      countryCode: player.loccountrycode,
    };
  } catch (error) {
    console.error('Failed to get Steam user data:', error);
    return null;
  }
}
