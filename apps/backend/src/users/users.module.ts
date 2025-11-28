import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AdminEntity,
  BalanceHistoryEntity,
  DailyGamblingStatsEntity,
  DefaultAvatarEntity,
  SelfExclusionEntity,
  UserAvatarEntity,
  UserEntity,
  UserIgnoredUserEntity,
  UserModerationHistoryEntity,
  UserVerificationEntity,
  VerificationBasicInfoEntity,
  VerificationDocumentEntity,
} from '@zetik/shared-entities';
import { AuthGuardsModule } from '../auth/auth-guards.module';
import { AuthModule } from '../auth/auth.module';
import { BalanceModule } from '../balance/balance.module';
import { BonusesModule } from '../bonus/bonuses.module';
import { ChatModule } from '../chat/chat.module';
import { EmailModule } from '../email/email.module';
import { UploadModule } from '../upload/upload.module';
// SelfExclusionGuard moved to app.module.ts for global registration
import { SELF_EXCLUSION_QUEUE_NAME } from './constants/self-exclusion-queue.constants';
import { DailyGamblingStatsService } from './daily-gambling-stats.service';
import { DefaultAvatarService } from './default-avatar.service';
import { SelfExclusionSchedulerService } from './self-exclusion-scheduler.service';
import { SelfExclusionProcessor } from './self-exclusion.processor';
import { SelfExclusionService } from './self-exclusion.service';
import { UserMuteService } from './services/user-mute.service';
import { UserPrivacyEventPublisher } from './services/user-privacy-event.publisher';
import { UserRoleService } from './services/user-role.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      UserAvatarEntity,
      DefaultAvatarEntity,
      UserIgnoredUserEntity,
      UserModerationHistoryEntity,
      SelfExclusionEntity,
      BalanceHistoryEntity,
      DailyGamblingStatsEntity,
      UserVerificationEntity,
      VerificationDocumentEntity,
      VerificationBasicInfoEntity,
      AdminEntity,
    ]),
    AuthGuardsModule,
    forwardRef(() => BonusesModule),
    forwardRef(() => AuthModule),
    forwardRef(() => BalanceModule),
    forwardRef(() => ChatModule),
    UploadModule,
    EmailModule,
    BullModule.registerQueue({
      name: SELF_EXCLUSION_QUEUE_NAME,
    }),
  ],
  providers: [
    UsersService,
    DefaultAvatarService,
    SelfExclusionService,
    DailyGamblingStatsService,
    VerificationService,
    SelfExclusionProcessor,
    SelfExclusionSchedulerService,
    UserMuteService,
    UserPrivacyEventPublisher,
    UserRoleService,
    // SelfExclusionGuard moved to app.module.ts for global registration
  ],
  controllers: [UsersController, VerificationController],
  exports: [
    UsersService,
    DefaultAvatarService,
    SelfExclusionService,
    DailyGamblingStatsService,
    VerificationService,
    UserMuteService,
    UserRoleService,
  ],
})
export class UsersModule {}
