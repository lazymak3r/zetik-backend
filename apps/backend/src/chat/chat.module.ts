import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminEntity, ChatEntity, ChatMessageEntity, UserEntity } from '@zetik/shared-entities';
import { BonusesModule } from '../bonus/bonuses.module';
import { authConfig } from '../config/auth.config';
import { UsersModule } from '../users/users.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { ChatAdminController } from './controllers/chat-admin.controller';
import { ChatModerationController } from './controllers/chat-moderation.controller';
import { ChatGateway } from './gateways/chat.gateway';
import { ChatRoleGuard } from './guards/chat-role.guard';
import { ChatMessageEnricherService } from './services/chat-message-enricher.service';
import { ChatModerationService } from './services/chat-moderation.service';
import { ChatService } from './services/chat.service';

@Module({
  imports: [
    JwtModule.register({
      secret: authConfig().secret,
      signOptions: { expiresIn: authConfig().accessExpiration },
    }),
    TypeOrmModule.forFeature([ChatEntity, ChatMessageEntity, UserEntity, AdminEntity]),
    forwardRef(() => UsersModule),
    WebSocketModule,
    BonusesModule,
  ],
  controllers: [ChatModerationController, ChatAdminController],
  providers: [
    ChatGateway,
    ChatService,
    ChatMessageEnricherService,
    ChatModerationService,
    ChatRoleGuard,
  ],
  exports: [ChatGateway, ChatService, ChatModerationService, ChatRoleGuard],
})
export class ChatModule {}
