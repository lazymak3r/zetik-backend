import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class AdminIpGuard implements CanActivate {
  private readonly logger = new Logger(AdminIpGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = this.getClientIp(request);
    const allowedIps = this.configService.get<string[]>('common.adminAllowedIps') || [];

    this.logger.debug(`Admin API access attempt from IP: ${clientIp}`);
    this.logger.debug(`Allowed IPs: ${allowedIps.join(', ')}`);

    // Check if client IP is in allowed list
    const isAllowed = allowedIps.some((allowedIp) => {
      // Handle localhost variations
      if (allowedIp === 'localhost') {
        return clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === 'localhost';
      }

      // Handle IPv6 loopback
      if (allowedIp === '::1' && (clientIp === '127.0.0.1' || clientIp === 'localhost')) {
        return true;
      }

      // Handle IPv4 loopback
      if (allowedIp === '127.0.0.1' && (clientIp === '::1' || clientIp === 'localhost')) {
        return true;
      }

      // ignore check on localhost/dev environment
      if (process.env.NODE_ENV === 'development' || request.hostname.includes('localhost')) {
        return true;
      }

      // Exact match
      return clientIp === allowedIp;
    });

    if (!isAllowed) {
      this.logger.warn(
        `Admin API access denied for IP: ${clientIp}. Allowed IPs: ${allowedIps.join(', ')}`,
      );
      throw new ForbiddenException(
        `Access denied. IP address ${clientIp} is not authorized for admin operations.`,
      );
    }

    this.logger.log(`Admin API access granted for IP: ${clientIp}`);
    return true;
  }

  private getClientIp(request: Request): string {
    // Check various headers for the real client IP
    const forwarded = request.headers['x-forwarded-for'] as string;
    const realIp = request.headers['x-real-ip'] as string;
    const cfConnectingIp = request.headers['cf-connecting-ip'] as string;

    if (forwarded) {
      // x-forwarded-for can contain multiple IPs, take the first one
      return forwarded.split(',')[0].trim();
    }

    if (realIp) {
      return realIp;
    }

    if (cfConnectingIp) {
      return cfConnectingIp;
    }

    // Fallback to connection remote address
    return request.connection.remoteAddress || request.socket.remoteAddress || 'unknown';
  }
}
