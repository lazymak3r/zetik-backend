import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { AdminEntity } from '@zetik/shared-entities';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  version: number;
  jti: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    @InjectRepository(AdminEntity)
    private readonly adminRepository: Repository<AdminEntity>,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') || 'default-secret',
    });
  }

  async validate(payload: JwtPayload): Promise<AdminEntity> {
    const admin = await this.adminRepository.findOne({
      where: { id: payload.sub, isActive: true },
      select: [
        'id',
        'email',
        'name',
        'role',
        'userId',
        'isActive',
        'tokenVersion',
        'permissions',
        'lastLoginAt',
        'lastLoginIp',
        'createdAt',
        'updatedAt',
      ],
    });

    if (!admin) {
      throw new UnauthorizedException('Admin not found or inactive');
    }

    // Check token version
    if (admin.tokenVersion !== payload.version) {
      throw new UnauthorizedException('Token has been invalidated');
    }

    return admin;
  }
}
