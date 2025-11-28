import { AdminRole, AssetTypeEnum, ChatMessageTypeEnum, UserEntity } from '@zetik/shared-entities';
import type BigNumber from 'bignumber.js';

export interface IChat {
  id: string;
  name: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITipMessageMetadata {
  recipient: {
    id: string;
    name: string;
    avatar?: string;
    vipLevel: number;
    vipLevelImage: string;
  };
  asset: AssetTypeEnum;
  amount: string;
}

export type ChatMessageMetadata = ITipMessageMetadata;

export interface IChatMessage {
  id: string;
  chatId: string;
  messageType: ChatMessageTypeEnum;
  user: {
    id: string;
    name: string;
    avatar?: string;
    vipLevel: number;
    vipLevelImage: string;
    role?: AdminRole;
  };
  message: string;
  metadata?: ChatMessageMetadata;
  createdAt: Date;
}

export interface IChatUser {
  id: string;
  name: string;
  avatar?: string;
  role?: AdminRole;
}

export interface ITipNotification {
  sender: UserEntity;
  recipient: UserEntity;
  asset: AssetTypeEnum;
  amount: BigNumber;
  timestamp?: Date;
}
