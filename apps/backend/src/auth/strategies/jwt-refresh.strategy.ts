import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { authConfig } from '../../config/auth.config';
import { UsersService } from '../../users/users.service';
import { TokenBlacklistService } from '../services/token-blacklist.service';

interface CookieWithRefreshToken {
  refresh_token?: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenBlacklistService: TokenBlacklistService,
  ) {
    const secretKey = authConfig().refreshSecret;

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // First try to get token from cookies
        (request: Request) => {
          if (!request || !request.cookies) return null;
          const cookies = request.cookies as CookieWithRefreshToken;
          return cookies.refresh_token || null;
        },
        // Fallback to body field if cookie not present
        ExtractJwt.fromBodyField('refreshToken'),
      ]),
      ignoreExpiration: false,
      secretOrKey: secretKey,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: { sub: string; username: string; jti?: string }) {
    // Check if token is blacklisted
    if (payload.jti) {
      const isBlacklisted = await this.tokenBlacklistService.isBlacklisted(payload.jti);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been invalidated');
      }
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.isBanned) {
      throw new UnauthorizedException('User is banned');
    }

    // Add the user ID to the request object
    return user;
  }
}
