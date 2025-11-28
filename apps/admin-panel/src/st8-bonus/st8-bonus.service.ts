import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ProviderGameEntity } from '@zetik/shared-entities';
import { Repository } from 'typeorm';

@Injectable()
export class St8BonusService {
  private readonly backendUrl: string;
  private readonly logger = new Logger(St8BonusService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(ProviderGameEntity)
    private readonly providerGamesRepository: Repository<ProviderGameEntity>,
  ) {
    this.backendUrl =
      this.configService.get<string>('BACKEND_URL') ||
      process.env.BACKEND_URL ||
      'http://localhost:3000';
  }

  private async backendFetch<T>(
    path: string,
    method: 'GET' | 'POST',
    body?: any,
    adminId?: string,
  ): Promise<T> {
    const url = `${this.backendUrl}${path}`;
    const adminApiSecret = this.configService.get<string>('common.adminApiSecret');

    this.logger.log(`Backend URL: ${url}`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (adminApiSecret) {
      headers['x-simulator-secret'] = adminApiSecret;
    }

    if (adminId) {
      headers['x-admin-id'] = adminId;
    }

    this.logger.log(
      `Making request to backend: ${method} ${url} with admin secret: ${adminApiSecret ? 'present' : 'missing'}, adminId: ${adminId || 'missing'}`,
    );

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Backend request failed: ${text}`);
      throw new HttpException(text || 'Backend request failed', res.status);
    }

    const result = await res.json();

    if (result && typeof result === 'object' && result.status === 'error') {
      const errorMsg = result.error || result.message || 'ST8 API returned error status';
      this.logger.error(`ST8 API error: ${errorMsg}`);
      throw new HttpException(`ST8 API error: ${errorMsg}`, 400);
    }

    return result as T;
  }

  async getGames() {
    return await this.providerGamesRepository.find({
      where: {
        enabled: true,
      },
    });
  }

  async getOffers(params: {
    game_codes?: string[];
    currency?: string;
    type?: string;
    site?: string;
  }) {
    const query = new URLSearchParams();
    if (params.game_codes?.length) {
      const validCodes = params.game_codes.filter((code) => /^[a-zA-Z0-9_-]+$/.test(code));
      if (validCodes.length !== params.game_codes.length) {
        const invalidCodes = params.game_codes.filter((code) => !/^[a-zA-Z0-9_-]+$/.test(code));
        this.logger.warn(`Invalid game codes detected and filtered: ${invalidCodes.join(', ')}`);
      }
      if (validCodes.length > 0) {
        query.set('game_codes', validCodes.join(','));
      }
    }
    if (params.currency) query.set('currency', params.currency);
    if (params.type) query.set('type', params.type);

    const path = `/v1/provider-games/st8/bonus/offers${query.toString() ? `?${query.toString()}` : ''}`;
    return await this.backendFetch(path, 'GET');
  }

  async createBonus(body: Record<string, unknown>, adminId?: string) {
    return await this.backendFetch(`/v1/provider-games/st8/bonus`, 'POST', body, adminId);
  }

  async fetchBonus(bonusId: string, site?: string) {
    const query = new URLSearchParams();
    if (site) query.set('site', site);
    const path = `/v1/provider-games/st8/bonus/${bonusId}${query.toString() ? `?${query.toString()}` : ''}`;
    return await this.backendFetch(path, 'GET');
  }

  async cancelBonus(body: { bonus_id: string; site?: string; players?: string[] }) {
    return await this.backendFetch(
      `/v1/provider-games/st8/bonus/${body.bonus_id}/cancel`,
      'POST',
      body,
    );
  }

  async getLocalBonuses(filters: {
    gameCode?: string;
    type?: string;
    currency?: string;
    status?: string;
    createdByAdminId?: string;
    limit?: number;
    offset?: number;
  }) {
    const query = new URLSearchParams();
    if (filters.gameCode) query.set('gameCode', filters.gameCode);
    if (filters.type) query.set('type', filters.type);
    if (filters.currency) query.set('currency', filters.currency);
    if (filters.status) query.set('status', filters.status);
    if (filters.createdByAdminId) query.set('createdByAdminId', filters.createdByAdminId);
    if (filters.limit) query.set('limit', filters.limit.toString());
    if (filters.offset) query.set('offset', filters.offset.toString());

    const path = `/v1/provider-games/st8/bonus/local${query.toString() ? `?${query.toString()}` : ''}`;
    return await this.backendFetch(path, 'GET');
  }
}
