import { configureStore } from '@reduxjs/toolkit';
import { act, renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import authReducer from '../store/slices/authSlice';
import { useWebSocket } from './useWebSocket';

// Mock socket.io-client
jest.mock('socket.io-client', () => {
  const mockSocket = {
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connected: true,
  };
  return {
    io: jest.fn(() => mockSocket),
  };
});

describe('useWebSocket', () => {
  let store: any;

  beforeEach(() => {
    store = configureStore({
      reducer: {
        auth: authReducer,
      },
      preloadedState: {
        auth: {
          token: 'test-token',
          admin: {
            id: '1',
            name: 'testadmin',
            email: 'test@admin.com',
            role: 'admin',
          },
          isAuthenticated: true,
          loading: false,
          error: null,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  it('should connect when token is available', () => {
    const { result } = renderHook(() => useWebSocket(), { wrapper });

    expect(result.current.socket).toBeTruthy();
  });

  it('should subscribe to channels', () => {
    const { result } = renderHook(() => useWebSocket(), { wrapper });

    act(() => {
      result.current.subscribe('dashboard');
    });

    expect(result.current.socket?.emit).toHaveBeenCalledWith('subscribe:dashboard');
  });

  it('should emit events', () => {
    const { result } = renderHook(() => useWebSocket(), { wrapper });

    act(() => {
      result.current.emit('test-event', { data: 'test' });
    });

    expect(result.current.socket?.emit).toHaveBeenCalledWith('test-event', { data: 'test' });
  });

  it('should handle event callbacks', () => {
    const onDashboardUpdate = jest.fn();
    const { result } = renderHook(() => useWebSocket({ onDashboardUpdate }), { wrapper });

    expect(result.current.socket?.on).toHaveBeenCalledWith('dashboard:update', onDashboardUpdate);
  });

  it('should disconnect on unmount', () => {
    const { result, unmount } = renderHook(() => useWebSocket(), { wrapper });
    const socket = result.current.socket;

    unmount();

    expect(socket?.disconnect).toHaveBeenCalled();
  });
});
