import { Injectable } from '@nestjs/common';
import { AdminRole } from '@zetik/shared-entities';
import { UserRoleService } from '../../users/services/user-role.service';

@Injectable()
export class ChatModerationService {
  constructor(private readonly userRoleService: UserRoleService) {}

  async getUserRole(userId: string): Promise<AdminRole | null> {
    return this.userRoleService.getUserRole(userId);
  }

  async canModerate(userId: string): Promise<boolean> {
    return this.userRoleService.isAdminOrModerator(userId);
  }

  async canBanUsers(userId: string): Promise<boolean> {
    return this.userRoleService.canBanUsers(userId);
  }

  async canDeleteMessages(userId: string): Promise<boolean> {
    return this.userRoleService.isAdminOrModerator(userId);
  }
}
