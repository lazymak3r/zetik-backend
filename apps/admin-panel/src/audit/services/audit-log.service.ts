import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AdminActionTypeEnum, AdminAuditLogEntity } from '@zetik/shared-entities';
import { Repository } from 'typeorm';

export interface ILogAdminActionInput {
  adminId: string;
  adminEmail: string;
  action: AdminActionTypeEnum;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  previousValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AdminAuditLogEntity)
    private auditLogRepository: Repository<AdminAuditLogEntity>,
  ) {}

  async logAdminAction(input: ILogAdminActionInput): Promise<AdminAuditLogEntity> {
    const auditLog = this.auditLogRepository.create(input);
    return this.auditLogRepository.save(auditLog);
  }

  async getAdminLogs(adminId?: string, limit = 100): Promise<AdminAuditLogEntity[]> {
    const query = this.auditLogRepository
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC')
      .limit(limit);

    if (adminId) {
      query.where('log.adminId = :adminId', { adminId });
    }

    return query.getMany();
  }

  async getResourceLogs(
    resource: string,
    resourceId?: string,
    limit = 50,
  ): Promise<AdminAuditLogEntity[]> {
    const query = this.auditLogRepository
      .createQueryBuilder('log')
      .where('log.resource = :resource', { resource })
      .orderBy('log.createdAt', 'DESC')
      .limit(limit);

    if (resourceId) {
      query.andWhere('log.resourceId = :resourceId', { resourceId });
    }

    return query.getMany();
  }
}
