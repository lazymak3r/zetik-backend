import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PasswordUtil } from '@zetik/common';
import {
  AdminEntity,
  AdminRole,
  ApiKeyEntity,
  SystemSettingEntity,
  UserEntity,
} from '@zetik/shared-entities';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { ApiKeyDto, CreateApiKeyDto, UpdateApiKeyDto } from './dto/api-key.dto';
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

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SystemSettingEntity)
    private settingsRepository: Repository<SystemSettingEntity>,
    @InjectRepository(AdminEntity)
    private adminRepository: Repository<AdminEntity>,
    @InjectRepository(ApiKeyEntity)
    private apiKeyRepository: Repository<ApiKeyEntity>,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
  ) {}

  async getAllSettings(): Promise<SettingsCategoryDto[]> {
    const settings = await this.settingsRepository.find({
      order: { category: 'ASC', key: 'ASC' },
    });

    const categorized = settings.reduce(
      (acc, setting) => {
        if (!acc[setting.category]) {
          acc[setting.category] = [];
        }
        acc[setting.category].push(this.mapToDto(setting));
        return acc;
      },
      {} as Record<string, SystemSettingDto[]>,
    );

    return Object.entries(categorized).map(([category, settings]) => ({
      category,
      settings,
    }));
  }

  async getSettingsByCategory(category: string): Promise<SystemSettingDto[]> {
    const settings = await this.settingsRepository.find({
      where: { category },
      order: { key: 'ASC' },
    });

    return settings.map((s) => this.mapToDto(s));
  }

  async updateSetting(
    key: string,
    updateDto: UpdateSettingDto,
    adminId: string,
  ): Promise<SystemSettingDto> {
    const setting = await this.settingsRepository.findOne({ where: { key } });

    if (!setting) {
      throw new NotFoundException(`Setting with key ${key} not found`);
    }

    setting.value = updateDto.value;
    setting.updatedBy = adminId;

    await this.settingsRepository.save(setting);

    return this.mapToDto(setting);
  }

  async getPlatformSettings(): Promise<PlatformSettingsDto> {
    const settings = await this.getSettingsByCategory('platform');
    return this.mapToTypedSettings(settings, {
      maintenanceMode: false,
      maintenanceMessage: '',
      registrationEnabled: true,
      withdrawalsEnabled: true,
      depositsEnabled: true,
      minDepositAmount: '0.0001',
      minWithdrawalAmount: '0.001',
      maxWithdrawalDaily: '10',
      withdrawalFeePercent: 0,
      kycRequired: false,
      kycThreshold: '1000',
    }) as PlatformSettingsDto;
  }

  async updatePlatformSettings(
    updateDto: UpdatePlatformSettingsDto,
    adminId: string,
  ): Promise<PlatformSettingsDto> {
    for (const [key, value] of Object.entries(updateDto)) {
      if (value !== undefined) {
        await this.updateOrCreateSetting(`platform.${key}`, value, 'platform', adminId);
      }
    }

    return this.getPlatformSettings();
  }

  async getSecuritySettings(): Promise<SecuritySettingsDto> {
    const settings = await this.getSettingsByCategory('security');
    return this.mapToTypedSettings(settings, {
      twoFactorRequired: false,
      sessionTimeout: 3600,
      maxLoginAttempts: 5,
      ipWhitelist: [],
      suspiciousActivityThreshold: 10,
      autoLogoutInactivity: 1800,
    }) as SecuritySettingsDto;
  }

  async getBonusSettings(): Promise<BonusSettingsDto> {
    const settings = await this.getSettingsByCategory('bonus');
    return this.mapToTypedSettings(settings, {
      welcomeBonusEnabled: true,
      welcomeBonusAmount: '10',
      dailyBonusEnabled: true,
      rakebackEnabled: true,
      rakebackPercent: 5,
      vipProgramEnabled: true,
      affiliateEnabled: true,
      affiliateCommissionPercent: 25,
    }) as BonusSettingsDto;
  }

  async getEmailSettings(): Promise<EmailSettingsDto> {
    const settings = await this.getSettingsByCategory('email');
    const mapped = this.mapToTypedSettings(settings, {
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      smtpPassword: '',
      smtpSecure: false,
      fromEmail: 'noreply@zetik.casino',
      fromName: 'Zetik Casino',
      emailVerificationRequired: true,
    }) as EmailSettingsDto;

    // Don't expose password
    if (mapped.smtpPassword) {
      mapped.smtpPassword = '********';
    }

    return mapped;
  }

  async getGameSettings(): Promise<GameSettingsDto> {
    const settings = await this.getSettingsByCategory('games');
    return this.mapToTypedSettings(settings, {
      crashMaxPayout: '100000.00000000', // Default 100k max payout
      crashMinBet: '0.00000001', // Default min bet
      crashMaxBet: '1000.00000000', // Default max bet
      blackjackMinBet: '0.00000001',
      blackjackMaxBet: '1000.00000000',
      diceMinBet: '0.00000001',
      diceMaxBet: '1000.00000000',
      limboMinBet: '0.00000001',
      limboMaxBet: '1000.00000000',
      minesMinBet: '0.00000001',
      minesMaxBet: '1000.00000000',
      plinkoMinBet: '0.00000001',
      plinkoMaxBet: '1000.00000000',
      rouletteMinBet: '0.00000001',
      rouletteMaxBet: '1000.00000000',
      kenoMinBet: '0.00000001',
      kenoMaxBet: '1000.00000000',
    }) as GameSettingsDto;
  }

  async updateGameSettings(
    updateDto: UpdateGameSettingsDto,
    adminId: string,
  ): Promise<GameSettingsDto> {
    for (const [key, value] of Object.entries(updateDto)) {
      if (value !== undefined) {
        await this.updateOrCreateSetting(`games.${key}`, value, 'games', adminId);
      }
    }

    return this.getGameSettings();
  }

  async getAdminUsers() {
    const admins = await this.adminRepository.find({
      select: ['id', 'email', 'name', 'role', 'isActive', 'lastLoginAt', 'createdAt', 'userId'],
      order: { createdAt: 'DESC' },
    });

    return admins.map((admin) => ({
      id: admin.id,
      username: admin.name,
      email: admin.email,
      role: admin.role,
      createdAt: admin.createdAt,
      lastLogin: admin.lastLoginAt,
      isActive: admin.isActive,
      userId: admin.userId,
    }));
  }

  async updateAdminRole(adminId: string, role: AdminRole): Promise<void> {
    const admin = await this.adminRepository.findOne({
      where: { id: adminId },
    });

    if (!admin) {
      throw new NotFoundException(`Admin with id ${adminId} not found`);
    }

    if (admin.role === AdminRole.SUPER_ADMIN) {
      throw new ConflictException('Cannot modify SUPER_ADMIN accounts');
    }

    if (role === AdminRole.SUPER_ADMIN) {
      throw new ConflictException('Cannot assign SUPER_ADMIN role through this endpoint');
    }

    admin.role = role;
    await this.adminRepository.save(admin);
  }

  async updateAdminProfile(
    adminId: string,
    updateData: { email?: string; name?: string; password?: string },
  ): Promise<void> {
    const admin = await this.adminRepository.findOne({
      where: { id: adminId },
    });

    if (!admin) {
      throw new NotFoundException(`Admin with id ${adminId} not found`);
    }

    if (updateData.email && updateData.email !== admin.email) {
      const existingAdmin = await this.adminRepository.findOne({
        where: { email: updateData.email },
      });

      if (existingAdmin) {
        throw new ConflictException('Email is already taken');
      }

      admin.email = updateData.email;
    }

    if (updateData.name) {
      admin.name = updateData.name;
    }

    if (updateData.password) {
      admin.password = await PasswordUtil.hash(updateData.password);
    }

    await this.adminRepository.save(admin);
  }

  async getApiKeys(): Promise<ApiKeyDto[]> {
    const apiKeys = await this.apiKeyRepository.find({
      order: { createdAt: 'DESC' },
    });

    return apiKeys.map((key) => ({
      id: key.id,
      name: key.name,
      key: key.key,
      permissions: key.permissions,
      isActive: key.isActive,
      lastUsedAt: key.lastUsedAt,
      createdBy: key.createdBy,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    }));
  }

  async createApiKey(createDto: CreateApiKeyDto, adminId: string): Promise<ApiKeyDto> {
    const permissions =
      typeof createDto.permissions === 'string'
        ? createDto.permissions.split(',').map((p) => p.trim())
        : createDto.permissions;

    const apiKey = this.apiKeyRepository.create({
      name: createDto.name,
      key: `dk_${randomBytes(32).toString('hex')}`,
      permissions,
      createdBy: adminId,
    });

    const savedKey = await this.apiKeyRepository.save(apiKey);
    return {
      id: savedKey.id,
      name: savedKey.name,
      key: savedKey.key,
      permissions: savedKey.permissions,
      isActive: savedKey.isActive,
      lastUsedAt: savedKey.lastUsedAt,
      createdBy: savedKey.createdBy,
      createdAt: savedKey.createdAt,
      updatedAt: savedKey.updatedAt,
    };
  }

  async updateApiKey(id: string, updateDto: UpdateApiKeyDto): Promise<ApiKeyDto> {
    const apiKey = await this.apiKeyRepository.findOne({ where: { id } });

    if (!apiKey) {
      throw new NotFoundException(`API key with id ${id} not found`);
    }

    if (updateDto.name !== undefined) {
      apiKey.name = updateDto.name;
    }

    if (updateDto.permissions !== undefined) {
      apiKey.permissions =
        typeof updateDto.permissions === 'string'
          ? updateDto.permissions.split(',').map((p) => p.trim())
          : updateDto.permissions;
    }

    if (updateDto.isActive !== undefined) {
      apiKey.isActive = updateDto.isActive;
    }

    const savedKey = await this.apiKeyRepository.save(apiKey);
    return {
      id: savedKey.id,
      name: savedKey.name,
      key: savedKey.key,
      permissions: savedKey.permissions,
      isActive: savedKey.isActive,
      lastUsedAt: savedKey.lastUsedAt,
      createdBy: savedKey.createdBy,
      createdAt: savedKey.createdAt,
      updatedAt: savedKey.updatedAt,
    };
  }

  async deleteApiKey(id: string): Promise<void> {
    const result = await this.apiKeyRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`API key with id ${id} not found`);
    }
  }

  async updateGeneralSettings(
    settings: Record<string, any>,
    adminId: string,
  ): Promise<SystemSettingDto[]> {
    const updatedSettings: SystemSettingDto[] = [];

    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined) {
        // Determine category based on key
        let category = 'general';
        let fullKey = key;

        if (key.includes('deposit') || key.includes('withdrawal') || key.includes('registration')) {
          category = 'platform';
          fullKey = `platform.${key}`;
        } else if (key.includes('bonus') || key.includes('rakeback') || key.includes('affiliate')) {
          category = 'bonus';
          fullKey = `bonus.${key}`;
        }

        await this.updateOrCreateSetting(fullKey, value, category, adminId);

        // Get the updated setting to return
        const setting = await this.settingsRepository.findOne({ where: { key: fullKey } });
        if (setting) {
          updatedSettings.push(this.mapToDto(setting));
        }
      }
    }

    return updatedSettings;
  }

  private async updateOrCreateSetting(
    key: string,
    value: any,
    category: string,
    adminId: string,
  ): Promise<void> {
    let setting = await this.settingsRepository.findOne({ where: { key } });

    if (!setting) {
      setting = this.settingsRepository.create({
        key,
        category,
        type:
          typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string',
      });
    }

    setting.value = value;
    setting.updatedBy = adminId;

    await this.settingsRepository.save(setting);
  }

  private mapToDto(setting: SystemSettingEntity): SystemSettingDto {
    return {
      id: setting.id,
      key: setting.key,
      value: setting.isSecret ? '********' : setting.value,
      description: setting.description,
      category: setting.category,
      type: setting.type,
      isSecret: setting.isSecret,
      updatedBy: setting.updatedBy,
      updatedAt: setting.updatedAt,
    };
  }

  private mapToTypedSettings(
    settings: SystemSettingDto[],
    defaults: Record<string, any>,
  ): Record<string, any> {
    const result = { ...defaults };

    for (const setting of settings) {
      // Handle both dotted keys (platform.registrationEnabled) and simple keys (registrationEnabled)
      const key = setting.key.includes('.') ? setting.key.split('.').pop()! : setting.key;
      if (key in result) {
        result[key] = setting.value;
      }
    }

    return result;
  }

  async getGeneralSettings(): Promise<Record<string, any>> {
    // Get all settings from the database
    const allSettings = await this.settingsRepository.find({
      order: { category: 'ASC', key: 'ASC' },
    });

    // Create a flat object with default values
    const flatSettings: Record<string, any> = {
      maintenanceMode: false,
      registrationEnabled: true,
      withdrawalsEnabled: true,
      depositsEnabled: true,
      minWithdrawAmount: 10,
      maxWithdrawAmount: 5000,
      withdrawalFeePercent: 1.5,
      affiliateCommissionPercent: 5,
      rakebackPercent: 0.01,
      vipLevelRequirements: {
        'VIP 1': 0,
        'VIP 2': 1000,
        'VIP 3': 5000,
        'VIP 4': 10000,
        'VIP 5': 50000,
      },
    };

    // Override defaults with saved settings
    for (const setting of allSettings) {
      const key = setting.key.includes('.') ? setting.key.split('.').pop()! : setting.key;

      // Handle special cases
      if (key === 'minWithdrawAmount' || key === 'maxWithdrawAmount') {
        flatSettings[key] = parseFloat(setting.value) || 0;
      } else if (
        key === 'withdrawalFeePercent' ||
        key === 'affiliateCommissionPercent' ||
        key === 'rakebackPercent'
      ) {
        flatSettings[key] = parseFloat(setting.value) || 0;
      } else if (
        typeof setting.value === 'boolean' ||
        setting.value === 'true' ||
        setting.value === 'false'
      ) {
        flatSettings[key] = setting.value === 'true' || setting.value === true;
      } else {
        flatSettings[key] = setting.value;
      }
    }

    return flatSettings;
  }

  async checkEmail(
    email: string,
  ): Promise<{ exists: boolean; userId?: string; username?: string }> {
    const user = await this.userRepository.findOne({
      where: { email },
      select: ['id', 'email', 'username'],
    });

    if (!user) {
      return { exists: false };
    }

    return {
      exists: true,
      userId: user.id,
      username: user.username,
    };
  }
}
