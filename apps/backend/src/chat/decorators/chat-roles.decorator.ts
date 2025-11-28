import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '@zetik/shared-entities';

export const CHAT_ROLES_KEY = 'chatRoles';

export const ChatRoles = (...roles: AdminRole[]) => SetMetadata(CHAT_ROLES_KEY, roles);
