import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminActionTypeEnum, AdminEntity, AdminRole } from '@zetik/shared-entities';
import { AuditLog } from '../audit/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../audit/interceptors/audit-log.interceptor';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AssignAdminRoleDto } from './dto/assign-admin-role.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserTransactionsResponseDto } from './dto/user-transactions-response.dto';
import { IFrontendUserEntity, IPaginatedUsersResponse, UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get users with comprehensive filtering and search' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limit results' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Offset results' })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search by username or email',
  })
  @ApiQuery({
    name: 'isBanned',
    required: false,
    type: Boolean,
    description: 'Filter by banned status',
  })
  @ApiQuery({
    name: 'banned',
    required: false,
    type: Boolean,
    description: 'Filter by banned status (legacy)',
  })
  @ApiQuery({
    name: 'strategy',
    required: false,
    type: String,
    description: 'Filter by registration strategy',
  })
  @ApiQuery({ name: 'sortBy', required: false, type: String, description: 'Sort by field' })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    type: String,
    description: 'Sort order: ASC or DESC',
  })
  @ApiResponse({
    schema: {
      properties: {
        items: { type: 'array', items: { $ref: '#/components/schemas/UserResponseDto' } },
        total: { type: 'number' },
        page: { type: 'number' },
        pages: { type: 'number' },
      },
    },
  })
  @AuditLog({
    action: AdminActionTypeEnum.VIEW,
    resource: 'users',
    getDetails: () => ({ action: 'list-users' }),
  })
  async getUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('search') search?: string,
    @Query('isBanned') isBanned?: boolean,
    @Query('banned') banned?: boolean,
    @Query('strategy') strategy?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ): Promise<IPaginatedUsersResponse> {
    // Convert page to offset if provided
    if (page && !offset) {
      offset = (page - 1) * (limit || 20);
    }

    // Handle isBanned parameter
    if (isBanned !== undefined) {
      banned = isBanned;
    }

    // If search is provided, use search functionality
    if (search) {
      const searchResults = await this.usersService.searchUsers(search, limit);
      return {
        items: searchResults,
        total: searchResults.length,
        page: 1,
        pages: 1,
      };
    }

    // If banned filter is explicitly true, use banned users functionality
    if (banned === true) {
      const bannedUsers = await this.usersService.findBannedUsers(limit, offset);
      return {
        items: bannedUsers,
        total: bannedUsers.length,
        page: page || 1,
        pages: 1,
      };
    }

    // Otherwise use general findAll with all filters
    return this.usersService.findAll({
      limit,
      offset,
      search,
      banned,
      strategy,
      sortBy,
      sortOrder,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get comprehensive users statistics' })
  @ApiResponse({
    schema: {
      properties: {
        total: { type: 'number' },
        banned: { type: 'number' },
        active: { type: 'number' },
        byStrategy: { type: 'object' },
        recentRegistrations: { type: 'number' },
        recentBans: { type: 'number' },
      },
    },
  })
  @AuditLog({
    action: AdminActionTypeEnum.VIEW,
    resource: 'users',
    getDetails: () => ({ type: 'comprehensive-statistics' }),
  })
  async getUsersStats(): Promise<{
    total: number;
    banned: number;
    active: number;
    byStrategy: Record<string, number>;
    recentRegistrations: number;
    recentBans: number;
  }> {
    return this.usersService.getComprehensiveStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user details by ID with optional activity data' })
  @ApiQuery({
    name: 'includeActivity',
    required: false,
    type: Boolean,
    description: 'Include user activity data',
  })
  @ApiResponse({ type: UserResponseDto })
  @AuditLog({
    action: AdminActionTypeEnum.VIEW,
    resource: 'users',
    getResourceId: (args) => args[0] as string,
  })
  async getUserById(
    @Param('id') id: string,
    @Query('includeActivity') includeActivity?: boolean,
  ): Promise<
    | IFrontendUserEntity
    | {
        userId: string;
        registrationDate: Date;
        lastActivity: Date;
        totalSessions: number;
        bannedHistory: any[];
      }
  > {
    if (includeActivity) {
      return this.usersService.getUserActivity(id);
    }
    return this.usersService.findById(id);
  }

  @Get(':id/transactions')
  @ApiOperation({ summary: 'Get user transactions with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiResponse({ type: UserTransactionsResponseDto })
  async getUserTransactions(
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.getUserTransactions(id, page || 1, limit || 10);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user by ID' })
  @ApiResponse({ type: UserResponseDto })
  @AuditLog({
    action: AdminActionTypeEnum.UPDATE,
    resource: 'users',
    getResourceId: (args) => args[0] as string,
  })
  async updateUser(
    @Param('id') id: string,
    @Body() updateData: { isBanned?: boolean; [key: string]: any },
  ): Promise<IFrontendUserEntity> {
    // Handle ban/unban specifically
    if (updateData.isBanned !== undefined) {
      if (updateData.isBanned) {
        return this.usersService.banUser(id);
      } else {
        return this.usersService.unbanUser(id);
      }
    }

    // For other updates, you can add more logic here
    throw new Error('Only isBanned updates are currently supported');
  }

  @Post(':id/adjust-balance')
  @ApiOperation({ summary: 'Adjust user balance' })
  @ApiResponse({ type: UserResponseDto })
  @AuditLog({
    action: AdminActionTypeEnum.UPDATE,
    resource: 'users',
    getResourceId: (args) => args[0] as string,
  })
  async adjustBalance(
    @Param('id') id: string,
    @Body() adjustBalanceDto: { asset: string; amount: number; reason?: string },
  ): Promise<IFrontendUserEntity> {
    return this.usersService.adjustBalance(
      id,
      adjustBalanceDto.asset,
      adjustBalanceDto.amount,
      adjustBalanceDto.reason,
    );
  }

  @Patch('bulk')
  @ApiOperation({ summary: 'Perform bulk actions on users (ban/unban)' })
  @ApiResponse({ type: [UserResponseDto] })
  @AuditLog({
    action: AdminActionTypeEnum.UPDATE,
    resource: 'users',
    getDetails: () => ({ action: 'bulk-action' }),
  })
  async bulkUserActions(
    @Body()
    bulkActionDto: {
      userIds: string[];
      action: 'ban' | 'unban';
      reason?: string;
    },
  ): Promise<IFrontendUserEntity[]> {
    if (bulkActionDto.action === 'ban') {
      return this.usersService.bulkBanUsers(bulkActionDto.userIds);
    } else {
      // Handle bulk unban
      const results: IFrontendUserEntity[] = [];
      for (const userId of bulkActionDto.userIds) {
        const result = await this.usersService.unbanUser(userId);
        results.push(result);
      }
      return results;
    }
  }

  @Patch(':id/assign-admin-role')
  @UseGuards(RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Assign admin role to a user (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Role assigned successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @AuditLog({
    action: AdminActionTypeEnum.UPDATE,
    resource: 'users',
    getResourceId: (args) => args[0] as string,
  })
  async assignAdminRole(
    @Param('id') userId: string,
    @Body() assignRoleDto: AssignAdminRoleDto,
    @CurrentAdmin() admin: AdminEntity,
  ): Promise<{ success: boolean; userId: string; role: AdminRole }> {
    await this.usersService.assignAdminRole(
      userId,
      assignRoleDto.role,
      admin.id,
      assignRoleDto.email,
      assignRoleDto.name,
    );
    return { success: true, userId, role: assignRoleDto.role };
  }

  @Get(':id/admin-role')
  @UseGuards(RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get admin role for a user (Super Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User role retrieved successfully',
    schema: {
      required: ['role', 'userId'],
      properties: {
        role: { type: 'string', enum: ['moderator', 'admin', 'super_admin'], nullable: true },
        userId: { type: 'string' },
        adminId: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @AuditLog({
    action: AdminActionTypeEnum.VIEW,
    resource: 'users',
    getResourceId: (args) => args[0] as string,
  })
  async getUserAdminRole(
    @Param('id') userId: string,
  ): Promise<{ role: AdminRole | null; userId: string; adminId?: string }> {
    return this.usersService.getUserAdminRole(userId);
  }

  @Delete(':id/admin-role')
  @UseGuards(RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Remove admin role from a user (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Role removed successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @AuditLog({
    action: AdminActionTypeEnum.UPDATE,
    resource: 'users',
    getResourceId: (args) => args[0] as string,
  })
  async removeAdminRole(
    @Param('id') userId: string,
  ): Promise<{ success: boolean; userId: string }> {
    await this.usersService.removeAdminRole(userId);
    return { success: true, userId };
  }

  @Post(':id/mute')
  @ApiOperation({ summary: 'Mute a user' })
  @ApiResponse({ status: 200, description: 'User muted successfully' })
  @AuditLog({
    action: AdminActionTypeEnum.UPDATE,
    resource: 'users',
    getResourceId: (args) => args[0] as string,
  })
  async muteUser(
    @Param('id') userId: string,
    @Body() muteDto: { durationMinutes: number; reason?: string },
    @CurrentAdmin() admin: AdminEntity,
  ): Promise<{ success: boolean; userId: string }> {
    if (!admin.userId && admin.role !== AdminRole.SUPER_ADMIN) {
      throw new BadRequestException(
        'Admin user must be linked to a user account to perform moderation actions',
      );
    }
    return this.usersService.muteUser(
      userId,
      muteDto.durationMinutes,
      muteDto.reason,
      admin.userId || null,
    );
  }

  @Delete(':id/mute')
  @ApiOperation({ summary: 'Unmute a user' })
  @ApiResponse({ status: 200, description: 'User unmuted successfully' })
  @AuditLog({
    action: AdminActionTypeEnum.UPDATE,
    resource: 'users',
    getResourceId: (args) => args[0] as string,
  })
  async unmuteUser(
    @Param('id') userId: string,
    @CurrentAdmin() admin: AdminEntity,
  ): Promise<{ success: boolean; userId: string }> {
    if (!admin.userId && admin.role !== AdminRole.SUPER_ADMIN) {
      throw new BadRequestException(
        'Admin user must be linked to a user account to perform moderation actions',
      );
    }
    return this.usersService.unmuteUser(userId, admin.userId || null);
  }
}
