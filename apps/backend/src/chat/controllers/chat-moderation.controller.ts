import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminRole, UserEntity } from '@zetik/shared-entities';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UserMuteService } from '../../users/services/user-mute.service';
import { UsersService } from '../../users/users.service';
import { ChatRoles } from '../decorators/chat-roles.decorator';
import { ChatRoleGuard } from '../guards/chat-role.guard';
import { ChatService } from '../services/chat.service';
import { BanUserDto } from './dto/ban-user.dto';
import { MuteUserDto } from './dto/mute-user.dto';

@ApiTags('Chat Moderation')
@ApiBearerAuth()
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatModerationController {
  constructor(
    private readonly chatService: ChatService,
    private readonly userMuteService: UserMuteService,
    private readonly usersService: UsersService,
  ) {}

  @Delete('messages/:id')
  @UseGuards(ChatRoleGuard)
  @ChatRoles(AdminRole.MODERATOR, AdminRole.ADMIN)
  @ApiOperation({ summary: 'Delete a chat message' })
  @ApiParam({ name: 'id', description: 'Message ID' })
  @ApiResponse({ status: 200, description: 'Message deleted successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Message not found' })
  async deleteMessage(
    @Param('id') messageId: string,
    @CurrentUser() user: UserEntity,
  ): Promise<{ success: boolean; messageId: string }> {
    await this.chatService.deleteMessage(messageId, user.id);
    return { success: true, messageId };
  }

  @Post('users/:userId/mute')
  @UseGuards(ChatRoleGuard)
  @ChatRoles(AdminRole.MODERATOR, AdminRole.ADMIN)
  @ApiOperation({ summary: 'Mute a user' })
  @ApiParam({ name: 'userId', description: 'User ID to mute' })
  @ApiResponse({ status: 200, description: 'User muted successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async muteUser(
    @Param('userId') userId: string,
    @Body() muteDto: MuteUserDto,
    @CurrentUser() user: UserEntity,
  ): Promise<{ success: boolean; userId: string }> {
    await this.userMuteService.muteUser(userId, muteDto.durationMinutes, user.id, muteDto.reason);
    return { success: true, userId };
  }

  @Delete('users/:userId/mute')
  @UseGuards(ChatRoleGuard)
  @ChatRoles(AdminRole.MODERATOR, AdminRole.ADMIN)
  @ApiOperation({ summary: 'Unmute a user' })
  @ApiParam({ name: 'userId', description: 'User ID to unmute' })
  @ApiResponse({ status: 200, description: 'User unmuted successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async unmuteUser(
    @Param('userId') userId: string,
    @CurrentUser() user: UserEntity,
  ): Promise<{ success: boolean; userId: string }> {
    await this.userMuteService.unmuteUser(userId, user.id);
    return { success: true, userId };
  }

  @Get('users/me/mute')
  @ApiOperation({ summary: 'Get current user mute information' })
  @ApiResponse({ status: 200, description: 'Returns mute information or null if not muted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyMuteInfo(
    @CurrentUser() user: UserEntity,
  ): Promise<{ mutedUntil: Date | null; reason: string | null } | null> {
    const muteInfo = await this.userMuteService.getMuteInfo(user.id);
    if (!muteInfo) {
      return null;
    }
    return {
      mutedUntil: muteInfo.mutedUntil ?? null,
      reason: muteInfo.muteReason ?? null,
    };
  }

  @Post('users/:userId/ban')
  @UseGuards(ChatRoleGuard)
  @ChatRoles(AdminRole.ADMIN)
  @ApiOperation({ summary: 'Ban a user' })
  @ApiParam({ name: 'userId', description: 'User ID to ban' })
  @ApiResponse({ status: 200, description: 'User banned successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async banUser(
    @Param('userId') userId: string,
    @Body() banDto: BanUserDto,
    @CurrentUser() user: UserEntity,
  ): Promise<{ success: boolean; userId: string }> {
    await this.usersService.banUser(userId, user.id, banDto.durationMinutes, banDto.reason);
    return { success: true, userId };
  }

  @Delete('users/:userId/ban')
  @UseGuards(ChatRoleGuard)
  @ChatRoles(AdminRole.ADMIN)
  @ApiOperation({ summary: 'Unban a user' })
  @ApiParam({ name: 'userId', description: 'User ID to unban' })
  @ApiResponse({ status: 200, description: 'User unbanned successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async unbanUser(
    @Param('userId') userId: string,
    @CurrentUser() user: UserEntity,
  ): Promise<{ success: boolean; userId: string }> {
    await this.usersService.unbanUser(userId, user.id);
    return { success: true, userId };
  }

  @Get('users/:userId/mute')
  @UseGuards(ChatRoleGuard)
  @ChatRoles(AdminRole.MODERATOR, AdminRole.ADMIN)
  @ApiOperation({ summary: 'Get user mute information' })
  @ApiParam({ name: 'userId', description: 'User ID to get mute info for' })
  @ApiResponse({
    status: 200,
    description: 'Returns mute information or null if not muted',
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getUserMuteInfo(
    @Param('userId') userId: string,
  ): Promise<{ mutedUntil: Date | null; reason: string | null } | null> {
    const muteInfo = await this.userMuteService.getMuteInfo(userId);
    if (!muteInfo) {
      return null;
    }
    return {
      mutedUntil: muteInfo.mutedUntil ?? null,
      reason: muteInfo.muteReason ?? null,
    };
  }
}
