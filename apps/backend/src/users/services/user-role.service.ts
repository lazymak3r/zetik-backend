import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AdminEntity, AdminRole } from '@zetik/shared-entities';
import { Repository } from 'typeorm';

@Injectable()
export class UserRoleService {
  private readonly logger = new Logger(UserRoleService.name);

  constructor(
    @InjectRepository(AdminEntity)
    private readonly adminRepository: Repository<AdminEntity>,
  ) {}

  async getUserRole(userId: string): Promise<AdminRole | null> {
    try {
      const admin = await this.adminRepository.findOne({
        where: { userId },
        select: ['role'],
      });

      return admin?.role ?? null;
    } catch (error) {
      this.logger.error(`Failed to get user role for userId ${userId}:`, error);
      return null;
    }
  }

  async isAdminOrModerator(userId: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return role === AdminRole.ADMIN || role === AdminRole.MODERATOR;
  }

  async canBanUsers(userId: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return role === AdminRole.ADMIN;
  }

  async isModerator(userId: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return role === AdminRole.MODERATOR;
  }

  async isAdmin(userId: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return role === AdminRole.ADMIN;
  }
}
