import { ChatEntity, ChatMessageEntity } from '@zetik/shared-entities';
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { io, Socket } from 'socket.io-client';
import { BonusesModule } from '../src/bonus/bonuses.module';
import { UserVipStatusService } from '../src/bonus/services/user-vip-status.service';
import { ChatModule } from '../src/chat/chat.module';
import { authConfig } from '../src/config/auth.config';
import { commonConfig } from '../src/config/common.config';
import { databaseConfig } from '../src/config/database.config';
import { AppDataSource } from '../src/data-source';
import { UsersModule } from '../src/users/users.module';
import { UsersService } from '../src/users/users.service';
import { WebSocketRateLimitInterceptor } from '../src/websocket/interceptors/websocket-rate-limit.interceptor';

describe('ChatGateway (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let socket: Socket;
  let accessToken: string;
  let accessToken2: string;
  const logger = new Logger('ChatE2E');
  let chatRepository: any;
  let chatMessageRepository: any;
  let wsRateLimiter: WebSocketRateLimitInterceptor;

  // Test user
  const testUser = {
    id: '',
    email: `chat-test${Date.now()}@example.com`,
    username: `chat-tester${Date.now()}`,
    password: 'Secret123',
  };

  const testUser2 = {
    id: '',
    email: `chat-test2${Date.now()}@example.com`,
    username: `chat-tester2${Date.now()}`,
    password: 'Secret123',
  };

  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          TypeOrmModule.forRoot({ ...AppDataSource.options }),
          EventEmitterModule.forRoot(),
          ConfigModule.forRoot({
            isGlobal: true,
            load: [commonConfig, databaseConfig, authConfig],
          }),
          UsersModule,
          ChatModule,
          BonusesModule,
        ],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();
      await app.listen(0); // Use a random port

      // Get the JWT service to create tokens
      jwtService = app.get<JwtService>(JwtService);

      // Get the UsersService to create a test user
      const usersService = app.get<UsersService>(UsersService);
      wsRateLimiter = app.get<WebSocketRateLimitInterceptor>(WebSocketRateLimitInterceptor);

      // Create test users
      const [user, user2] = await Promise.all([
        await usersService.createWithEmail(testUser.email, testUser.username, testUser.password),
        await usersService.createWithEmail(testUser2.email, testUser2.username, testUser2.password),
      ]);

      testUser.id = user.id;
      testUser2.id = user2.id;

      // Create a JWT token for test users
      accessToken = jwtService.sign(
        { sub: testUser.id, email: testUser.email },
        { secret: authConfig().secret, expiresIn: '1h' },
      );
      accessToken2 = jwtService.sign(
        { sub: testUser2.id, email: testUser2.email },
        { secret: authConfig().secret, expiresIn: '1h' },
      );

      // Get the ChatEntity repository
      chatRepository = app.get(getRepositoryToken(ChatEntity));

      // Get the ChatMessageEntity repository
      chatMessageRepository = app.get(getRepositoryToken(ChatMessageEntity));

      // Create test chats
      const testChats = [
        { name: 'English Chat', language: 'en' },
        { name: 'Spanish Chat', language: 'es' },
      ];

      // Save the test chats
      for (const chat of testChats) {
        await chatRepository.save(chatRepository.create(chat));
      }

      // set user2 bonus level
      await app.get(UserVipStatusService).upsertUserVipStatus(testUser2.id, { currentVipLevel: 1 });
    } catch (error) {
      logger.error('Test setup failed', error instanceof Error ? error.stack : error);
      throw error;
    }
  });

  afterAll(async () => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
    await app.close();
  });

  beforeEach((done) => {
    // Clear all chat messages before each test
    chatMessageRepository
      .clear()
      .then(() => {
        wsRateLimiter.flush();
        const port = app.getHttpServer().address().port;
        socket = io(`http://localhost:${port}/chat`, {
          auth: { token: accessToken },
          transports: ['websocket'],
          forceNew: true,
        });

        socket.on('connected', (data) => {
          expect(data).toBeDefined();
          expect(data.userId).toBe(testUser.id);
          socket.removeAllListeners('error');
          done();
        });

        socket.on('error', (err) => {
          done(`Connection failed: ${JSON.stringify(err)}`);
        });
      })
      .catch(() => {
        // If clearing fails, continue without clearing (for backward compatibility)
        wsRateLimiter.flush();
        const port = app.getHttpServer().address().port;
        socket = io(`http://localhost:${port}/chat`, {
          auth: { token: accessToken },
          transports: ['websocket'],
          forceNew: true,
        });

        socket.on('connected', (data) => {
          expect(data).toBeDefined();
          expect(data.userId).toBe(testUser.id);
          socket.removeAllListeners('error');
          done();
        });

        socket.on('error', (err) => {
          done(`Connection failed: ${JSON.stringify(err)}`);
        });
      });
  });

  afterEach(() => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
  });

  it('should get the list of chats', (done) => {
    socket.emit('getChats', {}, (chats) => {
      try {
        expect(chats).toBeDefined();
        expect(Array.isArray(chats)).toBe(true);
        expect(chats.length).toBeGreaterThanOrEqual(2);
        expect(chats[0]).toHaveProperty('id');
        expect(chats[0]).toHaveProperty('name');
        done();
      } catch (error) {
        done(`Error ${error}`);
      }
    });

    socket.on('error', (err) => {
      done(`Failed to get chats: ${JSON.stringify(err)}`);
    });
  });

  it('should get messages for a specific chat', (done) => {
    socket.emit('getChats', {}, (chats) => {
      const chatId = chats[0].id;
      const testMessage = 'Hello from e2e test';

      socket.emit('getMessages', { chatId }, (messages) => {
        try {
          expect(messages).toEqual([]);

          socket.emit('sendMessage', { chatId, message: testMessage }, (response) => {
            try {
              expect(response).toBeDefined();
              expect(response.message).toBe(testMessage);
              expect(response.chatId).toBe(chatId);
              expect(response.user).toBeDefined();
              expect(response.user.id).toBe(testUser.id);
              expect(response.user.name).toBe(testUser.username);

              socket.emit('getMessages', { chatId }, (messages) => {
                try {
                  expect(Array.isArray(messages)).toBeTruthy();
                  expect(messages[0].id).toBeDefined();
                  expect(messages[0].chatId).toBeDefined();
                  expect(messages[0].message).toEqual(testMessage);
                  expect(messages[0].createdAt).toBeDefined();
                  expect(messages[0].user).toEqual({
                    id: testUser.id,
                    name: testUser.username,
                    avatar: null,
                    vipLevel: 0,
                    vipLevelImage: '',
                  });

                  done();
                } catch (error) {
                  done(`Error ${error}`);
                }
              });
            } catch (error) {
              done(`Error ${error}`);
            }
          });
        } catch (error) {
          done(`Error ${error}`);
        }
      });
    });

    socket.on('error', (err) => {
      done(`Failed to get messages: ${JSON.stringify(err)}`);
    });
  });

  it('should handle ping/pong for connection keep-alive', (done) => {
    socket.emit('ping');

    socket.on('pong', (data) => {
      try {
        expect(data).toBeDefined();
        expect(data.timestamp).toBeDefined();
        expect(data.userId).toBe(testUser.id);
        done();
      } catch (error) {
        done(`Error ${error}`);
      }
    });

    socket.on('error', (err) => {
      done(`Ping/pong failed: ${JSON.stringify(err)}`);
    });
  });

  it('should send a message to a chat and receive it back', (done) => {
    // First get the list of chats
    socket.emit('getChats', {}, (chats) => {
      const chatId = chats[0].id;
      const testMessage = 'Hello from e2e test';

      // Listen for the new message event
      socket.on('newMessage', (messageEvent) => {
        try {
          expect(messageEvent).toBeDefined();
          expect(messageEvent.message).toBe(testMessage);
          expect(messageEvent.chatId).toBe(chatId);
          expect(messageEvent.user).toBeDefined();
          expect(messageEvent.user.name).toBe(testUser.username);
          done();
        } catch (error) {
          done(`Error ${error}`);
        }
      });

      // Send a message
      socket.emit('sendMessage', { chatId, message: testMessage }, (response) => {
        try {
          expect(response).toBeDefined();
          expect(response.message).toBe(testMessage);
          expect(response.chatId).toBe(chatId);
          expect(response.user).toBeDefined();
          expect(response.user.id).toBe(testUser.id);
          expect(response.user.name).toBe(testUser.username);
        } catch (error) {
          done(`Error ${error}`);
        }
      });
    });

    socket.on('error', (err) => {
      done(`Failed to send message: ${JSON.stringify(err)}`);
    });
  });

  it('should fail if the message is too long', (done) => {
    socket.emit('getChats', {}, (chats) => {
      const chatId = chats[0].id;
      const testMessage = 'a'.repeat(1001);

      socket.on('error', () => done());

      socket.emit('sendMessage', { chatId, message: testMessage }, () => {
        done('Should not happen');
      });
    });
  });

  it('should fail if the message is too short', (done) => {
    socket.emit('getChats', {}, (chats) => {
      const chatId = chats[0].id;
      const testMessage = '';

      socket.on('error', () => done());

      socket.emit('sendMessage', { chatId, message: testMessage }, () => {
        done('Should not happen');
      });
    });
  });

  it('should retrieve messages from multiple users in correct order', (done) => {
    let socket2: Socket;
    const messages = [
      'First message from user1',
      'First message from user2',
      'Second message from user1',
      'Second message from user2',
    ];

    socket.emit('getChats', {}, (chats) => {
      const chatId = chats[1].id;
      const port = app.getHttpServer().address().port;

      socket2 = io(`http://localhost:${port}/chat`, {
        auth: { token: accessToken2 },
        transports: ['websocket'],
        forceNew: true,
      });

      socket2.on('connected', () => {
        // Send messages alternating between users
        socket.emit('sendMessage', { chatId, message: messages[0] }, () => {
          socket2.emit('sendMessage', { chatId, message: messages[1] }, () => {
            wsRateLimiter.flush();
            socket.emit('sendMessage', { chatId, message: messages[2] }, () => {
              socket2.emit('sendMessage', { chatId, message: messages[3] }, () => {
                // Get all messages and verify
                socket.emit('getMessages', { chatId }, (retrievedMessages) => {
                  try {
                    expect(retrievedMessages.length).toBe(4);
                    for (let i = 0; i < messages.length; i++) {
                      expect(retrievedMessages[i].message).toBe(messages[i]);
                      expect(retrievedMessages[i].user.id).toBe(
                        i % 2 === 0 ? testUser.id : testUser2.id,
                      );
                      expect(retrievedMessages[i].user.vipLevel).toBe(i % 2 === 0 ? 0 : 1);
                      expect(retrievedMessages[i].user.vipLevelImage).toBe(
                        i % 2 === 0 ? '' : 'user-level/bronze-1',
                      );
                    }
                    socket2.disconnect();
                    done();
                  } catch (error) {
                    socket2.disconnect();
                    done(error);
                  }
                });
              });
            });
          });
        });
      });
    });

    socket.on('error', (err) => {
      if (socket2) socket2.disconnect();
      done(`Failed to send/receive messages: ${JSON.stringify(err)}`);
    });
  });

  it('should reject requests that exceed the rate limit', (done) => {
    socket.emit('getChats', {}, (chats) => {
      try {
        expect(Array.isArray(chats)).toBe(true);
        const chatId = chats[0].id;
        const testMessage = 'Hello from e2e test';

        socket.on('error', (err) => done(err));

        socket.emit('sendMessage', { chatId, message: testMessage }, (response) => {
          try {
            expect(response).toBeDefined();
            expect(response.message).toBe(testMessage);
            expect(response.chatId).toBe(chatId);
            expect(response.user).toBeDefined();
            expect(response.user.id).toBe(testUser.id);
            expect(response.user.name).toBe(testUser.username);

            socket.removeAllListeners('error');
            socket.on('error', (err) => {
              try {
                expect(err).toBeDefined();
                expect(err.message).toContain('Rate limit exceeded');
                done();
              } catch (error) {
                done(`Error ${error}`);
              }
            });

            // The second request should fail
            socket.emit('sendMessage', { chatId, message: testMessage }, () => {
              done('Expected rate limit to be exceeded');
            });
          } catch (error) {
            done(`Error ${error}`);
          }
        });
      } catch (error) {
        done(`Error ${error}`);
      }
    });
  });
});
