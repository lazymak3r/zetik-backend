import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatMessageEntity, ChatMessageTypeEnum, UserEntity } from '@zetik/shared-entities';
import { UserVipStatusService } from '../../../bonus/services/user-vip-status.service';
import { ChatMessageEnricherService } from '../chat-message-enricher.service';

describe('ChatMessageEnricherService', () => {
  let service: ChatMessageEnricherService;
  let userVipStatusService: jest.Mocked<UserVipStatusService>;
  let userRepository: any;

  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    displayName: 'Test User',
    avatarUrl: 'https://avatar.com/1.jpg',
  } as UserEntity;

  const mockRecipient = {
    id: 'user-2',
    username: 'recipient',
    displayName: 'Recipient User',
    avatarUrl: 'https://avatar.com/2.jpg',
  } as UserEntity;

  beforeEach(async () => {
    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([mockRecipient]),
    };

    userRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    userVipStatusService = {
      getUsersVipStatus: jest.fn().mockResolvedValue([
        { userId: 'user-1', vipLevel: 5, vipLevelImage: 'vip5.png' },
        { userId: 'user-2', vipLevel: 10, vipLevelImage: 'vip10.png' },
      ]),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatMessageEnricherService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: userRepository,
        },
        {
          provide: UserVipStatusService,
          useValue: userVipStatusService,
        },
      ],
    }).compile();

    service = module.get<ChatMessageEnricherService>(ChatMessageEnricherService);
  });

  describe('enrichMessages', () => {
    it('should return empty array for empty input', async () => {
      const result = await service.enrichMessages([]);
      expect(result).toEqual([]);
      expect(userVipStatusService.getUsersVipStatus).not.toHaveBeenCalled();
    });

    it('should enrich regular MESSAGE type', async () => {
      const messages = [
        {
          id: 'msg-1',
          chatId: 'chat-1',
          userId: 'user-1',
          user: mockUser,
          messageType: ChatMessageTypeEnum.MESSAGE,
          message: 'Hello world',
          metadata: undefined,
          createdAt: new Date(),
        } as Partial<ChatMessageEntity> as ChatMessageEntity,
      ];

      const result = await service.enrichMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'msg-1',
        messageType: ChatMessageTypeEnum.MESSAGE,
        message: 'Hello world',
        user: {
          id: 'user-1',
          name: 'Test User',
          avatar: 'https://avatar.com/1.jpg',
          vipLevel: 5,
          vipLevelImage: 'vip5.png',
        },
      });
      expect(result[0].metadata).toBeUndefined();
    });

    it('should enrich TIP notification with recipient data using Map for O(1) lookup', async () => {
      const messages = [
        {
          id: 'msg-1',
          chatId: 'chat-1',
          userId: 'user-1',
          user: mockUser,
          messageType: ChatMessageTypeEnum.SERVER_NOTIFICATION_TIP,
          message: undefined,
          metadata: {
            recipientId: 'user-2',
            asset: 'BTC',
            amount: '0.001',
          },
          createdAt: new Date(),
        } as Partial<ChatMessageEntity> as ChatMessageEntity,
      ];

      const result = await service.enrichMessages(messages);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'msg-1',
        messageType: ChatMessageTypeEnum.SERVER_NOTIFICATION_TIP,
        user: {
          id: 'user-1',
          vipLevel: 5,
        },
        metadata: {
          recipient: {
            id: 'user-2',
            name: 'Recipient User',
            vipLevel: 10,
            vipLevelImage: 'vip10.png',
          },
          asset: 'BTC',
          amount: '0.001',
        },
      });
    });

    it('should handle missing recipient gracefully', async () => {
      userRepository.createQueryBuilder().getMany.mockResolvedValue([]);

      const messages = [
        {
          id: 'msg-1',
          chatId: 'chat-1',
          userId: 'user-1',
          user: mockUser,
          messageType: ChatMessageTypeEnum.SERVER_NOTIFICATION_TIP,
          metadata: {
            recipientId: 'user-999',
            asset: 'BTC',
            amount: '0.001',
          },
          createdAt: new Date(),
        } as Partial<ChatMessageEntity> as ChatMessageEntity,
      ];

      const result = await service.enrichMessages(messages);

      expect(result[0].metadata).toBeUndefined();
    });

    it('should not query recipients if no TIP messages present', async () => {
      const messages = [
        {
          id: 'msg-1',
          chatId: 'chat-1',
          userId: 'user-1',
          user: mockUser,
          messageType: ChatMessageTypeEnum.MESSAGE,
          message: 'Hello',
          metadata: undefined,
          createdAt: new Date(),
        } as Partial<ChatMessageEntity> as ChatMessageEntity,
      ];

      await service.enrichMessages(messages);

      expect(userRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should use Map for O(1) lookup performance', async () => {
      const messages = Array.from({ length: 100 }, (_, i) => ({
        id: `msg-${i}`,
        chatId: 'chat-1',
        userId: 'user-1',
        user: mockUser,
        messageType: ChatMessageTypeEnum.MESSAGE,
        message: `Message ${i}`,
        metadata: undefined,
        createdAt: new Date(),
      })) as ChatMessageEntity[];

      const startTime = Date.now();
      await service.enrichMessages(messages);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
      expect(userVipStatusService.getUsersVipStatus).toHaveBeenCalledTimes(1);
    });
  });
});
