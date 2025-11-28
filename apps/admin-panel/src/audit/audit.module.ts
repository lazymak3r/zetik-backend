import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuditLogEntity } from '@zetik/shared-entities';
import { AuditController } from './controllers/audit.controller';
import { AuditLogService } from './services/audit-log.service';

@Module({
  imports: [TypeOrmModule.forFeature([AdminAuditLogEntity])],
  controllers: [AuditController],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditModule {}
