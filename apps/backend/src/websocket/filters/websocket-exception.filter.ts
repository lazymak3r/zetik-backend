import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Catch()
export class WebSocketExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WebSocketExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost): void {
    const socket = host.switchToWs().getClient<Socket>();
    const data = host.switchToWs().getData<unknown>();
    let message = exception.message;
    let code = 'WEBSOCKET_ERROR';

    // Handle WsException specifically
    if (exception instanceof WsException) {
      message = exception.message;
      code = 'WEBSOCKET_ERROR';
    } else if (exception instanceof HttpException) {
      const response = exception.getResponse() as any;
      message = response.message || exception.message;
      code = 'WEBSOCKET_ERROR';
    }

    const errorResponse = {
      message: message,
      code: code,
      timestamp: new Date(),
      data: data,
    };

    this.logger.warn(`WebSocket error: ${message}`, errorResponse);

    socket.emit('error', errorResponse);
  }
}
