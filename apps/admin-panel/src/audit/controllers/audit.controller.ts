import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminAuditLogEntity } from '@zetik/shared-entities';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuditLogService } from '../services/audit-log.service';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Get admin audit logs' })
  @ApiQuery({ name: 'adminId', required: false, description: 'Filter by admin ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit results', type: Number })
  async getAuditLogs(
    @Query('adminId') adminId?: string,
    @Query('limit') limit?: number,
  ): Promise<AdminAuditLogEntity[]> {
    return this.auditLogService.getAdminLogs(adminId, limit);
  }

  @Get('logs/resource')
  @ApiOperation({ summary: 'Get audit logs for specific resource' })
  @ApiQuery({ name: 'resource', required: true, description: 'Resource name' })
  @ApiQuery({ name: 'resourceId', required: false, description: 'Resource ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit results', type: Number })
  async getResourceLogs(
    @Query('resource') resource: string,
    @Query('resourceId') resourceId?: string,
    @Query('limit') limit?: number,
  ): Promise<AdminAuditLogEntity[]> {
    return this.auditLogService.getResourceLogs(resource, resourceId, limit);
  }
}
