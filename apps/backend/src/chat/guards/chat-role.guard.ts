import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import { AdminRole } from '@zetik/shared-entities';
import { UserRoleService } from '../../users/services/user-role.service';
import { CHAT_ROLES_KEY } from '../decorators/chat-roles.decorator';

@Injectable()
export class ChatRoleGuard implements CanActivate {
  private readonly logger = new Logger(ChatRoleGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly userRoleService: UserRoleService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(CHAT_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const isWebSocket = context.getType() === 'ws';
    let userId: string | undefined;

    if (isWebSocket) {
      const socket = context.switchToWs().getClient();
      userId = socket.userId;
    } else {
      const request = context.switchToHttp().getRequest();
      const user = request.user;
      if (!user) {
        throw new UnauthorizedException('User not authenticated');
      }
      userId = user.id;
    }

    if (!userId) {
      const errorMessage = 'User ID not found in request';
      this.logger.error(errorMessage);
      if (isWebSocket) {
        throw new WsException(errorMessage);
      }
      throw new UnauthorizedException(errorMessage);
    }

    const userRole = await this.userRoleService.getUserRole(userId);
    if (!userRole) {
      const errorMessage = 'User does not have required role for this action';
      this.logger.warn(`Access denied for user ${userId}. User has no role.`);
      if (isWebSocket) {
        throw new WsException(errorMessage);
      }
      throw new ForbiddenException(errorMessage);
    }

    const hasRole = requiredRoles.includes(userRole);
    if (!hasRole) {
      const errorMessage = `Insufficient permissions. Required role(s): ${requiredRoles.join(', ')}`;
      this.logger.warn(
        `Access denied for user ${userId} with role ${userRole}. Required: ${requiredRoles.join(', ')}`,
      );
      if (isWebSocket) {
        throw new WsException(errorMessage);
      }
      throw new ForbiddenException(errorMessage);
    }

    this.logger.debug(`Access granted for user ${userId} with role ${userRole}`);
    return true;
  }
}
