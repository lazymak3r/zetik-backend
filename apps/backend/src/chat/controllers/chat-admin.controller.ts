import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { AdminEntity, AdminRole } from '@zetik/shared-entities';
import { isUUID } from 'class-validator';
import { Repository } from 'typeorm';
import { AdminAccessGuard } from '../../bonus/guards/admin-access.guard';
import { UserMuteService } from '../../users/services/user-mute.service';
import { MuteUserDto } from './dto/mute-user.dto';

@ApiExcludeController()
@Controller('chat-admin')
@UseGuards(AdminAccessGuard)
export class ChatAdminController {
  constructor(
    private readonly userMuteService: UserMuteService,
    @InjectRepository(AdminEntity)
    private readonly adminRepository: Repository<AdminEntity>,
  ) {}

  @Post('users/:userId/mute')
  @ApiOperation({ summary: 'Mute a user (Admin Panel)' })
  @ApiParam({ name: 'userId', description: 'User ID to mute' })
  @ApiResponse({ status: 200, description: 'User muted successfully' })
  async muteUser(
    @Param('userId') userId: string,
    @Body() muteDto: MuteUserDto,
    @Headers('x-admin-id') adminIdHeader?: string,
  ): Promise<{ success: boolean; userId: string }> {
    const adminId = adminIdHeader && isUUID(adminIdHeader) ? adminIdHeader : null;
    let adminRole: AdminRole | null = null;

    if (adminId) {
      const admin = await this.adminRepository.findOne({
        where: { id: adminId },
        select: ['id', 'isActive', 'role'],
      });

      if (!admin || !admin.isActive) {
        throw new ForbiddenException('Invalid or inactive admin account');
      }

      adminRole = admin.role;
    }

    await this.userMuteService.muteUser(
      userId,
      muteDto.durationMinutes,
      adminId,
      muteDto.reason,
      adminRole,
    );
    return { success: true, userId };
  }

  @Delete('users/:userId/mute')
  @ApiOperation({ summary: 'Unmute a user (Admin Panel)' })
  @ApiParam({ name: 'userId', description: 'User ID to unmute' })
  @ApiResponse({ status: 200, description: 'User unmuted successfully' })
  async unmuteUser(
    @Param('userId') userId: string,
    @Headers('x-admin-id') adminIdHeader?: string,
  ): Promise<{ success: boolean; userId: string }> {
    const adminId = adminIdHeader && isUUID(adminIdHeader) ? adminIdHeader : null;

    if (adminId) {
      const admin = await this.adminRepository.findOne({
        where: { id: adminId },
        select: ['id', 'isActive'],
      });

      if (!admin || !admin.isActive) {
        throw new ForbiddenException('Invalid or inactive admin account');
      }
    }

    await this.userMuteService.unmuteUser(userId, adminId);
    return { success: true, userId };
  }
}
