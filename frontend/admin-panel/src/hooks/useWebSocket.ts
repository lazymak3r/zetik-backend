import { useCallback, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { io, Socket } from 'socket.io-client';
import { RootState } from '../store';

interface WebSocketHookOptions {
  onDashboardUpdate?: (data: any) => void;
  onTransactionUpdate?: (data: any) => void;
  onGameUpdate?: (data: any) => void;
  onUserUpdate?: (data: any) => void;
  onWithdrawalPending?: (data: any) => void;
  onSystemAlert?: (alert: { type: string; message: string; data?: any }) => void;
}

export const useWebSocket = (options: WebSocketHookOptions = {}) => {
  const socketRef = useRef<Socket | null>(null);
  const token = useSelector((state: RootState) => state.auth.token);

  const connect = useCallback(() => {
    if (!token) return;

    const socket = io(`${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/admin`, {
      auth: {
        token,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to admin WebSocket');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from admin WebSocket');
    });

    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Set up event listeners
    if (options.onDashboardUpdate) {
      socket.on('dashboard:update', options.onDashboardUpdate);
    }

    if (options.onTransactionUpdate) {
      socket.on('transaction:update', options.onTransactionUpdate);
    }

    if (options.onGameUpdate) {
      socket.on('game:update', options.onGameUpdate);
    }

    if (options.onUserUpdate) {
      socket.on('user:update', options.onUserUpdate);
    }

    if (options.onWithdrawalPending) {
      socket.on('withdrawal:pending', options.onWithdrawalPending);
    }

    if (options.onSystemAlert) {
      socket.on('system:alert', options.onSystemAlert);
    }

    return socket;
  }, [token, options]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  const subscribe = useCallback((channel: string) => {
    if (socketRef.current) {
      socketRef.current.emit(`subscribe:${channel}`);
    }
  }, []);

  const unsubscribe = useCallback((channel: string) => {
    if (socketRef.current) {
      socketRef.current.emit(`unsubscribe:${channel}`);
    }
  }, []);

  const emit = useCallback((event: string, data: any) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  }, []);

  useEffect(() => {
    if (token) {
      const socket = connect();
      return () => {
        socket?.disconnect();
      };
    }
  }, [token, connect]);

  return {
    socket: socketRef.current,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    emit,
  };
};
