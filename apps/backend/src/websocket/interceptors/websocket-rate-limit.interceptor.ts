import {
  applyDecorators,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
  UseInterceptors,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import { Observable } from 'rxjs';
import { Socket } from 'socket.io';
import { WebSocketAuthService } from '../services/websocket-auth.service';

export interface RateLimitOptions {
  rps: number;
}

export const RATE_LIMIT_KEY = 'ws_rate_limit';

export const RateLimit = (options: RateLimitOptions) => {
  const mergedConfig = { ...options };
  return applyDecorators(
    SetMetadata(RATE_LIMIT_KEY, mergedConfig),
    UseInterceptors(WebSocketRateLimitInterceptor),
  );
};

const DEFAULT_RATE_LIMIT: RateLimitOptions = {
  rps: 1,
};

// Fixed: Use class-level Map with size limits instead of global Map
const MAX_ENTRIES = 10000; // Limit to prevent memory leaks
const CLEANUP_INTERVAL = 50; // Cleanup every 50 requests instead of 100

@Injectable()
export class WebSocketRateLimitInterceptor implements NestInterceptor {
  private readonly requestMap = new Map<string, number>();

  constructor(
    private readonly authService: WebSocketAuthService,
    private readonly reflector: Reflector,
  ) {}

  flush(): void {
    this.requestMap.clear();
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const socket = context.switchToWs().getClient<Socket>();

    if (!this.authService.isAuthenticated(socket)) {
      return next.handle();
    }

    const userId = this.authService.getUserId(socket);
    if (!userId) {
      throw new WsException('User ID not found');
    }

    const handler = context.getHandler();
    const className = context.getClass().name;
    const options =
      this.reflector.get<RateLimitOptions>(RATE_LIMIT_KEY, handler) || DEFAULT_RATE_LIMIT;

    const handlerName = handler.name;
    const requestKey = `${className}.${handlerName}:${userId}`;

    const now = Date.now();
    const lastRequest = this.requestMap.get(requestKey) || 0;
    const timeSinceLastRequest = now - lastRequest;

    // todo implement buckets
    if (timeSinceLastRequest < 1000 / options.rps) {
      throw new WsException('Rate limit exceeded. Please try again later.');
    }

    this.requestMap.set(requestKey, now);
    this.cleanupOldEntries(now);

    return next.handle();
  }

  private cleanupOldEntries(now: number): void {
    // Fixed: More aggressive cleanup and size limits
    if (now % CLEANUP_INTERVAL !== 0) {
      return;
    }

    const expirationTime = now - 60000; // 1 minute expiry

    // Remove expired entries
    for (const [key, timestamp] of this.requestMap.entries()) {
      if (timestamp < expirationTime) {
        this.requestMap.delete(key);
      }
    }

    // Emergency cleanup if map grows too large
    if (this.requestMap.size > MAX_ENTRIES) {
      const entries = Array.from(this.requestMap.entries());
      // Keep only the newest 50% of entries
      entries.sort((a, b) => b[1] - a[1]);
      this.requestMap.clear();

      const keepCount = Math.floor(MAX_ENTRIES / 2);
      for (let i = 0; i < keepCount && i < entries.length; i++) {
        this.requestMap.set(entries[i][0], entries[i][1]);
      }
    }
  }
}
