import { Injectable, Logger } from '@nestjs/common';
import { sportsbookConfig } from '../config/sportsbook.config';

@Injectable()
export class BetbyExternalApiService {
  private readonly logger = new Logger(BetbyExternalApiService.name);
  private readonly cfg = sportsbookConfig().betby;
  private readonly brandId = this.cfg.brandId;
  private readonly apiBase = this.cfg.externalApiUrl.replace(/\/+$/, '');

  private async postJson<T = any>(path: string, payload: unknown): Promise<T> {
    const url = `${this.apiBase}/${path.replace(/^\/+/, '')}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BRAND-ID': this.brandId,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      this.logger.warn(`Betby External API error ${resp.status}: ${text}`);
      throw new Error(`Betby External API request failed: ${resp.status}`);
    }

    return (await resp.json()) as T;
  }

  async ping(): Promise<{ status: string }> {
    const url = `${this.apiBase}/ping`;
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`Betby External API ping failed: ${resp.status}`);
    }
    return (await resp.json()) as { status: string };
  }

  // Placeholders for future use
  async playerDetails(payload: any) {
    return this.postJson('player_details', { payload });
  }

  async playerSegment(payload: any) {
    return this.postJson('player/segment', payload);
  }

  async templates(payload: any) {
    return this.postJson('bonus/templates', { payload });
  }

  async template(payload: any) {
    return this.postJson('bonus/template', { payload });
  }

  async playerBonuses(payload: any) {
    return this.postJson('bonus/player_bonuses', { payload });
  }

  async bonus(payload: any) {
    return this.postJson('bonus', { payload });
  }

  async massGiveBonus(payload: any) {
    return this.postJson('bonus/mass_give_bonus', { payload });
  }

  async revokeBonus(payload: any) {
    return this.postJson('bonus/revoke_bonus', { payload });
  }
}
