import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminEntity, AdminRole } from '@zetik/shared-entities';
import { AuthService } from '../auth/auth.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { GamesService } from '../games/games.service';
import { ApiKeyDto, CreateApiKeyDto, UpdateApiKeyDto } from './dto/api-key.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import {
  BonusSettingsDto,
  EmailSettingsDto,
  GameSettingsDto,
  PlatformSettingsDto,
  SecuritySettingsDto,
  SettingsCategoryDto,
  SystemSettingDto,
  UpdateGameSettingsDto,
  UpdatePlatformSettingsDto,
  UpdateSettingDto,
} from './dto/system-settings.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly authService: AuthService,
    private readonly gamesService: GamesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all system settings grouped by category' })
  @ApiResponse({
    status: 200,
    description: 'List of settings by category',
    type: [SettingsCategoryDto],
  })
  async getAllSettings(): Promise<SettingsCategoryDto[]> {
    return this.settingsService.getAllSettings();
  }

  @Get('admins')
  @ApiOperation({ summary: 'Get all admin users' })
  @ApiResponse({
    status: 200,
    description: 'List of admin users',
  })
  async getAdminUsers() {
    return this.settingsService.getAdminUsers();
  }

  @Get('api-keys')
  @ApiOperation({ summary: 'Get all API keys' })
  @ApiResponse({
    status: 200,
    description: 'List of API keys',
    type: [ApiKeyDto],
  })
  async getApiKeys(): Promise<ApiKeyDto[]> {
    return this.settingsService.getApiKeys();
  }

  @Get('platform')
  @ApiOperation({ summary: 'Get platform settings' })
  @ApiResponse({
    status: 200,
    description: 'Platform settings',
    type: PlatformSettingsDto,
  })
  async getPlatformSettings(): Promise<PlatformSettingsDto> {
    return this.settingsService.getPlatformSettings();
  }

  @Patch('platform')
  @ApiOperation({ summary: 'Update platform settings' })
  @ApiResponse({
    status: 200,
    description: 'Updated platform settings',
    type: PlatformSettingsDto,
  })
  async updatePlatformSettings(
    @Body() updateDto: UpdatePlatformSettingsDto,
    @CurrentAdmin() admin: AdminEntity,
  ): Promise<PlatformSettingsDto> {
    return this.settingsService.updatePlatformSettings(updateDto, admin.id);
  }

  @Get('security')
  @ApiOperation({ summary: 'Get security settings' })
  @ApiResponse({
    status: 200,
    description: 'Security settings',
    type: SecuritySettingsDto,
  })
  async getSecuritySettings(): Promise<SecuritySettingsDto> {
    return this.settingsService.getSecuritySettings();
  }

  @Get('bonus')
  @ApiOperation({ summary: 'Get bonus settings' })
  @ApiResponse({
    status: 200,
    description: 'Bonus settings',
    type: BonusSettingsDto,
  })
  async getBonusSettings(): Promise<BonusSettingsDto> {
    return this.settingsService.getBonusSettings();
  }

  @Get('email')
  @ApiOperation({ summary: 'Get email settings' })
  @ApiResponse({
    status: 200,
    description: 'Email settings',
    type: EmailSettingsDto,
  })
  async getEmailSettings(): Promise<EmailSettingsDto> {
    return this.settingsService.getEmailSettings();
  }

  @Get('games')
  @ApiOperation({ summary: 'Get game settings including bet limits and max payouts' })
  @ApiResponse({
    status: 200,
    description: 'Game settings',
    type: GameSettingsDto,
  })
  async getGameSettings(): Promise<GameSettingsDto> {
    return this.settingsService.getGameSettings();
  }

  @Patch('games')
  @ApiOperation({ summary: 'Update game settings including bet limits and max payouts' })
  @ApiResponse({
    status: 200,
    description: 'Updated game settings',
    type: GameSettingsDto,
  })
  async updateGameSettings(
    @Body() updateDto: UpdateGameSettingsDto,
    @CurrentAdmin() admin: AdminEntity,
  ): Promise<GameSettingsDto> {
    return this.settingsService.updateGameSettings(updateDto, admin.id);
  }

  @Get('category/:category')
  @ApiOperation({ summary: 'Get settings by category' })
  @ApiResponse({
    status: 200,
    description: 'Settings for the specified category',
    type: [SystemSettingDto],
  })
  async getSettingsByCategory(@Param('category') category: string): Promise<SystemSettingDto[]> {
    return this.settingsService.getSettingsByCategory(category);
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Update a specific setting' })
  @ApiResponse({
    status: 200,
    description: 'Updated setting',
    type: SystemSettingDto,
  })
  async updateSetting(
    @Param('key') key: string,
    @Body() updateDto: UpdateSettingDto,
    @CurrentAdmin() admin: AdminEntity,
  ): Promise<SystemSettingDto> {
    return this.settingsService.updateSetting(key, updateDto, admin.id);
  }

  @Post('api-keys')
  @ApiOperation({ summary: 'Create a new API key' })
  @ApiResponse({
    status: 201,
    description: 'The created API key',
    type: ApiKeyDto,
  })
  async createApiKey(
    @Body() createDto: CreateApiKeyDto,
    @CurrentAdmin() admin: AdminEntity,
  ): Promise<ApiKeyDto> {
    return this.settingsService.createApiKey(createDto, admin.id);
  }

  @Put('api-keys/:id')
  @ApiOperation({ summary: 'Update an API key' })
  @ApiResponse({ status: 200, description: 'The updated API key', type: ApiKeyDto })
  async updateApiKey(
    @Param('id') id: string,
    @Body() updateDto: UpdateApiKeyDto,
  ): Promise<ApiKeyDto> {
    return this.settingsService.updateApiKey(id, updateDto);
  }

  @Delete('api-keys/:id')
  @ApiOperation({ summary: 'Delete an API key' })
  @ApiResponse({
    status: 204,
    description: 'API key deleted successfully',
  })
  async deleteApiKey(@Param('id') id: string): Promise<void> {
    return this.settingsService.deleteApiKey(id);
  }

  @Get('admins/check-email/:email')
  @ApiOperation({ summary: 'Check if user with email exists' })
  @ApiResponse({
    status: 200,
    description: 'User existence check result',
    schema: {
      type: 'object',
      properties: {
        exists: { type: 'boolean' },
        userId: { type: 'string', nullable: true },
        username: { type: 'string', nullable: true },
      },
    },
  })
  async checkEmail(@Param('email') email: string) {
    return await this.settingsService.checkEmail(email);
  }

  @Post('admins')
  @ApiOperation({ summary: 'Create a new admin user' })
  @ApiResponse({ status: 201, description: 'The created admin user' })
  async createAdmin(@Body() createAdminDto: CreateAdminDto) {
    return this.authService.createAdmin(createAdminDto);
  }

  @Patch('admins/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update admin user (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Admin updated successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateAdmin(@Param('id') id: string, @Body() updateAdminDto: UpdateAdminDto) {
    if (updateAdminDto.role !== undefined) {
      await this.settingsService.updateAdminRole(id, updateAdminDto.role);
    }

    if (updateAdminDto.email || updateAdminDto.name || updateAdminDto.password) {
      await this.settingsService.updateAdminProfile(id, {
        email: updateAdminDto.email,
        name: updateAdminDto.name,
        password: updateAdminDto.password,
      });
    }

    return { success: true };
  }

  @Put()
  @ApiOperation({ summary: 'Update general settings' })
  @ApiResponse({
    status: 200,
    description: 'Updated general settings',
    type: [SystemSettingDto],
  })
  async updateGeneralSettings(
    @Body() settings: Record<string, any>,
    @CurrentAdmin() admin: AdminEntity,
  ): Promise<SystemSettingDto[]> {
    return this.settingsService.updateGeneralSettings(settings, admin.id);
  }

  @Get('general')
  @ApiOperation({ summary: 'Get general settings in flat format' })
  @ApiResponse({
    status: 200,
    description: 'General settings in flat format',
  })
  async getGeneralSettings(): Promise<Record<string, any>> {
    return this.settingsService.getGeneralSettings();
  }

  @Get('game-configs')
  @ApiOperation({ summary: 'Get game configurations for admin panel' })
  @ApiResponse({
    status: 200,
    description: 'Simple array of game configurations',
  })
  async getGameConfigs() {
    try {
      const result = await this.gamesService.getGameConfigs();
      return result;
    } catch (error) {
      console.error('*** ERROR in settings controller game configs:', error);
      throw error;
    }
  }
}
