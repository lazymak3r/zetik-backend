import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatEntity, ChatMessageEntity, ChatMessageTypeEnum } from '@zetik/shared-entities';
import { UserVipStatusService } from '../../../bonus/services/user-vip-status.service';
import { ChatMessageEnricherService } from '../chat-message-enricher.service';
import { ChatService } from '../chat.service';

describe('ChatService', () => {
  let service: ChatService;
  let chatRepository: any;
  let messageRepository: any;
  let enricherService: jest.Mocked<ChatMessageEnricherService>;
  let userVipStatusService: jest.Mocked<UserVipStatusService>;

  beforeEach(async () => {
    chatRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const createMockQueryBuilder = () => ({
      select: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      setParameters: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      getQuery: jest
        .fn()
        .mockReturnValue(
          'SELECT msg.id FROM messages msg WHERE msg.chatId = :chatId ORDER BY msg.createdAt DESC LIMIT 100',
        ),
      getParameters: jest.fn().mockReturnValue({ chatId: 'chat-1' }),
      getMany: jest.fn(),
    });

    messageRepository = {
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn((data) => data),
      createQueryBuilder: jest.fn().mockImplementation(() => createMockQueryBuilder()),
    };

    enricherService = {
      enrichMessages: jest.fn(),
    } as any;

    userVipStatusService = {
      getUsersVipStatus: jest
        .fn()
        .mockResolvedValue([{ userId: 'user-1', vipLevel: 5, vipLevelImage: 'vip5.png' }]),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getRepositoryToken(ChatEntity),
          useValue: chatRepository,
        },
        {
          provide: getRepositoryToken(ChatMessageEntity),
          useValue: messageRepository,
        },
        {
          provide: ChatMessageEnricherService,
          useValue: enricherService,
        },
        {
          provide: UserVipStatusService,
          useValue: userVipStatusService,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  describe('getMessages', () => {
    it('should delegate to enricher service', async () => {
      const mockMessages = [{ id: 'msg-1', userId: 'user-1' }] as any;
      const enrichedMessages = [{ id: 'msg-1', user: { name: 'Test' } }] as any;

      const mockSubQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getQuery: jest
          .fn()
          .mockReturnValue(
            '(SELECT msg.id FROM messages msg WHERE msg.chatId = :chatId ORDER BY msg.createdAt DESC LIMIT 100)',
          ),
      };

      const mockMainQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockMessages),
        subQuery: jest.fn().mockReturnValue(mockSubQueryBuilder),
      };

      messageRepository.createQueryBuilder.mockReturnValue(mockMainQueryBuilder);
      enricherService.enrichMessages.mockResolvedValue(enrichedMessages);

      const result = await service.getMessages('chat-1');

      expect(messageRepository.createQueryBuilder).toHaveBeenCalledWith('message');
      expect(mockMainQueryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('message.user', 'user');
      expect(mockMainQueryBuilder.where).toHaveBeenCalled();
      expect(mockSubQueryBuilder.select).toHaveBeenCalledWith('msg.id');
      expect(mockSubQueryBuilder.from).toHaveBeenCalled();
      expect(mockSubQueryBuilder.where).toHaveBeenCalledWith('msg.chatId = :chatId', {
        chatId: 'chat-1',
      });
      expect(mockSubQueryBuilder.orderBy).toHaveBeenCalledWith('msg.createdAt', 'DESC');
      expect(mockSubQueryBuilder.limit).toHaveBeenCalledWith(100);
      expect(mockMainQueryBuilder.setParameter).toHaveBeenCalledWith('chatId', 'chat-1');
      expect(mockMainQueryBuilder.orderBy).toHaveBeenCalledWith('message.createdAt', 'ASC');
      expect(mockMainQueryBuilder.getMany).toHaveBeenCalled();
      expect(enricherService.enrichMessages).toHaveBeenCalledWith(mockMessages);
      expect(result).toEqual(enrichedMessages);
    });

    it('should filter out messages from ignored users', async () => {
      const mockMessages = [{ id: 'msg-1', userId: 'user-2' }] as any;
      const enrichedMessages = [{ id: 'msg-1', user: { name: 'Test' } }] as any;

      const mockSubQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getQuery: jest
          .fn()
          .mockReturnValue(
            '(SELECT msg.id FROM messages msg WHERE msg.chatId = :chatId ORDER BY msg.createdAt DESC LIMIT 100)',
          ),
      };

      const mockMainQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockMessages),
        subQuery: jest.fn().mockReturnValue(mockSubQueryBuilder),
      };

      messageRepository.createQueryBuilder.mockReturnValue(mockMainQueryBuilder);
      enricherService.enrichMessages.mockResolvedValue(enrichedMessages);

      const result = await service.getMessages('chat-1', 'user-1');

      expect(mockMainQueryBuilder.leftJoin).toHaveBeenCalledWith(
        'users.user_ignored_users',
        'ignored',
        'ignored.ignorerId = :userId AND ignored.ignoredUserId = message.userId',
        { userId: 'user-1' },
      );
      expect(mockMainQueryBuilder.andWhere).toHaveBeenCalledWith('ignored.id IS NULL');
      expect(enricherService.enrichMessages).toHaveBeenCalledWith(mockMessages);
      expect(result).toEqual(enrichedMessages);
    });
  });

  describe('sendMessage', () => {
    it('should create MESSAGE type message', async () => {
      const mockChat = { id: 'chat-1', name: 'Test Chat' };
      const mockMessage = {
        id: 'msg-1',
        chatId: 'chat-1',
        userId: 'user-1',
        messageType: ChatMessageTypeEnum.MESSAGE,
        message: 'Hello',
        createdAt: new Date(),
      };

      chatRepository.findOne.mockResolvedValue(mockChat);
      messageRepository.save.mockResolvedValue(mockMessage);

      const result = await service.sendMessage('chat-1', 'Hello', {
        id: 'user-1',
        name: 'Test User',
        avatar: 'avatar.jpg',
      });

      expect(messageRepository.create).toHaveBeenCalledWith({
        chatId: 'chat-1',
        userId: 'user-1',
        messageType: ChatMessageTypeEnum.MESSAGE,
        message: 'Hello',
      });
      expect(result.messageType).toBe(ChatMessageTypeEnum.MESSAGE);
      expect(result.message).toBe('Hello');
    });

    it('should throw error if chat not found', async () => {
      chatRepository.findOne.mockResolvedValue(null);

      await expect(
        service.sendMessage('invalid-chat', 'Hello', {
          id: 'user-1',
          name: 'Test',
        }),
      ).rejects.toThrow('Chat with ID invalid-chat not found');
    });
  });

  describe('sendTipMessage', () => {
    it('should create TIP notification with metadata', async () => {
      const mockChat = { id: 'chat-1', name: 'Test Chat' };
      const mockMessage = {
        id: 'msg-1',
        chatId: 'chat-1',
        userId: 'user-1',
        messageType: ChatMessageTypeEnum.SERVER_NOTIFICATION_TIP,
        metadata: {
          recipientId: 'user-2',
          asset: 'BTC',
          amount: '0.001',
        },
        createdAt: new Date(),
      };

      chatRepository.findOne.mockResolvedValue(mockChat);
      messageRepository.save.mockResolvedValue(mockMessage);
      userVipStatusService.getUsersVipStatus.mockResolvedValue([
        { userId: 'user-1', vipLevel: 5, vipLevelImage: 'vip5.png' },
        { userId: 'user-2', vipLevel: 10, vipLevelImage: 'vip10.png' },
      ]);

      const result = await service.sendTipMessage(
        'chat-1',
        { id: 'user-1', name: 'Sender', avatar: 'avatar1.jpg' },
        { id: 'user-2', name: 'Recipient', avatar: 'avatar2.jpg' },
        'BTC' as any,
        '0.001',
      );

      expect(messageRepository.create).toHaveBeenCalledWith({
        chatId: 'chat-1',
        userId: 'user-1',
        messageType: ChatMessageTypeEnum.SERVER_NOTIFICATION_TIP,
        metadata: {
          recipientId: 'user-2',
          asset: 'BTC',
          amount: '0.001',
        },
      });
      expect(result.messageType).toBe(ChatMessageTypeEnum.SERVER_NOTIFICATION_TIP);
      expect(result.metadata).toMatchObject({
        recipient: {
          id: 'user-2',
          name: 'Recipient',
          vipLevel: 10,
        },
        asset: 'BTC',
        amount: '0.001',
      });
    });
  });
});
