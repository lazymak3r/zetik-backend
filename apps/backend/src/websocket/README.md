# WebSocket Notifications

This module provides WebSocket functionality for real-time communication with clients, including a dedicated notification system.

## Features

- Game WebSocket Gateway (`/games` namespace) for game-related real-time updates
- Notification WebSocket Gateway (`/notifications` namespace) for sending notifications to clients
- Authentication using JWT tokens
- Rate limiting for WebSocket connections

## Using the Notification Service

The `NotificationService` provides a simple API for sending notifications to clients through WebSockets.

### Import the WebSocketModule

First, import the WebSocketModule in your module:

```typescript
import { Module } from '@nestjs/common';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [WebSocketModule],
  // ...
})
export class YourModule {}
```

### Inject the NotificationService

Then, inject the NotificationService in your service:

```typescript
import { Injectable } from '@nestjs/common';
import { NotificationService, Notification } from '../websocket/services/notification.service';

@Injectable()
export class YourService {
  constructor(private readonly notificationService: NotificationService) {}

  async someMethod() {
    // Your business logic...

    // Send a notification to a specific user
    const notification: Notification = {
      type: 'new_message',
      title: 'New Message',
      message: 'You have received a new message',
      data: {
        messageId: '123',
        senderId: '456',
      },
    };

    this.notificationService.sendToUser('user-id', notification);

    // Or send to multiple users
    this.notificationService.sendToUsers(['user-id-1', 'user-id-2'], notification);

    // Or broadcast to all connected users
    this.notificationService.broadcast(notification);
  }
}
```

## Client-Side Integration

On the client side, you need to connect to the notification WebSocket:

```javascript
// Using socket.io-client
import { io } from 'socket.io-client';

// Connect to the notification WebSocket
const socket = io('https://your-api.com/notifications', {
  withCredentials: true, // Important for sending cookies
});

// Handle connection events
socket.on('connected', (data) => {
  console.log('Connected to notification server', data);
});

// Handle notifications
socket.on('notification', (notification) => {
  console.log('Received notification', notification);

  // Example: Show a toast notification
  showToast(notification.data.title, notification.data.message);
});

// Handle errors
socket.on('error', (error) => {
  console.error('WebSocket error', error);
});

// Keep connection alive with ping/pong
setInterval(() => {
  socket.emit('ping');
}, 30000);

socket.on('pong', (data) => {
  console.log('Pong received', data);
});
```

## Notification Types

You can define different notification types for different purposes:

- `new_message`: A new message has been received
- `friend_request`: A new friend request has been received
- `game_invitation`: An invitation to join a game
- `achievement`: User has unlocked an achievement
- `system`: System notifications
