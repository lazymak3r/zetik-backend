import { Injectable, Logger } from '@nestjs/common';
import { SignatureUtils } from '@zetik/common';
import { providerGamesConfig } from '../config/provider-games.config';
import {
  ISt8BonusResponse,
  ISt8CreateBonusParams,
  ISt8GamesResponse,
  ISt8GetOffersParams,
  ISt8LaunchGameInput,
  ISt8LaunchGameResponse,
} from './interfaces/st8-types.interface';

@Injectable()
export class St8ApiClient {
  private readonly logger = new Logger(St8ApiClient.name);
  private readonly config = providerGamesConfig();

  private selectConfig(currency?: string) {
    if (!currency) return this.config.st8;
    return this.config.st8.supportedCurrencies.includes(currency as any)
      ? this.config.st8
      : this.config.st8Asian;
  }

  private async fetch<T>(
    currency: string | undefined,
    path: string,
    method: 'GET' | 'POST',
    payload: string,
  ): Promise<T> {
    const config = this.selectConfig(currency);
    const privateKey = Buffer.from(config.localPrivateKey, 'base64').toString();
    const url = `${config.apiUrl}${path}${method === 'GET' && payload ? `?${payload}` : ''}`;
    const signature = SignatureUtils.createSignature(privateKey, payload);

    this.logger.debug(`ST8 API request: ${method} ${url}`);
    this.logger.debug(`ST8 API payload for signature: ${payload}`);

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        [this.config.signatureHeader]: signature,
      },
      body: method === 'POST' ? payload : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      this.logger.error(`ST8 request failed: ${response.status} ${errorText}`);
      throw new Error(`ST8 request failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    if (result && typeof result === 'object' && result.status === 'error') {
      const errorMsg = result.error || result.message || 'ST8 API returned error status';
      this.logger.error(`ST8 API error: ${errorMsg}`);
      throw new Error(`ST8 API error: ${errorMsg}`);
    }

    return result as T;
  }

  async launchGame(
    payload: ISt8LaunchGameInput,
    currency?: string,
  ): Promise<ISt8LaunchGameResponse> {
    const payloadString = JSON.stringify(payload);

    this.logger.debug(`Launching game ${payload.game_code} for player ${payload.player}`);

    return this.fetch<ISt8LaunchGameResponse>(
      currency,
      '/api/operator/v1/launch',
      'POST',
      payloadString,
    );
  }

  async getGames(currency?: string): Promise<ISt8GamesResponse> {
    const config = this.selectConfig(currency);
    const queryString = `site=${config.operatorSiteCode}`;

    this.logger.debug(`Fetching games from ST8 API`);

    return this.fetch<ISt8GamesResponse>(currency, '/api/operator/v1/games', 'GET', queryString);
  }

  async getOffers(params: ISt8GetOffersParams, currency?: string): Promise<any> {
    const config = this.selectConfig(currency);
    const queryParts: string[] = [];

    const site = params.site || config.operatorSiteCode;
    if (!site) {
      this.logger.error(
        `ST8 operatorSiteCode is not configured for currency: ${currency || 'default'}`,
      );
      throw new Error('ST8 operator site code is not configured');
    }

    queryParts.push(`site=${encodeURIComponent(site)}`);
    if (params.game_codes?.length) {
      queryParts.push(`game_codes=${encodeURIComponent(params.game_codes.join(','))}`);
    }
    if (params.currency) {
      queryParts.push(`currency=${encodeURIComponent(params.currency)}`);
    }
    if (params.type) {
      queryParts.push(`type=${encodeURIComponent(params.type)}`);
    }

    const queryString = queryParts.join('&');
    this.logger.debug(`ST8 getOffers query: ${queryString}`);
    this.logger.debug(
      `ST8 getOffers site: ${site}, operatorCode: ${config.operatorCode}, operatorSiteCode: ${config.operatorSiteCode}`,
    );

    return this.fetch<any>(currency, '/api/operator/v1/bonus/offers', 'GET', queryString);
  }

  async createBonus(body: ISt8CreateBonusParams, currency?: string): Promise<ISt8BonusResponse> {
    const payload = JSON.stringify(body);

    this.logger.debug(`Creating bonus ${body.bonus_id}`);

    return this.fetch<ISt8BonusResponse>(
      currency,
      '/api/operator/v1/bonus/create',
      'POST',
      payload,
    );
  }

  async getBonus(bonusId: string, site?: string, currency?: string): Promise<ISt8BonusResponse> {
    const query = new URLSearchParams();
    query.set('bonus_id', bonusId);
    if (site) query.set('site', site);

    const queryString = query.toString();

    this.logger.debug(`Fetching bonus ${bonusId}`);

    return this.fetch<ISt8BonusResponse>(
      currency,
      '/api/operator/v1/bonus/get',
      'GET',
      queryString,
    );
  }

  async cancelBonus(
    body: { bonus_id: string; site?: string; players?: string[] },
    currency?: string,
  ): Promise<ISt8BonusResponse> {
    const payload = JSON.stringify(body);

    this.logger.debug(`Canceling bonus ${body.bonus_id}`);

    return this.fetch<ISt8BonusResponse>(
      currency,
      '/api/operator/v1/bonus/cancel',
      'POST',
      payload,
    );
  }
}
