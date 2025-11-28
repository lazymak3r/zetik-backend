import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BonusCalculationLogEntity,
  BonusNotificationEntity,
  BonusTransactionEntity,
  BonusVipTierEntity,
  MonthlyRacePrizeEntity,
  RaceEntity,
  RaceParticipantEntity,
  RakebackEntity,
  UserEntity,
  UserVipStatusEntity,
  VipTransferSubmissionEntity,
  WeeklyRacePrizeEntity,
} from '@zetik/shared-entities';

import { BalanceModule } from '../balance/balance.module';
import { CommonModule } from '../common/common.module';
import { PaymentsModule } from '../payments/payments.module';
import { QueueModule } from '../queue/queue.module';
import { UsersModule } from '../users/users.module';
import { WebSocketModule } from '../websocket/websocket.module';

import { BONUS_QUEUE_NAME } from './constants/bonus-queue.constants';
import { BetConfirmedHandlerService } from './services/bet-confirmed-handler.service';
import { BonusCalculationLogService } from './services/bonus-calculation-log.service';
import { BonusCalculationProcessor } from './services/bonus-calculation.processor';
import { BonusNotificationService } from './services/bonus-notification.service';
import { BonusSchedulerService } from './services/bonus-scheduler.service';
import { BonusTransactionService } from './services/bonus-transaction.service';
import { UserVipStatusService } from './services/user-vip-status.service';
import { VipTierService } from './services/vip-tier.service';
import { WeeklyReloadBonusService } from './services/weekly-reload-bonus.service';
import { WeeklyReloadService } from './services/weekly-reload.service';

import { BonusController } from './bonus.controller';
import { BonusNotificationsController } from './controllers/bonus-notifications.controller';
import { RaceController } from './controllers/race.controller';
import { RakebackController } from './controllers/rakeback.controller';
import { VipBonusSimulatorController } from './controllers/vip-bonus-simulator.controller';
import { VipTransferController } from './controllers/vip-transfer.controller';
import { WeeklyReloadAdminController } from './controllers/weekly-reload-admin.controller';
import { WeeklyReloadController } from './controllers/weekly-reload.controller';
import { RaceGateway } from './gateways/race.gateway';
import { IntercomService } from './services/intercom.service';
import { RacePrizeNotificationService } from './services/race-prize-notification.service';
import { RaceWagerTrackerService } from './services/race-wager-tracker.service';
import { RaceService } from './services/race.service';
import { RakebackAccumulatorService } from './services/rakeback-accumulator.service';
import { RakebackService } from './services/rakeback.service';
import { SponsorRaceNotificationService } from './services/sponsor-race-notification.service';
import { VipTransferService } from './services/vip-transfer.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BonusVipTierEntity,
      UserVipStatusEntity,
      BonusTransactionEntity,
      BonusCalculationLogEntity,
      BonusNotificationEntity,
      RakebackEntity,
      RaceEntity,
      RaceParticipantEntity,
      WeeklyRacePrizeEntity,
      MonthlyRacePrizeEntity,
      VipTransferSubmissionEntity,
      UserEntity,
    ]),
    BullModule.registerQueue({
      name: BONUS_QUEUE_NAME,
    }),
    forwardRef(() => BalanceModule),
    forwardRef(() => CommonModule),
    forwardRef(() => PaymentsModule),
    QueueModule,
    forwardRef(() => UsersModule),
    forwardRef(() => WebSocketModule),
  ],
  controllers: [
    BonusController,
    VipBonusSimulatorController,
    BonusNotificationsController,
    RaceController,
    RakebackController,
    WeeklyReloadAdminController,
    WeeklyReloadController,
    VipTransferController,
  ],
  providers: [
    VipTierService,
    UserVipStatusService,
    BonusTransactionService,
    BonusSchedulerService,
    BonusCalculationProcessor,
    BonusCalculationLogService,
    BetConfirmedHandlerService,
    BonusNotificationService,
    IntercomService,
    RakebackAccumulatorService,
    RakebackService,
    WeeklyReloadService,
    WeeklyReloadBonusService,
    RaceService,
    RaceWagerTrackerService,
    RacePrizeNotificationService,
    SponsorRaceNotificationService,
    RaceGateway,
    VipTransferService,
    {
      provide: 'RaceGateway',
      useExisting: RaceGateway,
    },
  ],
  exports: [
    VipTierService,
    UserVipStatusService,
    BonusTransactionService,
    BonusCalculationLogService,
    BonusNotificationService,
    RakebackAccumulatorService,
    RakebackService,
    WeeklyReloadService,
    WeeklyReloadBonusService,
    RaceService,
    RaceWagerTrackerService,
    SponsorRaceNotificationService,
    RaceGateway,
  ],
})
export class BonusesModule {}
