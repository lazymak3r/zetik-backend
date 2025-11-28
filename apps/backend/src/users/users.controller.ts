import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserEntity } from '@zetik/shared-entities';
import { RequireTwoFactor } from '../auth/decorators/require-two-factor.decorator';
import { TwoFactorGuard } from '../auth/guards/two-factor.guard';
import { AllowSelfExcluded } from '../common/decorators/allow-self-excluded.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  ActivateAvatarResponseDto,
  AvatarGalleryResponseDto,
  AvatarUploadGalleryResponseDto,
  DeleteAvatarResponseDto,
} from './dto/avatar-upload.dto';
import { CookieConsentResponseDto } from './dto/cookie-consent-response.dto';
import { CreateSelfExclusionDto } from './dto/create-self-exclusion.dto';
import {
  ActivateDefaultAvatarDto,
  ActivateDefaultAvatarResponseDto,
} from './dto/default-avatar.dto';
import { ExtendSelfExclusionDto } from './dto/extend-self-exclusion.dto';
import { FilterSelfExclusionDto } from './dto/filter-self-exclusion.dto';
import { GamblingLimitsResponseDto } from './dto/gambling-limits-response.dto';
import { IgnoreUserDto } from './dto/ignore-user.dto';
import { IgnoredUserDto } from './dto/ignored-user.dto';
import { ModerationHistoryItemDto } from './dto/moderation-history.dto';
import { PublicUserProfileDto } from './dto/public-user-profile.dto';
import { SearchUsersResponseDto } from './dto/search-users-response.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { SelfExclusionResponseDto } from './dto/self-exclusion-response.dto';
import { UpdateEmailDto } from './dto/update-email.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { UserStatsDto } from './dto/user-stats.dto';
import { SelfExclusionService } from './self-exclusion.service';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly selfExclusionService: SelfExclusionService,
  ) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Returns the user profile', type: UserProfileDto })
  async getProfile(@CurrentUser() user: UserEntity): Promise<UserProfileDto> {
    return this.usersService.getUserProfile(user);
  }

  @Get('public/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get public user profile by ID',
    description: 'Returns public profile information for a user if their profile is not private',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the public user profile',
    type: PublicUserProfileDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 403,
    description: 'User profile is private',
  })
  async getPublicProfile(
    @Param('userId') userId: string,
    @CurrentUser() currentUser?: UserEntity,
  ): Promise<PublicUserProfileDto> {
    return this.usersService.getPublicUserProfile(userId, currentUser?.id);
  }

  @Get(':userId/moderation-history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get moderation history for a user',
    description: 'Returns history of mute and ban actions for the specified user',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns moderation history',
    type: [ModerationHistoryItemDto],
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getModerationHistory(@Param('userId') userId: string): Promise<ModerationHistoryItemDto[]> {
    const history = await this.usersService.getModerationHistory(userId);
    return history.map((item) => ({
      id: item.id,
      actionType: item.actionType,
      reason: item.reason,
      durationMinutes: item.durationMinutes,
      createdAt: item.createdAt,
      admin: {
        id: item.admin.id,
        username: item.admin.username,
        displayName: item.admin.displayName,
      },
    }));
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @AllowSelfExcluded()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update user profile',
    description:
      'Update user profile information including username, display name, avatar URL, etc. All fields are optional. Note: Use separate /users/profile/email endpoint to update email (requires 2FA).',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    type: UserProfileDto,
  })
  @ApiResponse({
    status: 409,
    description: 'Username already exists',
  })
  updateProfile(@CurrentUser() user: UserEntity, @Body() updateDto: UpdateUserProfileDto) {
    return this.usersService.updateUserProfile(user.id, updateDto);
  }

  @Patch('profile/email')
  @UseGuards(JwtAuthGuard, TwoFactorGuard)
  @RequireTwoFactor()
  @AllowSelfExcluded()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update user email - 2FA required if enabled',
    description:
      'Critical operation: If 2FA is enabled, must provide 2FA code to update email address. If 2FA is not enabled, code is optional.',
  })
  @ApiResponse({
    status: 200,
    description: 'Email updated successfully',
    type: UserProfileDto,
  })
  @ApiResponse({
    status: 401,
    description: '2FA enabled but code is missing or invalid',
  })
  @ApiResponse({
    status: 409,
    description: 'Email already exists',
  })
  updateEmail(@CurrentUser() user: UserEntity, @Body() updateDto: UpdateEmailDto) {
    return this.usersService.updateUserEmail(user.id, updateDto.email);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Search users by username',
    description:
      'Search for users by partial username matching. Returns public profiles that match the search criteria. Supports fuzzy matching and returns results ordered by relevance.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Returns array of user profiles matching the search criteria (without statistics). Use userId from results to get full profile via /v1/users/public/{userId}',
    type: [SearchUsersResponseDto],
    schema: {
      example: [
        {
          userName: 'john_doe',
          userId: '550e8400-e29b-41d4-a716-446655440000',
          createdAt: '2023-01-01T00:00:00.000Z',
          avatarUrl: 'https://example.com/avatar.jpg',
          vipLevel: {
            level: 1,
            name: 'Bronze I',
            imageUrl: 'user-level/bronze-1',
            percent: 42,
          },
        },
        {
          userName: 'testuser306560',
          userId: '123e4567-e89b-12d3-a456-426614174000',
          createdAt: '2023-02-15T10:30:00.000Z',
          avatarUrl: null,
          vipLevel: {
            level: 0,
            name: 'Unranked',
            imageUrl: null,
            percent: 15,
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  async searchUsers(@Query() searchDto: SearchUsersDto): Promise<SearchUsersResponseDto[]> {
    return this.usersService.searchUsers(searchDto);
  }

  @Get(':id/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user statistics' })
  @ApiResponse({ status: 200, description: 'Returns user statistics', type: UserStatsDto })
  async getUserStats(@Param('id') userId: string): Promise<UserStatsDto> {
    return this.usersService.getUserStats(userId);
  }

  @Post('self-exclusion')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new self-exclusion' })
  @ApiResponse({
    status: 201,
    description: 'Self-exclusion created successfully',
    type: SelfExclusionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict with existing self-exclusion',
  })
  async createSelfExclusion(
    @CurrentUser() user: UserEntity,
    @Body() createDto: CreateSelfExclusionDto,
  ): Promise<SelfExclusionResponseDto> {
    const result = await this.selfExclusionService.createSelfExclusion(
      user.id,
      user.email || '',
      createDto,
    );

    return result.exclusion;
  }

  @Get('self-exclusions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all self-exclusions for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of self-exclusions',
    type: [SelfExclusionResponseDto],
  })
  async getUserSelfExclusions(
    @CurrentUser() user: UserEntity,
  ): Promise<SelfExclusionResponseDto[]> {
    return this.selfExclusionService.getUserSelfExclusions(user.id);
  }

  @Get('self-exclusions/active')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get active self-exclusions for the current user',
    description:
      'Returns active self-exclusions with optional filtering by platform type (sports, casino, or platform)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns list of active self-exclusions',
    type: [SelfExclusionResponseDto],
  })
  async getActiveSelfExclusions(
    @CurrentUser() user: UserEntity,
    @Query() filterDto: FilterSelfExclusionDto,
  ): Promise<SelfExclusionResponseDto[]> {
    return this.selfExclusionService.getActiveSelfExclusions(user.id, filterDto.platformType);
  }

  @Delete('self-exclusions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a self-exclusion' })
  @ApiResponse({
    status: 200,
    description: 'Self-exclusion canceled successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Self-exclusion not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Cannot cancel this type of self-exclusion',
  })
  async cancelSelfExclusion(
    @CurrentUser() user: UserEntity,
    @Param('id') exclusionId: string,
  ): Promise<void> {
    return this.selfExclusionService.cancelSelfExclusion(user.id, exclusionId);
  }

  @Post('self-exclusion/extend/:cooldownId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Extend a cooldown to a temporary or permanent self-exclusion',
    description:
      'After a 24-hour cooldown expires, users have a 24-hour window to extend it to a temporary (1d/1w/1m/6m) or permanent exclusion. ' +
      'This operation is final and cannot be cancelled. If no action is taken within the 24-hour window, the account silently reverts to normal.',
  })
  @ApiResponse({
    status: 201,
    description: 'Cooldown extended successfully',
    type: SelfExclusionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request - not in post-cooldown window or invalid duration',
  })
  @ApiResponse({
    status: 404,
    description: 'Cooldown not found',
  })
  async extendSelfExclusion(
    @Param('cooldownId') cooldownId: string,
    @Body() dto: ExtendSelfExclusionDto,
    @CurrentUser() user: UserEntity,
  ): Promise<{ exclusion: SelfExclusionResponseDto }> {
    const duration = dto.durationDays ?? null;
    const userEmail = user.email || '';

    const exclusion = await this.selfExclusionService.extendSelfExclusion(
      user.id,
      cooldownId,
      duration,
      dto.platformType,
      userEmail,
    );

    return { exclusion: this.selfExclusionService.mapToResponseDto(exclusion) };
  }

  @Get('gambling-limits')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get gambling limits with remaining amounts',
    description:
      'Returns deposit and loss limits with calculated remaining amounts based on user activity',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns gambling limits with remaining amounts',
    type: GamblingLimitsResponseDto,
  })
  async getGamblingLimits(@CurrentUser() user: UserEntity): Promise<GamblingLimitsResponseDto> {
    return this.selfExclusionService.getGamblingLimits(user.id);
  }

  @Post('ignore')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Ignore a user',
    description: "Add a user to your ignored list. Ignored users' content will be hidden from you.",
  })
  @ApiResponse({
    status: 201,
    description: 'User ignored successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User to ignore not found',
  })
  @ApiResponse({
    status: 409,
    description: 'User is already ignored or cannot ignore yourself',
  })
  async ignoreUser(
    @CurrentUser() user: UserEntity,
    @Body() ignoreDto: IgnoreUserDto,
  ): Promise<void> {
    return this.usersService.ignoreUser(user.id, ignoreDto.userId);
  }

  @Delete('ignore/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Unignore a user',
    description: 'Remove a user from your ignored list.',
  })
  @ApiResponse({
    status: 200,
    description: 'User unignored successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'User is not ignored',
  })
  async unignoreUser(
    @CurrentUser() user: UserEntity,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.usersService.unignoreUser(user.id, userId);
  }

  @Get('ignored')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get ignored users',
    description: 'Get list of all users that you have ignored.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns list of ignored users',
    type: [IgnoredUserDto],
  })
  async getIgnoredUsers(@CurrentUser() user: UserEntity): Promise<IgnoredUserDto[]> {
    return this.usersService.getIgnoredUsers(user.id);
  }

  @Get('is-ignored/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Check if a user is ignored',
    description: 'Check if a specific user is in your ignored list.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns whether the user is ignored',
    schema: { type: 'object', properties: { isIgnored: { type: 'boolean' } } },
  })
  async isUserIgnored(
    @CurrentUser() user: UserEntity,
    @Param('userId') userId: string,
  ): Promise<{ isIgnored: boolean }> {
    const isIgnored = await this.usersService.isUserIgnored(user.id, userId);
    return { isIgnored };
  }

  @Post('avatars/upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upload avatar to gallery',
    description:
      'Upload a new avatar to your gallery and set it as active. Accepts JPEG, PNG, WebP images up to 5MB.',
  })
  @ApiResponse({
    status: 200,
    description: 'Avatar uploaded and set as active successfully',
    type: AvatarUploadGalleryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type or size',
  })
  async uploadAvatarToGallery(
    @CurrentUser() user: UserEntity,
    @UploadedFile() file: any,
  ): Promise<AvatarUploadGalleryResponseDto> {
    return this.usersService.uploadAvatarToGallery(user.id, file);
  }

  @Get('avatars')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user avatar gallery',
    description: 'Retrieve all avatars uploaded by the current user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Avatar gallery retrieved successfully',
    type: AvatarGalleryResponseDto,
  })
  async getUserAvatars(@CurrentUser() user: UserEntity): Promise<AvatarGalleryResponseDto> {
    return this.usersService.getUserAvatars(user.id);
  }

  @Patch('avatars/:avatarId/activate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Activate an avatar from gallery',
    description: 'Set a specific avatar from your gallery as the active avatar.',
  })
  @ApiResponse({
    status: 200,
    description: 'Avatar activated successfully',
    type: ActivateAvatarResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Avatar not found',
  })
  async activateAvatar(
    @CurrentUser() user: UserEntity,
    @Param('avatarId') avatarId: string,
  ): Promise<ActivateAvatarResponseDto> {
    return this.usersService.activateAvatar(user.id, avatarId);
  }

  @Delete('avatars/:avatarId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete an avatar from gallery',
    description:
      'Delete a specific avatar from your gallery. If deleted avatar was active, the most recent avatar will be activated.',
  })
  @ApiResponse({
    status: 200,
    description: 'Avatar deleted successfully',
    type: DeleteAvatarResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Avatar not found',
  })
  async deleteAvatar(
    @CurrentUser() user: UserEntity,
    @Param('avatarId') avatarId: string,
  ): Promise<DeleteAvatarResponseDto> {
    return this.usersService.deleteAvatar(user.id, avatarId);
  }

  // ===== Default Avatar Endpoints =====

  @Post('avatars/default/activate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Activate a default system avatar',
    description:
      'Select and activate one of the default system avatars. This will deactivate any personal avatars.',
  })
  @ApiBody({
    type: 'object',
    schema: {
      properties: {
        defaultAvatarId: {
          type: 'string',
          format: 'uuid',
          description: 'ID of the default avatar to activate',
          example: '550e8400-e29b-41d4-a716-446655440000',
        },
      },
      required: ['defaultAvatarId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Default avatar activated successfully',
    type: ActivateDefaultAvatarResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid default avatar ID or avatar not available',
  })
  @ApiResponse({
    status: 404,
    description: 'Default avatar not found',
  })
  async activateDefaultAvatar(
    @CurrentUser() user: UserEntity,
    @Body() dto: ActivateDefaultAvatarDto,
  ): Promise<ActivateDefaultAvatarResponseDto> {
    return this.usersService.activateDefaultAvatar(user.id, dto);
  }

  @Post('accept-cookies')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @AllowSelfExcluded()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record cookie consent acceptance' })
  @ApiResponse({ status: 200, type: CookieConsentResponseDto })
  async acceptCookies(@CurrentUser() user: UserEntity): Promise<CookieConsentResponseDto> {
    const acceptedAt = await this.usersService.setCookieConsent(user.id);
    return {
      success: true,
      acceptedAt,
    };
  }
}
