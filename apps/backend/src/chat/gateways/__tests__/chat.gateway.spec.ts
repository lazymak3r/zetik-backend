import { Test, TestingModule } from '@nestjs/testing';
import { ChatMessageTypeEnum, UserEntity } from '@zetik/shared-entities';
import BigNumber from 'bignumber.js';
import { WebSocketAuthService } from '../../../websocket/services/websocket-auth.service';
import { ChatService } from '../../services/chat.service';
import { ChatGateway } from '../chat.gateway';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let chatService: jest.Mocked<ChatService>;
  let mockAuthService: any;

  beforeEach(async () => {
    chatService = {
      getChats: jest.fn(),
      getMessages: jest.fn(),
      sendMessage: jest.fn(),
      sendTipMessage: jest.fn(),
    } as any;

    mockAuthService = {
      authenticateConnection: jest.fn(),
      getUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        {
          provide: ChatService,
          useValue: chatService,
        },
        {
          provide: WebSocketAuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);

    // Mock server
    gateway.server = {
      emit: jest.fn(),
    } as any;
  });

  describe('handleGetMessages', () => {
    it('should get messages with user ID to filter ignored users', async () => {
      const mockMessages = [{ id: 'msg-1', userId: 'user-2' }] as any;
      const mockSocket = { userId: 'user-1' } as any;

      mockAuthService.getUser.mockReturnValue({ id: 'user-1' });
      chatService.getMessages.mockResolvedValue(mockMessages);

      const result = await gateway.handleGetMessages(mockSocket, { chatId: 'chat-1' });

      expect(mockAuthService.getUser).toHaveBeenCalledWith(mockSocket);
      expect(chatService.getMessages).toHaveBeenCalledWith('chat-1', 'user-1');
      expect(result).toEqual(mockMessages);
    });
  });

  describe('handleTipEvent', () => {
    it('should create tip message and broadcast to chat', async () => {
      const mockChats = [
        {
          id: 'chat-1',
          name: 'English',
          language: 'en',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockTipMessage = {
        id: 'msg-1',
        chatId: 'chat-1',
        messageType: ChatMessageTypeEnum.SERVER_NOTIFICATION_TIP,
        message: '',
        user: {
          id: 'user-1',
          name: 'sender',
          avatar: 'avatar1.jpg',
          vipLevel: 0,
          vipLevelImage: '',
        },
        metadata: {
          recipient: {
            id: 'user-2',
            name: 'recipient',
            avatar: 'avatar2.jpg',
            vipLevel: 0,
            vipLevelImage: '',
          },
          asset: 'BTC' as any,
          amount: '0.001',
        },
        createdAt: new Date(),
      };

      chatService.getChats.mockResolvedValue(mockChats);
      chatService.sendTipMessage.mockResolvedValue(mockTipMessage);

      const mockPayload = {
        sender: {
          id: 'user-1',
          username: 'sender',
          displayName: 'sender',
          avatarUrl: 'avatar1.jpg',
        } as UserEntity,
        recipient: {
          id: 'user-2',
          username: 'recipient',
          displayName: 'recipient',
          avatarUrl: 'avatar2.jpg',
        } as UserEntity,
        asset: 'BTC' as any,
        amount: new BigNumber('0.001'),
      };

      await gateway.handleTipEvent(mockPayload);

      expect(chatService.getChats).toHaveBeenCalled();
      expect(chatService.sendTipMessage).toHaveBeenCalledWith(
        'chat-1',
        {
          id: 'user-1',
          name: 'sender',
          avatar: 'avatar1.jpg',
        },
        {
          id: 'user-2',
          name: 'recipient',
          avatar: 'avatar2.jpg',
        },
        'BTC',
        '0.001',
      );
      expect(gateway.server.emit).toHaveBeenCalledWith('newMessage', mockTipMessage);
    });

    it('should handle missing English chat gracefully', async () => {
      const mockChats = [
        {
          id: 'chat-1',
          name: 'Russian',
          language: 'ru',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      chatService.getChats.mockResolvedValue(mockChats);
      chatService.sendTipMessage.mockResolvedValue({} as any);

      const mockPayload = {
        sender: {
          id: 'user-1',
          username: 'sender',
          displayName: 'sender',
          avatarUrl: 'avatar1.jpg',
        } as UserEntity,
        recipient: {
          id: 'user-2',
          username: 'recipient',
          displayName: 'recipient',
          avatarUrl: 'avatar2.jpg',
        } as UserEntity,
        asset: 'BTC' as any,
        amount: new BigNumber('0.001'),
      };

      await expect(gateway.handleTipEvent(mockPayload)).resolves.not.toThrow();
      expect(chatService.sendTipMessage).toHaveBeenCalledWith(
        'chat-1',
        expect.any(Object),
        expect.any(Object),
        'BTC',
        '0.001',
      );
    });

    it('should handle error when no chats available', async () => {
      chatService.getChats.mockResolvedValue([]);

      const mockPayload = {
        sender: { id: 'user-1', username: 'sender', displayName: 'sender' } as UserEntity,
        recipient: { id: 'user-2', username: 'recipient', displayName: 'recipient' } as UserEntity,
        asset: 'BTC' as any,
        amount: new BigNumber('0.001'),
      };

      await gateway.handleTipEvent(mockPayload);

      expect(chatService.getChats).toHaveBeenCalled();
      expect(chatService.sendTipMessage).not.toHaveBeenCalled();
    });
  });
});
