import { CurrencyEnum } from '@zetik/common';
import {
  BalanceOperationEnum,
  BalanceOperationResultEnum,
  SportsbookBetEntity,
  SportsbookBetStatus,
  SportsbookBetType,
  UserEntity,
} from '@zetik/shared-entities';
import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BalanceService } from '../balance/balance.service';
import { UsersService } from '../users/users.service';
import { BetbyJwtService } from './betby-jwt.service';
import { BetbyService } from './betby.service';
import { BetDiscardRequestDto } from './dto/bet-discard.dto';
import { BetLostRequestDto } from './dto/bet-lost-request.dto';
import { BetRefundRequestDto, RefundReasonCode } from './dto/bet-refund-request.dto';
import { BetRollbackRequestDto } from './dto/bet-rollabck-request.dto';
import { BetSettlementRequestDto } from './dto/bet-settelment-request.dto';
import { BetWinRequestDto } from './dto/bet-win-request.dto';
import { BetbyTokenGenerateRequestDto } from './dto/betby-token-generate.dto';
import { MakeBetRequestDto } from './dto/make-bet-request.dto';
import { PlayerSegmentRequestDto } from './dto/player-segment-request.dto';

describe('BetbyService', () => {
  let service: BetbyService;

  // Mock data
  const mockUser: UserEntity = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    isBanned: false,
  } as UserEntity;

  const mockBet: SportsbookBetEntity = {
    id: 'bet-123',
    userId: 'user-123',
    extTransactionId: 'ext-tx-123',
    betslipId: 'betslip-123',
    betAmount: '100',
    currency: CurrencyEnum.USD,
    totalOdds: '2.5',
    betType: SportsbookBetType.SINGLE,
    status: SportsbookBetStatus.ACTIVE,
    selections: [
      {
        id: 'selection-1',
        eventId: 'event-1',
        sportId: 'sport-1',
        tournamentId: 'tournament-1',
        categoryId: 'category-1',
        live: false,
        sportName: 'Football',
        categoryName: 'Premier League',
        tournamentName: 'EPL',
        competitorName: ['Team A', 'Team B'],
        marketName: 'Match Winner',
        outcomeName: 'Team A',
        scheduled: 1640995200,
        odds: '2.5',
        status: 'open',
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as SportsbookBetEntity;

  const mockBalanceResult = {
    status: BalanceOperationResultEnum.SUCCESS,
    balance: 900, // 1000 (initial balance) - 100 (bet amount)
    success: true,
  };

  const mockRefundBalanceResult = {
    status: BalanceOperationResultEnum.SUCCESS,
    balance: 1000, // 900 (current balance) + 100 (refund amount)
    success: true,
  };

  const mockWinBalanceResult = {
    status: BalanceOperationResultEnum.SUCCESS,
    balance: 1150, // 900 (current balance) + 250 (win amount)
    success: true,
  };

  const mockRollbackWinBalanceResult = {
    status: BalanceOperationResultEnum.SUCCESS,
    balance: 900, // 1150 (balance after win) - 250 (win cancellation)
    success: true,
  };

  const mockRollbackCancelBalanceResult = {
    status: BalanceOperationResultEnum.SUCCESS,
    balance: 1000, // 900 (current balance) + 100 (cancelled bet refund)
    success: true,
  };

  const mockMakeBetRequest: MakeBetRequestDto = {
    amount: 100,
    currency: 'USD',
    player_id: 'user-123',
    session_id: 'session-123',
    transaction: {
      id: 'ext-tx-123',
      betslip_id: 'betslip-123',
      player_id: 'user-123',
      operator_id: 'operator-1',
      operator_brand_id: 'brand-1',
      ext_player_id: 'user-123',
      timestamp: 1640995200,
      amount: 100,
      currency: 'USD',
      operation: 'bet',
    },
    betslip: {
      id: 'betslip-123',
      timestamp: 1640995200,
      player_id: 'user-123',
      operator_id: 'operator-1',
      operator_brand_id: 'brand-1',
      ext_player_id: 'user-123',
      currency: 'USD',
      type: 'single',
      sum: 100,
      k: '2.5',
      bets: [
        {
          id: 'selection-1',
          event_id: 'event-1',
          sport_id: 'sport-1',
          tournament_id: 'tournament-1',
          category_id: 'category-1',
          live: false,
          sport_name: 'Football',
          category_name: 'Premier League',
          tournament_name: 'EPL',
          competitor_name: ['Team A', 'Team B'],
          market_name: 'Match Winner',
          outcome_name: 'Team A',
          scheduled: 1640995200,
          odds: '2.5',
        },
      ],
    },
    potential_win: 250,
  };

  // Mock repositories and services
  const mockSportsbookBetRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockUsersService = {
    findById: jest.fn(),
    createWithEmail: jest.fn(),
  };

  const mockBalanceService = {
    getFiatBalance: jest.fn(),
    updateFiatBalance: jest.fn(),
  };

  const mockBetbyJwtService = {
    generateToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BetbyService,
        {
          provide: getRepositoryToken(SportsbookBetEntity),
          useValue: mockSportsbookBetRepository,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: BalanceService,
          useValue: mockBalanceService,
        },
        {
          provide: BetbyJwtService,
          useValue: mockBetbyJwtService,
        },
      ],
    }).compile();

    service = module.get<BetbyService>(BetbyService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('makeBet', () => {
    it('should successfully create a bet', async () => {
      // Arrange
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockBalanceService.getFiatBalance.mockResolvedValue(1000);
      mockSportsbookBetRepository.findOne.mockResolvedValue(null);
      mockSportsbookBetRepository.create.mockReturnValue(mockBet);
      mockSportsbookBetRepository.save.mockResolvedValue(mockBet);
      mockBalanceService.updateFiatBalance.mockResolvedValue(mockBalanceResult);

      // Act
      const result = await service.makeBet(mockMakeBetRequest);

      // Assert
      expect(result).toEqual({
        id: mockBet.id,
        ext_transaction_id: mockMakeBetRequest.transaction.id,
        parent_transaction_id: null,
        user_id: mockMakeBetRequest.player_id,
        operation: 'bet',
        amount: mockMakeBetRequest.amount,
        currency: mockMakeBetRequest.currency,
        balance: 900, // 1000 (initial balance) - 100 (bet amount)
      });

      expect(mockUsersService.findById).toHaveBeenCalledWith(mockMakeBetRequest.player_id);
      expect(mockBalanceService.getFiatBalance).toHaveBeenCalledWith(mockMakeBetRequest.player_id);
      expect(mockSportsbookBetRepository.findOne).toHaveBeenCalledWith({
        where: { extTransactionId: mockMakeBetRequest.transaction.id },
      });
      expect(mockBalanceService.updateFiatBalance).toHaveBeenCalledWith({
        userId: mockMakeBetRequest.player_id,
        operation: BalanceOperationEnum.BET,
        operationId: expect.any(String),
        amount: mockMakeBetRequest.amount.toString(),
        currency: mockMakeBetRequest.currency as CurrencyEnum,
        description: `Betby bet for betslip ${mockMakeBetRequest.transaction.betslip_id}`,
        metadata: {
          betId: mockBet.id,
          amount: mockMakeBetRequest.amount,
        },
      });
    });

    it('should throw error if player not found', async () => {
      // Arrange
      mockUsersService.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(service.makeBet(mockMakeBetRequest)).rejects.toThrow(BadRequestException);
    });

    it('should throw error if player is banned', async () => {
      // Arrange
      const bannedUser = { ...mockUser, isBanned: true };
      mockUsersService.findById.mockResolvedValue(bannedUser);

      // Act & Assert
      await expect(service.makeBet(mockMakeBetRequest)).rejects.toThrow(BadRequestException);
    });

    it('should throw error if currency is invalid', async () => {
      // Arrange
      const invalidRequest = { ...mockMakeBetRequest, currency: 'INVALID' };
      mockUsersService.findById.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.makeBet(invalidRequest)).rejects.toThrow(BadRequestException);
    });

    it('should throw error if insufficient funds', async () => {
      // Arrange
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockBalanceService.getFiatBalance.mockResolvedValue(50); // Less than bet amount

      // Act & Assert
      await expect(service.makeBet(mockMakeBetRequest)).rejects.toThrow(BadRequestException);
    });

    it('should throw error if bet already exists', async () => {
      // Arrange
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockBalanceService.getFiatBalance.mockResolvedValue(1000);
      mockSportsbookBetRepository.findOne.mockResolvedValue(mockBet); // Bet already exists

      // Act & Assert
      await expect(service.makeBet(mockMakeBetRequest)).rejects.toThrow(BadRequestException);
    });

    it('should throw error if balance operation fails', async () => {
      // Arrange
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockBalanceService.getFiatBalance.mockResolvedValue(1000);
      mockSportsbookBetRepository.findOne.mockResolvedValue(null);
      mockSportsbookBetRepository.create.mockReturnValue(mockBet);
      mockSportsbookBetRepository.save.mockResolvedValue(mockBet);
      mockBalanceService.updateFiatBalance.mockResolvedValue({
        status: BalanceOperationResultEnum.INSUFFICIENT_BALANCE,
        balance: 0,
        success: false,
      });

      // Act & Assert
      await expect(service.makeBet(mockMakeBetRequest)).rejects.toThrow(BadRequestException);
    });
  });

  describe('commitBet', () => {
    it('should update bet status to ACTIVE', async () => {
      // Arrange
      const transactionId = 'bet-123';
      mockSportsbookBetRepository.findOne.mockResolvedValue(mockBet);
      mockSportsbookBetRepository.save.mockResolvedValue(mockBet);

      // Act
      await service.commitBet({ transaction_id: transactionId });

      // Assert
      expect(mockSportsbookBetRepository.findOne).toHaveBeenCalledWith({
        where: { id: transactionId },
      });
      expect(mockSportsbookBetRepository.save).toHaveBeenCalledWith({
        ...mockBet,
        status: SportsbookBetStatus.ACTIVE,
      });
    });
  });

  describe('settlement', () => {
    it('should update bet status', async () => {
      // Arrange
      const settlementRequest: BetSettlementRequestDto = {
        bet_transaction_id: 'bet-123',
        status: SportsbookBetStatus.WON,
      };
      mockSportsbookBetRepository.findOne.mockResolvedValue(mockBet);
      mockSportsbookBetRepository.save.mockResolvedValue(mockBet);

      // Act
      const result = await service.settlement(settlementRequest);

      // Assert
      expect(result).toEqual({});
      expect(mockSportsbookBetRepository.findOne).toHaveBeenCalledWith({
        where: { id: settlementRequest.bet_transaction_id },
      });
      expect(mockSportsbookBetRepository.save).toHaveBeenCalledWith({
        ...mockBet,
        status: SportsbookBetStatus.WON,
      });
    });

    it('should throw error if bet not found', async () => {
      // Arrange
      const settlementRequest: BetSettlementRequestDto = {
        bet_transaction_id: 'non-existent',
        status: SportsbookBetStatus.WON,
      };
      mockSportsbookBetRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.settlement(settlementRequest)).rejects.toThrow(BadRequestException);
    });
  });

  describe('refund', () => {
    it('should successfully refund a bet', async () => {
      // Arrange
      const refundRequest: BetRefundRequestDto = {
        bet_transaction_id: 'bet-123',
        reason: 'Event cancelled',
        reason_code: RefundReasonCode.CANCELLED_EVENT,
        transaction: {
          id: 'refund-tx-123',
          betslip_id: 'betslip-123',
          player_id: 'user-123',
          operator_id: 'operator-1',
          operator_brand_id: 'brand-1',
          ext_player_id: 'user-123',
          timestamp: 1640995200,
          amount: 100,
          currency: 'USD',
          operation: 'refund',
        },
      };

      mockSportsbookBetRepository.findOne.mockResolvedValue(mockBet);
      mockBalanceService.updateFiatBalance.mockResolvedValue(mockRefundBalanceResult);

      // Act
      const result = await service.refund(refundRequest);

      // Assert
      expect(result).toEqual({
        id: expect.any(String),
        ext_transaction_id: refundRequest.transaction.id,
        parent_transaction_id: mockBet.id,
        user_id: mockBet.userId,
        operation: 'refund',
        amount: refundRequest.transaction.amount,
        currency: refundRequest.transaction.currency,
        balance: 1000,
      });

      expect(mockBalanceService.updateFiatBalance).toHaveBeenCalledWith({
        userId: mockBet.userId,
        operation: BalanceOperationEnum.REFUND,
        operationId: expect.any(String),
        amount: refundRequest.transaction.amount.toString(),
        currency: refundRequest.transaction.currency as CurrencyEnum,
        description: `Betby refund for bet ${mockBet.id}`,
      });
    });

    it('should return existing balance if bet is already refunded', async () => {
      // Arrange
      const refundedBet = { ...mockBet, status: SportsbookBetStatus.REFUND };
      const refundRequest: BetRefundRequestDto = {
        bet_transaction_id: 'bet-123',
        reason: 'Event cancelled',
        reason_code: RefundReasonCode.CANCELLED_EVENT,
        transaction: {
          id: 'refund-tx-123',
          betslip_id: 'betslip-123',
          player_id: 'user-123',
          operator_id: 'operator-1',
          operator_brand_id: 'brand-1',
          ext_player_id: 'user-123',
          timestamp: 1640995200,
          amount: 100,
          currency: 'USD',
          operation: 'refund',
        },
      };

      mockSportsbookBetRepository.findOne.mockResolvedValue(refundedBet);
      mockBalanceService.getFiatBalance.mockResolvedValue(1000);

      // Act
      const result = await service.refund(refundRequest);

      // Assert
      expect(result.balance).toBe(1000);
      expect(mockBalanceService.updateFiatBalance).not.toHaveBeenCalled();
    });
  });

  describe('win', () => {
    it('should successfully credit winnings', async () => {
      // Arrange
      const winRequest: BetWinRequestDto = {
        amount: 250,
        currency: 'USD',
        is_cashout: false,
        bet_transaction_id: 'bet-123',
        transaction: {
          id: 'win-tx-123',
          betslip_id: 'betslip-123',
          player_id: 'user-123',
          operator_id: 'operator-1',
          operator_brand_id: 'brand-1',
          ext_player_id: 'user-123',
          timestamp: 1640995200,
          amount: 250,
          currency: 'USD',
          operation: 'win',
        },
        selections: [],
      };

      mockSportsbookBetRepository.findOne.mockResolvedValue(mockBet);
      mockBalanceService.updateFiatBalance.mockResolvedValue(mockWinBalanceResult);

      // Act
      const result = await service.win(winRequest);

      // Assert
      expect(result).toEqual({
        id: expect.any(String),
        ext_transaction_id: winRequest.transaction.id,
        parent_transaction_id: expect.any(String),
        user_id: mockBet.userId,
        operation: 'win',
        amount: winRequest.amount,
        currency: winRequest.currency,
        balance: 1150, // 900 (current balance) + 250 (win amount)
      });

      expect(mockBalanceService.updateFiatBalance).toHaveBeenCalledWith({
        userId: mockBet.userId,
        operation: BalanceOperationEnum.WIN,
        operationId: expect.any(String),
        amount: winRequest.amount.toString(),
        currency: winRequest.transaction.currency as CurrencyEnum,
        description: `Betby win for bet ${mockBet.id}`,
        metadata: {
          betId: mockBet.id,
          amount: mockBet.betAmount,
        },
      });
    });

    it('should return existing result if bet is already won', async () => {
      // Arrange
      const wonBet = { ...mockBet, status: SportsbookBetStatus.WON };
      const winRequest: BetWinRequestDto = {
        amount: 250,
        currency: 'USD',
        is_cashout: false,
        bet_transaction_id: 'bet-123',
        transaction: {
          id: 'win-tx-123',
          betslip_id: 'betslip-123',
          player_id: 'user-123',
          operator_id: 'operator-1',
          operator_brand_id: 'brand-1',
          ext_player_id: 'user-123',
          timestamp: 1640995200,
          amount: 250,
          currency: 'USD',
          operation: 'win',
        },
        selections: [],
      };

      mockSportsbookBetRepository.findOne.mockResolvedValue(wonBet);
      mockBalanceService.getFiatBalance.mockResolvedValue(1150); // Current balance after win

      // Act
      const result = await service.win(winRequest);

      // Assert
      expect(result.balance).toBe(1150); // Current user balance
      expect(mockBalanceService.updateFiatBalance).not.toHaveBeenCalled();
    });
  });

  describe('lost', () => {
    it('should update bet status to LOST', async () => {
      // Arrange
      const lostRequest: BetLostRequestDto = {
        bet_transaction_id: 'bet-123',
        amount: 0,
        currency: 'USD',
        transaction: {
          id: 'lost-tx-123',
          betslip_id: 'betslip-123',
          player_id: 'user-123',
          operator_id: 'operator-1',
          operator_brand_id: 'brand-1',
          ext_player_id: 'user-123',
          timestamp: 1640995200,
          amount: 0,
          currency: 'USD',
          operation: 'lost',
        },
        selections: [],
      };

      mockSportsbookBetRepository.findOne.mockResolvedValue(mockBet);
      mockBalanceService.getFiatBalance.mockResolvedValue(900); // Current balance after bet

      // Act
      const result = await service.lost(lostRequest);

      // Assert
      expect(result).toEqual({
        id: expect.any(String),
        ext_transaction_id: lostRequest.transaction.id,
        parent_transaction_id: expect.any(String),
        user_id: mockBet.userId,
        operation: 'lost',
        balance: 900, // Balance does not change on loss
      });
    });

    it('should return existing result if bet is already lost', async () => {
      // Arrange
      const lostBet = { ...mockBet, status: SportsbookBetStatus.LOST };
      const lostRequest: BetLostRequestDto = {
        bet_transaction_id: 'bet-123',
        amount: 0,
        currency: 'USD',
        transaction: {
          id: 'lost-tx-123',
          betslip_id: 'betslip-123',
          player_id: 'user-123',
          operator_id: 'operator-1',
          operator_brand_id: 'brand-1',
          ext_player_id: 'user-123',
          timestamp: 1640995200,
          amount: 0,
          currency: 'USD',
          operation: 'lost',
        },
        selections: [],
      };

      mockSportsbookBetRepository.findOne.mockResolvedValue(lostBet);
      mockBalanceService.getFiatBalance.mockResolvedValue(900); // Current balance after bet

      // Act
      const result = await service.lost(lostRequest);

      // Assert
      expect(result.balance).toBe(900); // Balance does not change on loss
    });
  });

  describe('discard', () => {
    it('should cancel existing bet', async () => {
      // Arrange
      const discardRequest: BetDiscardRequestDto = {
        transaction_id: 'ext-tx-123',
        ext_player_id: 'user-123',
        reason: 'Bet cancelled by operator',
      };

      mockSportsbookBetRepository.findOne.mockResolvedValue(mockBet);
      mockBalanceService.updateFiatBalance.mockResolvedValue(mockBalanceResult);

      // Act
      const result = await service.discard(discardRequest);

      // Assert
      expect(result).toEqual({});
      expect(mockBalanceService.updateFiatBalance).toHaveBeenCalledWith({
        userId: mockBet.userId,
        operation: BalanceOperationEnum.BET_CANCEL,
        operationId: expect.any(String),
        amount: mockBet.betAmount,
        currency: mockBet.currency,
        description: `Betby bet cancel for bet ${mockBet.id}`,
      });
    });

    it('should create cancelled bet if it does not exist', async () => {
      // Arrange
      const discardRequest: BetDiscardRequestDto = {
        transaction_id: 'ext-tx-123',
        ext_player_id: 'user-123',
        reason: 'Bet cancelled by operator',
      };

      mockSportsbookBetRepository.findOne.mockResolvedValue(null);
      mockSportsbookBetRepository.create.mockReturnValue(mockBet);
      mockSportsbookBetRepository.save.mockResolvedValue(mockBet);

      // Act
      const result = await service.discard(discardRequest);

      // Assert
      expect(result).toEqual({});
      expect(mockSportsbookBetRepository.create).toHaveBeenCalledWith({
        userId: discardRequest.ext_player_id,
        extTransactionId: discardRequest.transaction_id,
        betslipId: expect.any(String),
        betAmount: '0',
        currency: CurrencyEnum.USD,
        totalOdds: '0',
        betType: SportsbookBetType.SINGLE,
        selections: [],
        status: SportsbookBetStatus.CANCELED,
      });
    });
  });

  describe('rollback', () => {
    it('should rollback a won bet', async () => {
      // Arrange
      const wonBet = { ...mockBet, status: SportsbookBetStatus.WON };
      const rollbackRequest: BetRollbackRequestDto = {
        bet_transaction_id: 'bet-123',
        parent_transaction_id: 'parent-tx-123',
        transaction: {
          id: 'rollback-tx-123',
          betslip_id: 'betslip-123',
          player_id: 'user-123',
          operator_id: 'operator-1',
          operator_brand_id: 'brand-1',
          ext_player_id: 'user-123',
          timestamp: 1640995200,
          amount: 250,
          currency: 'USD',
          operation: 'rollback',
        },
      };

      mockSportsbookBetRepository.findOne.mockResolvedValue(wonBet);
      mockBalanceService.updateFiatBalance.mockResolvedValue(mockRollbackWinBalanceResult);

      // Act
      const result = await service.rollback(rollbackRequest);

      // Assert
      expect(result).toEqual({
        id: expect.any(String),
        ext_transaction_id: rollbackRequest.transaction.id,
        parent_transaction_id: expect.any(String),
        user_id: wonBet.userId,
        operation: 'rollback',
        amount: rollbackRequest.transaction.amount,
        currency: rollbackRequest.transaction.currency,
        balance: 900, // 1150 (balance after win) - 250 (win cancellation)
      });

      expect(mockBalanceService.updateFiatBalance).toHaveBeenCalledWith({
        userId: wonBet.userId,
        operation: BalanceOperationEnum.WIN_CANCEL,
        operationId: expect.any(String),
        amount: rollbackRequest.transaction.amount.toString(),
        currency: rollbackRequest.transaction.currency as CurrencyEnum,
        description: `Betby rollback: win_cancel for bet ${wonBet.id}`,
        metadata: {
          betId: wonBet.id,
          betslipId: wonBet.betslipId,
          previousStatus: SportsbookBetStatus.WON,
          rollbackType: 'win_cancel',
        },
      });
    });

    it('should rollback a lost bet without changing balance', async () => {
      // Arrange
      const lostBet = { ...mockBet, status: SportsbookBetStatus.LOST };
      const rollbackRequest: BetRollbackRequestDto = {
        bet_transaction_id: 'bet-123',
        parent_transaction_id: 'parent-tx-123',
        transaction: {
          id: 'rollback-tx-123',
          betslip_id: 'betslip-123',
          player_id: 'user-123',
          operator_id: 'operator-1',
          operator_brand_id: 'brand-1',
          ext_player_id: 'user-123',
          timestamp: 1640995200,
          amount: 0,
          currency: 'USD',
          operation: 'rollback',
        },
      };

      mockSportsbookBetRepository.findOne.mockResolvedValue(lostBet);
      mockBalanceService.getFiatBalance.mockResolvedValue(900); // Current balance after bet

      // Act
      const result = await service.rollback(rollbackRequest);

      // Assert
      expect(result.balance).toBe(900); // Balance does not change on rollback of lost bet
      expect(mockBalanceService.updateFiatBalance).not.toHaveBeenCalled();
    });

    it('should rollback a cancelled bet', async () => {
      // Arrange
      const canceledBet = { ...mockBet, status: SportsbookBetStatus.CANCELED };
      const rollbackRequest: BetRollbackRequestDto = {
        bet_transaction_id: 'bet-123',
        parent_transaction_id: 'parent-tx-123',
        transaction: {
          id: 'rollback-tx-123',
          betslip_id: 'betslip-123',
          player_id: 'user-123',
          operator_id: 'operator-1',
          operator_brand_id: 'brand-1',
          ext_player_id: 'user-123',
          timestamp: 1640995200,
          amount: 100,
          currency: 'USD',
          operation: 'rollback',
        },
      };

      mockSportsbookBetRepository.findOne.mockResolvedValue(canceledBet);
      mockBalanceService.updateFiatBalance.mockResolvedValue(mockRollbackCancelBalanceResult);

      // Act
      const result = await service.rollback(rollbackRequest);

      // Assert
      expect(result.amount).toBe(100); // Should use bet amount
      expect(result.balance).toBe(1000); // 900 (current balance) + 100 (cancelled bet refund)
      expect(mockBalanceService.updateFiatBalance).toHaveBeenCalledWith({
        userId: canceledBet.userId,
        operation: BalanceOperationEnum.BET_CANCEL,
        operationId: expect.any(String),
        amount: canceledBet.betAmount,
        currency: rollbackRequest.transaction.currency as CurrencyEnum,
        description: `Betby rollback: bet_cancel for bet ${canceledBet.id}`,
        metadata: {
          betId: canceledBet.id,
          betslipId: canceledBet.betslipId,
          previousStatus: SportsbookBetStatus.CANCELED,
          rollbackType: 'bet_cancel',
        },
      });
    });

    it('should return current balance for active bet', async () => {
      // Arrange
      const activeBet = { ...mockBet, status: SportsbookBetStatus.ACTIVE };
      const rollbackRequest: BetRollbackRequestDto = {
        bet_transaction_id: 'bet-123',
        parent_transaction_id: 'parent-tx-123',
        transaction: {
          id: 'rollback-tx-123',
          betslip_id: 'betslip-123',
          player_id: 'user-123',
          operator_id: 'operator-1',
          operator_brand_id: 'brand-1',
          ext_player_id: 'user-123',
          timestamp: 1640995200,
          amount: 100,
          currency: 'USD',
          operation: 'rollback',
        },
      };

      mockSportsbookBetRepository.findOne.mockResolvedValue(activeBet);
      mockBalanceService.getFiatBalance.mockResolvedValue(900); // Current balance after bet

      // Act
      const result = await service.rollback(rollbackRequest);

      // Assert
      expect(result.balance).toBe(900); // Current balance for active bet
      expect(mockBalanceService.updateFiatBalance).not.toHaveBeenCalled();
    });
  });

  describe('playerSegment', () => {
    it('should return empty object', async () => {
      // Arrange
      const segmentRequest: PlayerSegmentRequestDto = {
        brand_id: 'brand-1',
        brand_name: 'Test Brand',
        player_id: 'user-123',
        player_name: 'Test Player',
        external_player_id: 'user-123',
        segment_name: 'High Risk',
        segment_ccf: '0.5',
      };

      // Act
      const result = await service.playerSegment(segmentRequest);

      // Assert
      expect(result).toEqual({});
    });
  });

  describe('generateTokenForCurrentUser', () => {
    it('should generate token for current user', async () => {
      // Arrange
      const mockToken = { token: 'jwt-token-123' };
      const tokenRequest: BetbyTokenGenerateRequestDto = { language: 'en' };

      mockBetbyJwtService.generateToken.mockResolvedValue(mockToken);

      // Act
      const result = await service.generateTokenForCurrentUser(mockUser, tokenRequest);

      // Assert
      expect(result).toEqual(mockToken);
      expect(mockBetbyJwtService.generateToken).toHaveBeenCalledWith(mockUser, tokenRequest);
    });

    it('should throw error if token generation fails', async () => {
      // Arrange
      const tokenRequest: BetbyTokenGenerateRequestDto = { language: 'en' };
      mockBetbyJwtService.generateToken.mockRejectedValue(new Error('Token generation failed'));

      // Act & Assert
      await expect(service.generateTokenForCurrentUser(mockUser, tokenRequest)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('roundBalance', () => {
    it('should round balance to nearest 10', () => {
      // Act & Assert
      expect(service['roundBalance'](1234)).toBe(1230);
      expect(service['roundBalance'](1235)).toBe(1240);
      expect(service['roundBalance']('1234.5')).toBe(1230);
      expect(service['roundBalance']('1235.5')).toBe(1240);
    });
  });

  describe('mapBetType', () => {
    it('should correctly map bet types', () => {
      // Act & Assert
      expect(service['mapBetType']('single')).toBe(SportsbookBetType.SINGLE);
      expect(service['mapBetType']('accumulator')).toBe(SportsbookBetType.ACCUMULATOR);
      expect(service['mapBetType']('system')).toBe(SportsbookBetType.SYSTEM);
      expect(service['mapBetType']('chain')).toBe(SportsbookBetType.CHAIN);
      expect(service['mapBetType']('unknown')).toBe(SportsbookBetType.SINGLE);
    });
  });

  describe('Complete bet lifecycle', () => {
    it('should correctly handle operation sequence: bet -> win -> rollback', async () => {
      // Arrange - Initial conditions
      const initialBalance = 1000;
      const betAmount = 100;
      const winAmount = 250;

      // 1. Create bet
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockBalanceService.getFiatBalance.mockResolvedValue(initialBalance);
      mockSportsbookBetRepository.findOne.mockResolvedValue(null);
      mockSportsbookBetRepository.create.mockReturnValue(mockBet);
      mockSportsbookBetRepository.save.mockResolvedValue(mockBet);
      mockBalanceService.updateFiatBalance.mockResolvedValue({
        status: BalanceOperationResultEnum.SUCCESS,
        balance: initialBalance - betAmount, // 900
        success: true,
      });

      // Act 1 - Create bet
      const betResult = await service.makeBet(mockMakeBetRequest);

      // Assert 1 - Verify bet creation
      expect(betResult.balance).toBe(900);
      expect(mockBalanceService.updateFiatBalance).toHaveBeenCalledWith({
        userId: mockMakeBetRequest.player_id,
        operation: BalanceOperationEnum.BET,
        operationId: expect.any(String),
        amount: betAmount.toString(),
        currency: mockMakeBetRequest.currency as CurrencyEnum,
        description: `Betby bet for betslip ${mockMakeBetRequest.transaction.betslip_id}`,
        metadata: {
          betId: mockBet.id,
          amount: betAmount,
        },
      });

      // 2. Commit bet
      mockSportsbookBetRepository.findOne.mockResolvedValue(mockBet);
      mockSportsbookBetRepository.save.mockResolvedValue({
        ...mockBet,
        status: SportsbookBetStatus.ACTIVE,
      });

      // Act 2 - Commit bet
      await service.commitBet({ transaction_id: mockBet.id });

      // Assert 2 - Verify bet commit
      expect(mockSportsbookBetRepository.save).toHaveBeenCalledWith({
        ...mockBet,
        status: SportsbookBetStatus.ACTIVE,
      });

      // 3. Win
      const winRequest: BetWinRequestDto = {
        amount: winAmount,
        currency: 'USD',
        is_cashout: false,
        bet_transaction_id: mockBet.id,
        transaction: {
          id: 'win-tx-123',
          betslip_id: 'betslip-123',
          player_id: 'user-123',
          operator_id: 'operator-1',
          operator_brand_id: 'brand-1',
          ext_player_id: 'user-123',
          timestamp: 1640995200,
          amount: winAmount,
          currency: 'USD',
          operation: 'win',
        },
        selections: [],
      };

      mockSportsbookBetRepository.findOne.mockResolvedValue({
        ...mockBet,
        status: SportsbookBetStatus.ACTIVE,
      });
      mockBalanceService.updateFiatBalance.mockResolvedValue({
        status: BalanceOperationResultEnum.SUCCESS,
        balance: 900 + winAmount, // 1150
        success: true,
      });

      // Act 3 - Win
      const winResult = await service.win(winRequest);

      // Assert 3 - Verify win
      expect(winResult.balance).toBe(1150);
      expect(mockBalanceService.updateFiatBalance).toHaveBeenCalledWith({
        userId: mockBet.userId,
        operation: BalanceOperationEnum.WIN,
        operationId: expect.any(String),
        amount: winAmount.toString(),
        currency: winRequest.transaction.currency as CurrencyEnum,
        description: `Betby win for bet ${mockBet.id}`,
        metadata: {
          betId: mockBet.id,
          amount: mockBet.betAmount,
        },
      });

      // 4. Rollback win
      const rollbackRequest: BetRollbackRequestDto = {
        bet_transaction_id: mockBet.id,
        parent_transaction_id: 'parent-tx-123',
        transaction: {
          id: 'rollback-tx-123',
          betslip_id: 'betslip-123',
          player_id: 'user-123',
          operator_id: 'operator-1',
          operator_brand_id: 'brand-1',
          ext_player_id: 'user-123',
          timestamp: 1640995200,
          amount: winAmount,
          currency: 'USD',
          operation: 'rollback',
        },
      };

      mockSportsbookBetRepository.findOne.mockResolvedValue({
        ...mockBet,
        status: SportsbookBetStatus.WON,
      });
      mockBalanceService.updateFiatBalance.mockResolvedValue({
        status: BalanceOperationResultEnum.SUCCESS,
        balance: 1150 - winAmount, // 900
        success: true,
      });

      // Act 4 - Rollback
      const rollbackResult = await service.rollback(rollbackRequest);

      // Assert 4 - Verify rollback
      expect(rollbackResult.balance).toBe(900);
      expect(mockBalanceService.updateFiatBalance).toHaveBeenCalledWith({
        userId: mockBet.userId,
        operation: BalanceOperationEnum.WIN_CANCEL,
        operationId: expect.any(String),
        amount: winAmount.toString(),
        currency: rollbackRequest.transaction.currency as CurrencyEnum,
        description: `Betby rollback: win_cancel for bet ${mockBet.id}`,
        metadata: {
          betId: mockBet.id,
          betslipId: mockBet.betslipId,
          previousStatus: SportsbookBetStatus.WON,
          rollbackType: 'win_cancel',
        },
      });

      // Final verification - balance returned to state after bet
      expect(rollbackResult.balance).toBe(initialBalance - betAmount);
    });

    it('should correctly handle operation sequence: bet -> loss -> rollback', async () => {
      // Arrange - Initial conditions
      const initialBalance = 1000;
      const betAmount = 100;

      // 1. Create bet
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockBalanceService.getFiatBalance.mockResolvedValue(initialBalance);
      mockSportsbookBetRepository.findOne.mockResolvedValue(null);
      mockSportsbookBetRepository.create.mockReturnValue(mockBet);
      mockSportsbookBetRepository.save.mockResolvedValue(mockBet);
      mockBalanceService.updateFiatBalance.mockResolvedValue({
        status: BalanceOperationResultEnum.SUCCESS,
        balance: initialBalance - betAmount, // 900
        success: true,
      });

      // Act 1 - Create bet
      const betResult = await service.makeBet(mockMakeBetRequest);
      expect(betResult.balance).toBe(900);

      // 2. Loss
      const lostRequest: BetLostRequestDto = {
        bet_transaction_id: mockBet.id,
        amount: 0,
        currency: 'USD',
        transaction: {
          id: 'lost-tx-123',
          betslip_id: 'betslip-123',
          player_id: 'user-123',
          operator_id: 'operator-1',
          operator_brand_id: 'brand-1',
          ext_player_id: 'user-123',
          timestamp: 1640995200,
          amount: 0,
          currency: 'USD',
          operation: 'lost',
        },
        selections: [],
      };

      mockSportsbookBetRepository.findOne.mockResolvedValue({
        ...mockBet,
        status: SportsbookBetStatus.ACTIVE,
      });
      mockBalanceService.getFiatBalance.mockResolvedValue(900);

      // Act 2 - Loss
      const lostResult = await service.lost(lostRequest);

      // Assert 2 - Verify loss
      expect(lostResult.balance).toBe(900); // Balance does not change on loss

      // 3. Rollback loss
      const rollbackRequest: BetRollbackRequestDto = {
        bet_transaction_id: mockBet.id,
        parent_transaction_id: 'parent-tx-123',
        transaction: {
          id: 'rollback-tx-123',
          betslip_id: 'betslip-123',
          player_id: 'user-123',
          operator_id: 'operator-1',
          operator_brand_id: 'brand-1',
          ext_player_id: 'user-123',
          timestamp: 1640995200,
          amount: 0,
          currency: 'USD',
          operation: 'rollback',
        },
      };

      mockSportsbookBetRepository.findOne.mockResolvedValue({
        ...mockBet,
        status: SportsbookBetStatus.LOST,
      });
      mockBalanceService.getFiatBalance.mockResolvedValue(900);

      // Act 3 - Rollback loss
      const rollbackResult = await service.rollback(rollbackRequest);

      // Assert 3 - Verify loss rollback
      expect(rollbackResult.balance).toBe(900); // Balance does not change on loss rollback
      // Balance operation should only be called once (for the initial bet), not for rollback
      expect(mockBalanceService.updateFiatBalance).toHaveBeenCalledTimes(1);
    });

    it('should correctly handle operation sequence: bet -> cancel -> refund', async () => {
      // Arrange - Initial conditions
      const initialBalance = 1000;
      const betAmount = 100;

      // 1. Create bet
      mockUsersService.findById.mockResolvedValue(mockUser);
      mockBalanceService.getFiatBalance.mockResolvedValue(initialBalance);
      mockSportsbookBetRepository.findOne.mockResolvedValue(null);
      mockSportsbookBetRepository.create.mockReturnValue(mockBet);
      mockSportsbookBetRepository.save.mockResolvedValue(mockBet);
      mockBalanceService.updateFiatBalance.mockResolvedValue({
        status: BalanceOperationResultEnum.SUCCESS,
        balance: initialBalance - betAmount, // 900
        success: true,
      });

      // Act 1 - Create bet
      const betResult = await service.makeBet(mockMakeBetRequest);
      expect(betResult.balance).toBe(900);

      // 2. Cancel bet
      const discardRequest: BetDiscardRequestDto = {
        transaction_id: 'ext-tx-123',
        ext_player_id: 'user-123',
        reason: 'Bet cancelled by operator',
      };

      mockSportsbookBetRepository.findOne.mockResolvedValue(mockBet);
      mockBalanceService.updateFiatBalance.mockResolvedValue({
        status: BalanceOperationResultEnum.SUCCESS,
        balance: initialBalance, // 1000 - bet refund
        success: true,
      });

      // Act 2 - Cancel bet
      await service.discard(discardRequest);

      // Assert 2 - Verify bet cancellation
      expect(mockBalanceService.updateFiatBalance).toHaveBeenCalledWith({
        userId: mockBet.userId,
        operation: BalanceOperationEnum.BET_CANCEL,
        operationId: expect.any(String),
        amount: mockBet.betAmount,
        currency: mockBet.currency,
        description: `Betby bet cancel for bet ${mockBet.id}`,
      });

      // 3. Refund bet
      const refundRequest: BetRefundRequestDto = {
        bet_transaction_id: mockBet.id,
        reason: 'Event cancelled',
        reason_code: RefundReasonCode.CANCELLED_EVENT,
        transaction: {
          id: 'refund-tx-123',
          betslip_id: 'betslip-123',
          player_id: 'user-123',
          operator_id: 'operator-1',
          operator_brand_id: 'brand-1',
          ext_player_id: 'user-123',
          timestamp: 1640995200,
          amount: betAmount,
          currency: 'USD',
          operation: 'refund',
        },
      };

      mockSportsbookBetRepository.findOne.mockResolvedValue({
        ...mockBet,
        status: SportsbookBetStatus.CANCELED,
      });
      mockBalanceService.updateFiatBalance.mockResolvedValue({
        status: BalanceOperationResultEnum.SUCCESS,
        balance: initialBalance, // 1000 - balance already refunded on cancellation
        success: true,
      });

      // Act 3 - Refund bet
      const refundResult = await service.refund(refundRequest);

      // Assert 3 - Verify refund
      expect(refundResult.balance).toBe(initialBalance);
      expect(mockBalanceService.updateFiatBalance).toHaveBeenCalledWith({
        userId: mockBet.userId,
        operation: BalanceOperationEnum.REFUND,
        operationId: expect.any(String),
        amount: betAmount.toString(),
        currency: refundRequest.transaction.currency as CurrencyEnum,
        description: `Betby refund for bet ${mockBet.id}`,
      });
    });
  });
});
