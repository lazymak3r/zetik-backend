import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CurrencyEnum } from '@zetik/common';
import { ProviderGameSessionEntity, ProviderGameStatusEnum } from '@zetik/shared-entities';
import BigNumber from 'bignumber.js';
import { Repository } from 'typeorm';

@Injectable()
export class GameSessionService {
  constructor(
    @InjectRepository(ProviderGameSessionEntity)
    private readonly gameSessionRepository: Repository<ProviderGameSessionEntity>,
  ) {}

  async createGameSession(
    userId: number | string,
    currency: CurrencyEnum,
    gameCode: string,
  ): Promise<ProviderGameSessionEntity> {
    const newGameSession = this.gameSessionRepository.create({
      userId: String(userId),
      currency,
      gameCode,
    });

    return this.gameSessionRepository.save(newGameSession);
  }

  async updateStatusToStarted(id: string): Promise<void> {
    await this.gameSessionRepository.update({ id }, { status: ProviderGameStatusEnum.STARTED });
  }

  async incrementBetAmount(id: string, amount: string): Promise<void> {
    const amountBN = new BigNumber(amount).toString();
    await this.gameSessionRepository
      .createQueryBuilder()
      .update()
      .set({
        betAmount: () => `"betAmount" + ${amountBN}`,
      })
      .where('id = :id', { id })
      .execute();
  }

  async incrementWinAmount(id: string, amount: string): Promise<void> {
    const amountBN = new BigNumber(amount).toString();
    await this.gameSessionRepository
      .createQueryBuilder()
      .update()
      .set({
        winAmount: () => `"winAmount" + ${amountBN}`,
      })
      .where('id = :id', { id })
      .execute();
  }

  async findByGameSession(id: string): Promise<ProviderGameSessionEntity | null> {
    return await this.gameSessionRepository.findOne({ where: { id } });
  }
}
