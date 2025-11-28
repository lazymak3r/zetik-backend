import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  PromocodeAuditActionEnum,
  PromocodeAuditEntity,
  PromocodeClaimEntity,
  PromocodeEntity,
  PromocodeStatusEnum,
} from '@zetik/shared-entities';
import { DataSource, Like, Repository } from 'typeorm';
import { CreatePromocodeDto } from '../dto/create-promocode.dto';
import {
  PromocodeAdminResponseDto,
  PromocodeAuditResponseDto,
  PromocodeClaimDto,
} from '../dto/promocode-admin-response.dto';
import { PromocodeListQueryDto } from '../dto/promocode-list-query.dto';
import { UpdatePromocodeDto } from '../dto/update-promocode.dto';

@Injectable()
export class PromocodesAdminService {
  private readonly logger = new Logger(PromocodesAdminService.name);

  constructor(
    @InjectRepository(PromocodeEntity)
    private readonly promocodeRepository: Repository<PromocodeEntity>,
    @InjectRepository(PromocodeClaimEntity)
    private readonly promocodeClaimRepository: Repository<PromocodeClaimEntity>,
    @InjectRepository(PromocodeAuditEntity)
    private readonly promocodeAuditRepository: Repository<PromocodeAuditEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async createPromocode(
    adminId: string,
    dto: CreatePromocodeDto,
  ): Promise<PromocodeAdminResponseDto> {
    if (dto.startsAt >= dto.endsAt) {
      throw new BadRequestException('Start date must be before end date');
    }

    if (dto.valuePerClaim <= 0) {
      throw new BadRequestException('Value per claim must be positive');
    }

    if (dto.totalClaims <= 0) {
      throw new BadRequestException('Total claims must be positive');
    }

    const existingPromocode = await this.promocodeRepository.findOne({
      where: { code: dto.code.toLowerCase() },
    });

    if (existingPromocode) {
      throw new BadRequestException('Promocode with this code already exists');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const promocode = queryRunner.manager.create(PromocodeEntity, {
        code: dto.code.toLowerCase(),
        createdByAdminId: adminId,
        valuePerClaim: dto.valuePerClaim.toString(),
        totalClaims: dto.totalClaims,
        claimedCount: 0,
        asset: dto.asset,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        status: PromocodeStatusEnum.ACTIVE,
        note: dto.note,
        eligibilityRules: dto.eligibilityRules,
      });

      const savedPromocode = await queryRunner.manager.save(promocode);

      const audit = queryRunner.manager.create(PromocodeAuditEntity, {
        promocodeId: savedPromocode.id,
        adminId,
        action: PromocodeAuditActionEnum.CREATED,
        newValues: {
          code: dto.code,
          valuePerClaim: dto.valuePerClaim,
          totalClaims: dto.totalClaims,
          asset: dto.asset,
          startsAt: dto.startsAt,
          endsAt: dto.endsAt,
          eligibilityRules: dto.eligibilityRules,
        },
      });

      await queryRunner.manager.save(audit);

      await queryRunner.commitTransaction();

      this.logger.log(`Admin ${adminId} created promocode ${dto.code}`);

      return this.mapToAdminResponseDto(savedPromocode);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getPromocodes(
    query: PromocodeListQueryDto,
  ): Promise<{ data: PromocodeAdminResponseDto[]; total: number }> {
    const { status, page = 1, limit = 20, search } = query;
    const skip = (page - 1) * limit;

    const whereCondition: any = {};

    if (status) {
      whereCondition.status = status;
    }

    if (search) {
      const sanitizedSearch = this.sanitizeLikeInput(search);
      whereCondition.code = Like(`%${sanitizedSearch}%`);
    }

    const [promocodes, total] = await this.promocodeRepository.findAndCount({
      where: whereCondition,
      relations: ['createdByAdmin'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const data = promocodes.map((promocode) => this.mapToAdminResponseDto(promocode));

    return { data, total };
  }

  async getPromocodeDetails(id: string): Promise<PromocodeAdminResponseDto> {
    const promocode = await this.promocodeRepository.findOne({
      where: { id },
      relations: ['createdByAdmin'],
    });

    if (!promocode) {
      throw new NotFoundException('Promocode not found');
    }

    const response = this.mapToAdminResponseDto(promocode);

    return response;
  }

  async updatePromocode(
    adminId: string,
    id: string,
    dto: UpdatePromocodeDto,
  ): Promise<PromocodeAdminResponseDto> {
    const promocode = await this.promocodeRepository.findOne({ where: { id } });

    if (!promocode) {
      throw new NotFoundException('Promocode not found');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const previousValues: Record<string, any> = {};
      const newValues: Record<string, any> = {};
      let auditAction = PromocodeAuditActionEnum.UPDATED;

      if (dto.status !== undefined) {
        previousValues.status = promocode.status;
        newValues.status = dto.status;
        promocode.status = dto.status;

        if (dto.status === PromocodeStatusEnum.PAUSED) {
          auditAction = PromocodeAuditActionEnum.PAUSED;
        } else if (
          dto.status === PromocodeStatusEnum.ACTIVE &&
          promocode.status !== PromocodeStatusEnum.ACTIVE
        ) {
          auditAction = PromocodeAuditActionEnum.RESUMED;
        } else if (dto.status === PromocodeStatusEnum.CANCELLED) {
          auditAction = PromocodeAuditActionEnum.CANCELLED;
        }
      }

      if (dto.endsAt !== undefined) {
        previousValues.endsAt = promocode.endsAt;
        newValues.endsAt = dto.endsAt;
        promocode.endsAt = dto.endsAt;
      }

      if (dto.note !== undefined) {
        previousValues.note = promocode.note;
        newValues.note = dto.note;
        promocode.note = dto.note;
      }

      const updatedPromocode = await queryRunner.manager.save(promocode);

      const audit = queryRunner.manager.create(PromocodeAuditEntity, {
        promocodeId: id,
        adminId,
        action: auditAction,
        previousValues,
        newValues,
      });

      await queryRunner.manager.save(audit);

      await queryRunner.commitTransaction();

      return this.mapToAdminResponseDto(updatedPromocode);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getPromocodeHistory(id: string): Promise<PromocodeAuditResponseDto[]> {
    const auditLogs = await this.promocodeAuditRepository.find({
      where: { promocodeId: id },
      relations: ['admin'],
      order: { createdAt: 'DESC' },
    });

    return auditLogs.map((audit) => this.mapToAuditResponseDto(audit));
  }

  async getPromocodeClaims(id: string): Promise<PromocodeClaimDto[]> {
    const promocode = await this.promocodeRepository.findOne({ where: { id } });
    if (!promocode) {
      throw new NotFoundException('Promocode not found');
    }

    const claims = await this.promocodeClaimRepository.find({
      where: { promocodeId: id },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    return claims.map((claim) => this.mapToClaimDto(claim));
  }

  private mapToAdminResponseDto(promocode: PromocodeEntity): PromocodeAdminResponseDto {
    const response = {
      ...promocode,
      remainingClaims: promocode.totalClaims - promocode.claimedCount,
      createdByAdminEmail: promocode.createdByAdmin?.email,
    };

    return response;
  }

  private mapToClaimDto(claim: PromocodeClaimEntity): PromocodeClaimDto {
    return {
      id: claim.id,
      userId: claim.userId,
      userEmail: claim.user?.email,
      amount: claim.amount,
      asset: claim.asset,
      ipAddress: claim.ipAddress,
      deviceFingerprint: claim.deviceFingerprint,
      userAgent: claim.userAgent,
      metadata: claim.metadata,
      createdAt: claim.createdAt,
    };
  }

  private mapToAuditResponseDto(audit: PromocodeAuditEntity): PromocodeAuditResponseDto {
    return {
      ...audit,
      adminEmail: audit.admin?.email,
    };
  }

  private sanitizeLikeInput(input: string): string {
    return input.replace(/[%_]/g, '\\$&');
  }
}
