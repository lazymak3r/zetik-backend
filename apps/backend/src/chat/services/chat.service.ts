import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AssetTypeEnum,
  ChatEntity,
  ChatMessageEntity,
  ChatMessageTypeEnum,
  UserIgnoredUserEntity,
} from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { UserVipStatusService } from '../../bonus/services/user-vip-status.service';
import { PAGE_LIMIT } from '../../common/constants/constants';
import { UserMuteService } from '../../users/services/user-mute.service';
import { UserRoleService } from '../../users/services/user-role.service';
import { IChat, IChatMessage, IChatUser } from '../interfaces/chat.interfaces';
import { ChatMessageEnricherService } from './chat-message-enricher.service';
import { ChatModerationService } from './chat-moderation.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(ChatEntity)
    private chatRepository: Repository<ChatEntity>,
    @InjectRepository(ChatMessageEntity)
    private messageRepository: Repository<ChatMessageEntity>,
    private readonly userVipStatusService: UserVipStatusService,
    private readonly enricherService: ChatMessageEnricherService,
    @Inject(forwardRef(() => UserMuteService))
    private readonly userMuteService: UserMuteService,
    @Inject(forwardRef(() => UserRoleService))
    private readonly userRoleService: UserRoleService,
    private readonly moderationService: ChatModerationService,
  ) {}

  async getChats(): Promise<IChat[]> {
    return this.chatRepository.find();
  }

  async getMessages(chatId: string, userId?: string): Promise<IChatMessage[]> {
    // get last messages for the chat, but keep the order of the messages
    const query = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.user', 'user')
      .where((qb) => {
        const subQuery = qb
          .subQuery()
          .select('msg.id')
          .from(ChatMessageEntity, 'msg')
          .where('msg.chatId = :chatId', { chatId })
          .orderBy('msg.createdAt', 'DESC')
          .limit(PAGE_LIMIT)
          .getQuery();
        return `message.id IN ${subQuery}`;
      })
      .setParameter('chatId', chatId)
      .orderBy('message.createdAt', 'ASC');

    // Filter out ignored users if userId is provided
    if (userId) {
      query
        .leftJoin(
          UserIgnoredUserEntity,
          'ignored',
          'ignored.ignorerId = :userId AND ignored.ignoredUserId = message.userId',
          { userId },
        )
        .andWhere('ignored.id IS NULL');
    }

    const messages = await query.getMany();
    return this.enricherService.enrichMessages(messages);
  }

  async sendMessage(chatId: string, message: string, user: IChatUser): Promise<IChatMessage> {
    const chat = await this.chatRepository.findOne({ where: { id: chatId } });

    if (!chat) {
      throw new Error(`Chat with ID ${chatId} not found`);
    }

    const isMuted = await this.userMuteService.isUserMuted(user.id);
    if (isMuted) {
      throw new ForbiddenException('You are muted and cannot send messages');
    }

    const userVipLevel = await this.userVipStatusService.getUsersVipStatus([user.id]);
    const userRole = await this.userRoleService.getUserRole(user.id);

    const newMessage = await this.messageRepository.save(
      this.messageRepository.create({
        chatId,
        userId: user.id,
        messageType: ChatMessageTypeEnum.MESSAGE,
        message,
      }),
    );

    this.logger.log(`New message in chat ${chatId} from user ${user.id}: ${message}`);

    return {
      id: newMessage.id,
      chatId: newMessage.chatId,
      messageType: newMessage.messageType,
      message: newMessage.message ?? '',
      createdAt: newMessage.createdAt,
      user: {
        vipLevel: userVipLevel[0]?.vipLevel ?? 0,
        vipLevelImage: userVipLevel[0]?.vipLevelImage ?? '',
        role: userRole ?? undefined,
        ...user,
      },
    };
  }

  async sendTipMessage(
    chatId: string,
    fromUser: IChatUser,
    recipientUser: IChatUser,
    asset: AssetTypeEnum,
    amount: string,
  ): Promise<IChatMessage> {
    const chat = await this.chatRepository.findOne({ where: { id: chatId } });

    if (!chat) {
      throw new BadRequestException(`Chat with ID ${chatId} not found`);
    }

    // Robust input validation for amount
    // While balance service also validates, this provides defense in depth
    // in case this method is called from other code paths in the future
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0 || !Number.isFinite(amountNum)) {
      throw new BadRequestException(`Invalid amount format: ${amount}`);
    }

    const userVipLevels = await this.userVipStatusService.getUsersVipStatus([
      fromUser.id,
      recipientUser.id,
    ]);
    const fromUserRole = await this.userRoleService.getUserRole(fromUser.id);

    const newMessage = await this.messageRepository.save(
      this.messageRepository.create({
        chatId,
        userId: fromUser.id,
        messageType: ChatMessageTypeEnum.SERVER_NOTIFICATION_TIP,
        metadata: {
          recipientId: recipientUser.id,
          asset,
          amount,
        },
      }),
    );

    this.logger.log(
      `New TIP message in chat ${chatId} from user ${fromUser.id} to ${recipientUser.id}: ${amount} ${asset}`,
    );

    const fromVipLevel = userVipLevels.find((v) => v.userId === fromUser.id);
    const recipientVipLevel = userVipLevels.find((v) => v.userId === recipientUser.id);

    return {
      id: newMessage.id,
      chatId: newMessage.chatId,
      messageType: newMessage.messageType,
      message: '',
      createdAt: newMessage.createdAt,
      user: {
        vipLevel: fromVipLevel?.vipLevel ?? 0,
        vipLevelImage: fromVipLevel?.vipLevelImage ?? '',
        role: fromUserRole ?? undefined,
        ...fromUser,
      },
      metadata: {
        recipient: {
          id: recipientUser.id,
          name: recipientUser.name,
          avatar: recipientUser.avatar,
          vipLevel: recipientVipLevel?.vipLevel ?? 0,
          vipLevelImage: recipientVipLevel?.vipLevelImage ?? '',
        },
        asset,
        amount,
      },
    };
  }

  async deleteMessage(messageId: string, deletedBy: string): Promise<void> {
    const canDelete = await this.moderationService.canDeleteMessages(deletedBy);
    if (!canDelete) {
      throw new ForbiddenException('You do not have permission to delete messages');
    }

    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException(`Message with ID ${messageId} not found`);
    }

    await this.messageRepository.remove(message);
    this.logger.log(`Message ${messageId} deleted by user ${deletedBy}`);
  }

  async canDeleteMessage(userId: string, messageId: string): Promise<boolean> {
    const canModerate = await this.moderationService.canDeleteMessages(userId);
    if (!canModerate) {
      return false;
    }

    const message = await this.messageRepository.findOne({
      where: { id: messageId },
    });

    return message !== null;
  }
}
