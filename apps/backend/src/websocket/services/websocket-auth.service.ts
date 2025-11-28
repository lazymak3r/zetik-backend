import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { UserEntity } from '@zetik/shared-entities';
import { Socket } from 'socket.io';
import { computeTokenHash } from '../../common/utils/token-hash.util';
import { authConfig } from '../../config/auth.config';
import { UsersService } from '../../users/users.service';

export interface AuthenticatedSocket extends Socket {
  user?: UserEntity;
  userId?: string;
  tokenHash?: string;
}
@Injectable()
export class WebSocketAuthService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
  ) {}

  /**
   * Authenticate WebSocket connection using access token only
   * Uses access token (JWT) to get user ID - no refresh token required
   * Supports multiple devices per user
   */
  async authenticateConnection(socket: AuthenticatedSocket): Promise<UserEntity> {
    try {
      // Extract access token from socket (not refresh token)
      const accessToken = this.extractAccessTokenFromSocket(socket);
      if (!accessToken) {
        throw new WsException('Access token not provided');
      }

      // Verify access token (JWT) - using access token secret, not refresh secret
      let payload: { sub: string; userId?: string };
      try {
        payload = this.jwtService.verify<{ sub: string; userId?: string }>(accessToken, {
          secret: authConfig().secret,
        });
      } catch (verifyError) {
        if (verifyError instanceof Error && verifyError.name === 'TokenExpiredError') {
          throw new WsException('Access token expired');
        }
        throw new WsException('Invalid access token');
      }

      // Get user ID from token payload (sub or userId field)
      const userId = payload.sub || payload.userId;
      if (!userId) {
        throw new WsException('Invalid token payload: missing user ID');
      }

      // Get user from database by ID
      const user = await this.usersService.findById(userId);

      if (!user) {
        throw new WsException('User not found');
      }

      if (user.isBanned) {
        throw new WsException('User is banned');
      }

      // Attach user to socket
      socket.user = user;
      socket.userId = user.id;

      return user;
    } catch (error) {
      // Re-throw WsException as-is, wrap other errors
      if (error instanceof WsException) {
        throw error;
      }
      throw new WsException('Authentication failed');
    }
  }

  /**
   * Extract access token from WebSocket connection
   * Only looks for access token, not refresh token
   * Supports multiple sources: Authorization header, query param, cookies, auth object
   */
  private extractAccessTokenFromSocket(socket: Socket): string | null {
    // Try authorization header (Bearer token)
    const authHeader = socket.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try query parameter (token or accessToken)
    const tokenQuery = socket.handshake.query.token || socket.handshake.query.accessToken;
    if (typeof tokenQuery === 'string' && tokenQuery.length > 0) {
      return tokenQuery;
    }

    // Try cookies (access_token only, not refresh_token)
    const cookies = socket.handshake.headers.cookie;
    if (cookies) {
      const accessTokenMatch = cookies.match(/access_token=([^;]+)/);
      if (accessTokenMatch && accessTokenMatch[1]) {
        return decodeURIComponent(accessTokenMatch[1]);
      }
    }

    // Try auth object in handshake (token or accessToken)
    const auth = socket.handshake.auth as { token?: string; accessToken?: string };
    if (typeof auth.accessToken === 'string' && auth.accessToken.length > 0) {
      return auth.accessToken;
    }
    if (typeof auth.token === 'string' && auth.token.length > 0) {
      return auth.token;
    }

    return null;
  }

  /**
   * Verify if socket is authenticated
   */
  isAuthenticated(socket: AuthenticatedSocket): boolean {
    return !!(socket.user && socket.userId);
  }

  /**
   * Get user from authenticated socket
   */
  getUser(socket: AuthenticatedSocket): UserEntity {
    if (!this.isAuthenticated(socket)) {
      throw new WsException('Socket not authenticated');
    }
    return socket.user!;
  }

  /**
   * Get user ID from authenticated socket
   */
  getUserId(socket: AuthenticatedSocket): string {
    if (!this.isAuthenticated(socket)) {
      throw new WsException('Socket not authenticated');
    }
    return socket.userId!;
  }

  /**
   * Generate session ID (tokenHash) from refresh token
   * Uses SHA256 hash of the token for deterministic session identification
   * @param token The refresh token
   * @returns SHA256 hash of the token, or null if token is invalid
   */
  getSessionIdFromToken(token: string): string | null {
    try {
      this.jwtService.verify<{ sub: string }>(token, {
        secret: authConfig().refreshSecret,
      });
      return computeTokenHash(token);
    } catch {
      return null;
    }
  }

  /**
   * Decode JWT token without verification
   *
   * ⚠️ WARNING: This method does NOT verify token signature!
   * Only use for non-sensitive metadata extraction (jti, sub).
   * NEVER use for authentication or authorization decisions.
   *
   * Used to extract jti from access token for session tracking
   * @param token The JWT token to decode
   * @returns Decoded payload or null if invalid
   */
  decodeToken(token: string): { jti?: string; sub?: string } | null {
    try {
      const decoded = this.jwtService.decode(token);
      if (decoded && typeof decoded === 'object') {
        return decoded as { jti?: string; sub?: string };
      }
      return null;
    } catch {
      return null;
    }
  }
}
