import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { AuthenticatedSocket, WebSocketAuthService } from '../services/websocket-auth.service';

@Injectable()
export class WebSocketAuthGuard implements CanActivate {
  constructor(private readonly authService: WebSocketAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const socket = context.switchToWs().getClient<AuthenticatedSocket>();

    // Already authenticated by handleConnection
    if (this.authService.isAuthenticated(socket)) {
      return true;
    }

    // Lazy authentication for edge cases (client message before handleConnection completes)
    try {
      await this.authService.authenticateConnection(socket);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Not authenticated';
      throw new WsException(errorMessage);
    }

    return true;
  }
}
