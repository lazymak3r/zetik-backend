import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { PasswordUtil } from '@zetik/common';
import {
  AdminEntity,
  AdminRole,
  AuthStrategyEnum,
  IEmailRegistrationData,
  UserEntity,
} from '@zetik/shared-entities';
import { randomBytes, randomUUID } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AdminEntity)
    private adminRepository: Repository<AdminEntity>,
    private jwtService: JwtService,
    private dataSource: DataSource,
  ) {}

  async login(loginDto: AdminLoginDto, ip?: string): Promise<AuthResponseDto> {
    const admin = await this.adminRepository.findOne({
      where: { email: loginDto.email },
      select: ['id', 'email', 'name', 'password', 'role', 'isActive', 'tokenVersion'],
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await PasswordUtil.verify(loginDto.password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login info
    await this.adminRepository.update(admin.id, {
      lastLoginAt: new Date(),
      lastLoginIp: ip,
    });

    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      version: admin.tokenVersion,
      jti: randomBytes(16).toString('hex'),
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return {
      accessToken,
      refreshToken,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
      },
    };
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    try {
      const payload = this.jwtService.verify(refreshToken);

      const adminId = payload.sub;
      const admin = await this.adminRepository.findOne({
        where: { id: adminId, isActive: true },
        select: ['id', 'email', 'name', 'role', 'tokenVersion'],
      });

      if (!admin) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Check token version
      if (admin.tokenVersion !== payload.version) {
        throw new UnauthorizedException('Token has been invalidated');
      }

      // Generate new tokens with same version
      const newPayload = {
        sub: admin.id,
        email: admin.email,
        role: admin.role,
        version: admin.tokenVersion,
        jti: randomBytes(16).toString('hex'),
      };

      const newAccessToken = this.jwtService.sign(newPayload);
      const newRefreshToken = this.jwtService.sign(newPayload, { expiresIn: '7d' });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        },
      };
    } catch (error) {
      // Re-throw specific errors, otherwise throw generic message
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(adminId: string): Promise<void> {
    // Increment token version to invalidate all existing tokens
    await this.adminRepository.update(adminId, {
      tokenVersion: () => '"tokenVersion" + 1',
    });
  }

  async logoutAllSessions(adminId: string): Promise<void> {
    // Same as logout - invalidates all tokens for this admin
    await this.adminRepository.update(adminId, {
      tokenVersion: () => '"tokenVersion" + 1',
    });
  }

  async forceLogout(targetAdminId: string): Promise<void> {
    // Force logout specific admin (super admin action)
    await this.adminRepository.update(targetAdminId, {
      tokenVersion: () => '"tokenVersion" + 1',
    });
  }

  async validateAdmin(id: string): Promise<AdminEntity | null> {
    return this.adminRepository.findOne({
      where: { id, isActive: true },
    });
  }

  async createAdmin(data: {
    email: string;
    password: string;
    name: string;
    role?: AdminRole;
    assignedByAdminId?: string;
  }): Promise<AdminEntity> {
    const role = data.role || AdminRole.ADMIN;

    if (role === AdminRole.SUPER_ADMIN) {
      throw new ConflictException('Cannot create SUPER_ADMIN account via this method');
    }

    if (role !== AdminRole.ADMIN && role !== AdminRole.MODERATOR) {
      throw new ConflictException('Invalid role. Only ADMIN or MODERATOR roles are allowed');
    }

    return this.dataSource.transaction(async (manager) => {
      const existingUser = await manager.findOne(UserEntity, {
        where: { email: data.email },
      });

      if (existingUser) {
        const existingAdmin = await manager.findOne(AdminEntity, {
          where: { userId: existingUser.id },
        });

        if (existingAdmin) {
          if (existingAdmin.role === AdminRole.SUPER_ADMIN) {
            throw new ConflictException('Cannot modify SUPER_ADMIN accounts');
          }
          existingAdmin.role = role;
          existingAdmin.email = data.email;
          existingAdmin.name = data.name;
          existingAdmin.password = await PasswordUtil.hash(data.password);
          existingAdmin.updatedAt = new Date();
          return manager.save(existingAdmin);
        }

        const hashedPassword = await PasswordUtil.hash(data.password);
        const admin = manager.create(AdminEntity, {
          userId: existingUser.id,
          email: data.email,
          name: data.name,
          password: hashedPassword,
          role,
          isActive: true,
        });

        return manager.save(admin);
      }

      const hashedPassword = await PasswordUtil.hash(data.password);
      const lowercaseUsername = data.name.toLowerCase().replace(/\s+/g, '_');

      const user = manager.create(UserEntity, {
        id: randomUUID(),
        username: lowercaseUsername,
        email: data.email,
        isEmailVerified: false,
        registrationStrategy: AuthStrategyEnum.EMAIL,
        registrationData: {
          passwordHash: hashedPassword,
        } as IEmailRegistrationData,
      });

      const savedUser = await manager.save(user);

      const admin = manager.create(AdminEntity, {
        email: data.email,
        name: data.name,
        password: hashedPassword,
        role,
        userId: savedUser.id,
        isActive: true,
      });

      return manager.save(admin);
    });
  }

  async updateProfile(adminId: string, updateDto: UpdateProfileDto): Promise<AdminEntity> {
    const admin = await this.adminRepository.findOne({
      where: { id: adminId },
      select: ['id', 'email', 'name', 'password', 'role', 'isActive'],
    });

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    // Check if email is already taken by another admin
    if (updateDto.email !== admin.email) {
      const existingAdmin = await this.adminRepository.findOne({
        where: { email: updateDto.email },
      });

      if (existingAdmin) {
        throw new ConflictException('Email is already taken');
      }
    }

    // Update password if provided
    if (updateDto.newPassword) {
      if (!updateDto.currentPassword) {
        throw new UnauthorizedException('Current password is required to set a new password');
      }

      const isPasswordValid = await PasswordUtil.verify(updateDto.currentPassword, admin.password);

      if (!isPasswordValid) {
        throw new UnauthorizedException('Current password is incorrect');
      }

      admin.password = await PasswordUtil.hash(updateDto.newPassword);
    }

    // Update admin profile
    admin.name = updateDto.name;
    admin.email = updateDto.email;

    return this.adminRepository.save(admin);
  }
}
