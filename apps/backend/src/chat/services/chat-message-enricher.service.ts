import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ChatMessageEntity,
  ChatMessageTypeEnum,
  ITipMessageMetadata,
  UserEntity,
} from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { UserVipStatusService } from '../../bonus/services/user-vip-status.service';
import { UserRoleService } from '../../users/services/user-role.service';
import { IChatMessage } from '../interfaces/chat.interfaces';

/**
 * User VIP status data structure returned by UserVipStatusService
 */
interface IUserVipStatus {
  userId: string;
  vipLevel: number;
  vipLevelImage: string;
}

/**
 * Service responsible for enriching chat messages with additional data
 * such as user VIP levels, avatars, and tip notification metadata.
 *
 * Optimizes data fetching by batching user and VIP status queries
 * and using map-based O(1) lookups for performance.
 */
@Injectable()
export class ChatMessageEnricherService {
  private readonly logger = new Logger(ChatMessageEnricherService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly userVipStatusService: UserVipStatusService,
    private readonly userRoleService: UserRoleService,
  ) {}

  private isTipMetadata(metadata: unknown): metadata is ITipMessageMetadata {
    return (
      typeof metadata === 'object' &&
      metadata !== null &&
      'recipientId' in metadata &&
      'asset' in metadata &&
      'amount' in metadata
    );
  }

  async enrichMessages(messages: ChatMessageEntity[]): Promise<IChatMessage[]> {
    if (messages.length === 0) {
      return [];
    }

    const { userVipLevelsMap, recipientUsersMap, userRolesMap } =
      await this.loadEnrichmentData(messages);

    return messages.map((m) => this.mapToDto(m, userVipLevelsMap, recipientUsersMap, userRolesMap));
  }

  private async loadEnrichmentData(messages: ChatMessageEntity[]) {
    const userIds = [...new Set(messages.map((v) => v.userId))];
    const recipientIds = [
      ...new Set(
        messages
          .filter((m) => this.isTipMetadata(m.metadata))
          .map((m) => (m.metadata as ITipMessageMetadata).recipientId),
      ),
    ];

    const [userVipLevels, recipientUsers] = await Promise.all([
      this.userVipStatusService.getUsersVipStatus([...userIds, ...recipientIds]),
      recipientIds.length > 0
        ? this.userRepository
            .createQueryBuilder('user')
            .where('user.id IN (:...ids)', { ids: recipientIds })
            .getMany()
        : Promise.resolve([]),
    ]);

    const userRolesPromises = userIds.map(async (userId) => {
      const role = await this.userRoleService.getUserRole(userId);
      return [userId, role] as [string, typeof role];
    });
    const userRolesArray = await Promise.all(userRolesPromises);
    const userRolesMap = new Map(userRolesArray);

    return {
      userVipLevelsMap: new Map(userVipLevels.map((v) => [v.userId, v])),
      recipientUsersMap: new Map(recipientUsers.map((u) => [u.id, u])),
      userRolesMap,
    };
  }

  private mapToDto(
    message: ChatMessageEntity,
    userVipLevelsMap: Map<string, IUserVipStatus>,
    recipientUsersMap: Map<string, UserEntity>,
    userRolesMap: Map<string, any>,
  ): IChatMessage {
    const fromVipLevel = userVipLevelsMap.get(message.user.id);
    const userRole = userRolesMap.get(message.user.id);

    const baseMessage: IChatMessage = {
      id: message.id,
      chatId: message.chatId,
      messageType: message.messageType,
      message: '',
      createdAt: message.createdAt,
      user: {
        id: message.user.id,
        name: message.user.displayName || message.user.username,
        avatar: message.user.avatarUrl,
        vipLevel: fromVipLevel?.vipLevel ?? 0,
        vipLevelImage: fromVipLevel?.vipLevelImage ?? '',
        role: userRole ?? undefined,
      },
    };

    if (message.messageType === ChatMessageTypeEnum.MESSAGE) {
      baseMessage.message = message.message ?? '';
    } else if (
      message.messageType === ChatMessageTypeEnum.SERVER_NOTIFICATION_TIP &&
      this.isTipMetadata(message.metadata)
    ) {
      baseMessage.message = '';
      const tipMetadata = message.metadata;
      const recipientUser = recipientUsersMap.get(tipMetadata.recipientId);
      if (recipientUser) {
        const recipientVipLevel = userVipLevelsMap.get(tipMetadata.recipientId);
        baseMessage.metadata = {
          recipient: {
            id: recipientUser.id,
            name: recipientUser.displayName || recipientUser.username,
            avatar: recipientUser.avatarUrl,
            vipLevel: recipientVipLevel?.vipLevel ?? 0,
            vipLevelImage: recipientVipLevel?.vipLevelImage ?? '',
          },
          asset: tipMetadata.asset,
          amount: tipMetadata.amount,
        };
      } else {
        this.logger.warn('Recipient user not found for tip message', {
          messageId: message.id,
          recipientId: tipMetadata.recipientId,
        });
      }
    }

    return baseMessage;
  }
}
