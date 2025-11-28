import { CurrencyEnum } from '@zetik/common';
import { Test, TestingModule } from '@nestjs/testing';
import { St8BalanceDto } from './dto/st8-balance.dto';
import { St8BuyinDto } from './dto/st8-buyin.dto';
import { St8CancelBaseDto, St8CancelExtendedDto } from './dto/st8-cancel.dto';
import { St8PayoutDto } from './dto/st8-payout.dto';
import { St8PlayerProfileDto } from './dto/st8-player-profile.dto';
import { St8TransactionDto } from './dto/st8-transaction.dto';
import { St8ProviderTransactionEnum, St8ResponseStatusEnum } from './enums/st8.enum';
import {
  ISt8PlayerProfileResponse,
  ISt8SuccessBalanceResponse,
} from './interfaces/st8-response.interface';
import { St8Controller } from './st8.controller';
import { St8Service } from './st8.service';

describe('St8Controller', () => {
  let controller: St8Controller;
  let service: St8Service;

  // Mock responses
  const mockPlayerProfileResponse: ISt8PlayerProfileResponse = {
    status: St8ResponseStatusEnum.OK,
    id: 'test-user-id',
    jurisdiction: 'test-jurisdiction',
    default_currency: 'USD',
    reg_country: 'US',
    affiliate: null,
    bet_limits: 'test-limits',
    birth_date: '1990-01-01',
    reg_date: '2023-01-01',
    attributes: {
      labels: ['test-label'],
    },
  };

  const mockBalanceResponse: ISt8SuccessBalanceResponse = {
    status: St8ResponseStatusEnum.OK,
    balance: '1000.00',
    currency: 'USD',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [St8Controller],
      providers: [
        {
          provide: St8Service,
          useValue: {
            getUserProfile: jest.fn(),
            getBalance: jest.fn(),
            debit: jest.fn(),
            credit: jest.fn(),
            cancel: jest.fn(),
            buyin: jest.fn(),
            payout: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<St8Controller>(St8Controller);
    service = module.get<St8Service>(St8Service);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('playerProfile', () => {
    it('should return player profile', async () => {
      const dto: St8PlayerProfileDto = {
        player: 'test-player',
        site: 'test-site',
      };
      jest.spyOn(service, 'getUserProfile').mockResolvedValue(mockPlayerProfileResponse);

      const result = await controller.playerProfile(dto);
      expect(result).toEqual(mockPlayerProfileResponse);
      expect(service.getUserProfile).toHaveBeenCalledWith(dto);
    });
  });

  describe('balance', () => {
    it('should return balance', async () => {
      const dto: St8BalanceDto = {
        player: 'test-player',
        currency: CurrencyEnum.USD,
        site: 'test-site',
        token: 'eae28161-e400-4398-b718-0b6373a4a522',
      };
      jest.spyOn(service, 'getBalance').mockResolvedValue(mockBalanceResponse);

      const result = await controller.balance(dto);
      expect(result).toEqual(mockBalanceResponse);
      expect(service.getBalance).toHaveBeenCalledWith(dto);
    });
  });

  describe('debit', () => {
    it('should process debit transaction', async () => {
      const dto: St8TransactionDto = {
        player: 'test-player',
        site: 'test-site',
        token: 'eae28161-e400-4398-b718-0b6373a4a522',
        transaction_id: 'test-transaction-id',
        round: 'test-round',
        round_closed: true,
        game_code: 'test-game-code',
        developer_code: 'test-developer-code',
        amount: '100.00',
        currency: CurrencyEnum.USD,
        provider_kind: St8ProviderTransactionEnum.DEBIT,
        provider: {
          transaction_id: 'test-provider-transaction-id',
          amount: '100.00',
          currency: CurrencyEnum.USD,
          player: 'test-player',
        },
        bonus: null,
      };
      jest.spyOn(service, 'debit').mockResolvedValue(mockBalanceResponse);

      const result = await controller.debit(dto);
      expect(result).toEqual(mockBalanceResponse);
      expect(service.debit).toHaveBeenCalledWith(dto);
    });
  });

  describe('credit', () => {
    it('should process credit transaction', async () => {
      const dto: St8TransactionDto = {
        player: 'test-player',
        site: 'test-site',
        token: 'eae28161-e400-4398-b718-0b6373a4a522',
        transaction_id: 'test-transaction-id',
        round: 'test-round',
        round_closed: true,
        game_code: 'test-game-code',
        developer_code: 'test-developer-code',
        amount: '100.00',
        currency: CurrencyEnum.USD,
        provider_kind: St8ProviderTransactionEnum.CREDIT,
        provider: {
          transaction_id: 'test-provider-transaction-id',
          amount: '100.00',
          currency: CurrencyEnum.USD,
          player: 'test-player',
        },
        bonus: null,
      };
      jest.spyOn(service, 'credit').mockResolvedValue(mockBalanceResponse);

      const result = await controller.credit(dto);
      expect(result).toEqual(mockBalanceResponse);
      expect(service.credit).toHaveBeenCalledWith(dto);
    });
  });

  describe('cancel', () => {
    it('should process cancel with base DTO', async () => {
      const dto: St8CancelBaseDto = {
        player: 'test-player',
        cancel_id: 'test-cancel-id',
        transaction_id: 'test-transaction-id',
        site: 'test-site',
        developer_code: 'test-developer-code',
        amount: '100.00',
        currency: CurrencyEnum.USD,
      };
      jest.spyOn(service, 'cancel').mockResolvedValue(mockBalanceResponse);

      const result = await controller.cancel(dto);
      expect(result).toEqual(mockBalanceResponse);
      expect(service.cancel).toHaveBeenCalledWith(dto);
    });

    it('should process cancel with extended DTO', async () => {
      // Arrange
      const dto: St8CancelExtendedDto = {
        player: 'test-player',
        cancel_id: 'test-cancel-id',
        transaction_id: 'test-transaction-id',
        site: 'test-site',
        developer_code: 'test-developer-code',
        amount: '100.00',
        currency: CurrencyEnum.USD,
        round: 'test-round',
        token: 'eae28161-e400-4398-b718-0b6373a4a522',
        game_code: 'test-game-code',
      };
      jest.spyOn(service, 'cancel').mockResolvedValue(mockBalanceResponse);

      // Act
      const result = await controller.cancel(dto);

      // Assert
      expect(result).toEqual(mockBalanceResponse);
      expect(service.cancel).toHaveBeenCalledWith(dto);
    });
  });

  describe('buyin', () => {
    it('should process buyin transaction', async () => {
      // Arrange
      const dto: St8BuyinDto = {
        player: 'test-player',
        site: 'test-site',
        transaction_id: 'test-transaction-id',
        amount: '100.00',
        currency: CurrencyEnum.USD,
        game_code: 'test-game-code',
        developer_code: 'test-developer-code',
        provider_kind: St8ProviderTransactionEnum.DEBIT,
        provider: {
          transaction_id: 'test-provider-transaction-id',
          amount: '100.00',
          currency: CurrencyEnum.USD,
          player: 'test-player',
        },
      };
      jest.spyOn(service, 'buyin').mockResolvedValue(mockBalanceResponse);

      // Act
      const result = await controller.buyin(dto);

      // Assert
      expect(result).toEqual(mockBalanceResponse);
      expect(service.buyin).toHaveBeenCalledWith(dto);
    });
  });

  describe('payout', () => {
    it('should process payout transaction', async () => {
      // Arrange
      const dto: St8PayoutDto = {
        player: 'test-player',
        site: 'test-site',
        transaction_id: 'test-transaction-id',
        amount: '100.00',
        currency: CurrencyEnum.USD,
        game_code: 'test-game-code',
        developer_code: 'test-developer-code',
        provider_kind: St8ProviderTransactionEnum.CREDIT,
        provider: {
          transaction_id: 'test-provider-transaction-id',
          amount: '100.00',
          currency: CurrencyEnum.USD,
          player: 'test-player',
        },
        bonus: null,
      };
      jest.spyOn(service, 'payout').mockResolvedValue(mockBalanceResponse);

      // Act
      const result = await controller.payout(dto);

      // Assert
      expect(result).toEqual(mockBalanceResponse);
      expect(service.payout).toHaveBeenCalledWith(dto);
    });
  });
});
