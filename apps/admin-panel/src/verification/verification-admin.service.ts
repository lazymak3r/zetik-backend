import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  UserVerificationEntity,
  VerificationBasicInfoEntity,
  VerificationDocumentEntity,
  VerificationLevel,
  VerificationStatus,
} from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { AdminVerificationResponseDto } from './dto/admin-verification-response.dto';
import { ReviewVerificationDto } from './dto/review-verification.dto';
import { VerificationListQueryDto } from './dto/verification-list-query.dto';

@Injectable()
export class VerificationAdminService {
  constructor(
    @InjectRepository(UserVerificationEntity)
    private readonly verificationRepository: Repository<UserVerificationEntity>,
    @InjectRepository(VerificationDocumentEntity)
    private readonly documentRepository: Repository<VerificationDocumentEntity>,
    @InjectRepository(VerificationBasicInfoEntity)
    private readonly basicInfoRepository: Repository<VerificationBasicInfoEntity>,
  ) {}

  async getPendingVerifications(
    query: VerificationListQueryDto,
  ): Promise<AdminVerificationResponseDto[]> {
    const queryBuilder = this.verificationRepository
      .createQueryBuilder('verification')
      .leftJoinAndSelect('verification.user', 'user')
      .where('verification.status = :status', { status: VerificationStatus.PENDING });

    if (query.level) {
      queryBuilder.andWhere('verification.level = :level', { level: query.level });
    }

    if (query.limit) {
      queryBuilder.limit(query.limit);
    }

    if (query.offset) {
      queryBuilder.offset(query.offset);
    }

    queryBuilder.orderBy('verification.createdAt', 'ASC');

    const verifications = await queryBuilder.getMany();
    return this.mapToAdminResponseDto(verifications);
  }

  async getAllVerifications(
    query: VerificationListQueryDto,
  ): Promise<AdminVerificationResponseDto[]> {
    const queryBuilder = this.verificationRepository
      .createQueryBuilder('verification')
      .leftJoinAndSelect('verification.user', 'user');

    if (query.status) {
      queryBuilder.where('verification.status = :status', { status: query.status });
    }

    if (query.level) {
      queryBuilder.andWhere('verification.level = :level', { level: query.level });
    }

    if (query.userId) {
      queryBuilder.andWhere('verification.userId = :userId', { userId: query.userId });
    }

    if (query.limit) {
      queryBuilder.limit(query.limit);
    }

    if (query.offset) {
      queryBuilder.offset(query.offset);
    }

    queryBuilder.orderBy('verification.createdAt', 'DESC');

    const verifications = await queryBuilder.getMany();
    return this.mapToAdminResponseDto(verifications);
  }

  async getVerificationDetails(verificationId: string): Promise<AdminVerificationResponseDto> {
    const verification = await this.verificationRepository.findOne({
      where: { id: verificationId },
      relations: ['user'],
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    const mapped = await this.mapToAdminResponseDto([verification]);
    return mapped[0];
  }

  async reviewVerification(verificationId: string, dto: ReviewVerificationDto): Promise<void> {
    const verification = await this.verificationRepository.findOne({
      where: { id: verificationId },
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    if (verification.status !== VerificationStatus.PENDING) {
      throw new BadRequestException('Only pending verifications can be reviewed');
    }

    // Update verification
    verification.status = dto.status;
    verification.rejectionReason = dto.rejectionReason;
    verification.adminNotes = dto.adminNotes;
    verification.reviewedBy = dto.reviewedBy;
    verification.reviewedAt = new Date();

    if (dto.status === VerificationStatus.APPROVED && dto.expiresAt) {
      verification.expiresAt = new Date(dto.expiresAt);
    }

    await this.verificationRepository.save(verification);

    // If this is identity verification, also update document statuses
    if (verification.level === VerificationLevel.LEVEL_3_IDENTITY) {
      const documents = await this.documentRepository.find({
        where: { verificationId: verification.id },
      });

      for (const document of documents) {
        if (document.status === VerificationStatus.PENDING) {
          document.status = dto.status;
          document.rejectionReason = dto.rejectionReason;
          await this.documentRepository.save(document);
        }
      }
    }
  }

  async getDocumentById(documentId: string): Promise<VerificationDocumentEntity> {
    const document = await this.documentRepository.findOne({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  private async mapToAdminResponseDto(
    verifications: UserVerificationEntity[],
  ): Promise<AdminVerificationResponseDto[]> {
    const result: AdminVerificationResponseDto[] = [];

    for (const verification of verifications) {
      let documents: VerificationDocumentEntity[] = [];
      let basicInfo: VerificationBasicInfoEntity | null = null;

      // Get documents for identity verifications
      if (verification.level === VerificationLevel.LEVEL_3_IDENTITY) {
        documents = await this.documentRepository.find({
          where: { verificationId: verification.id },
          order: { createdAt: 'DESC' },
        });
      }

      // Get basic info for basic info verifications
      if (verification.level === VerificationLevel.LEVEL_2_BASIC_INFO) {
        basicInfo = await this.basicInfoRepository.findOne({
          where: { userId: verification.userId },
        });
      }

      result.push({
        id: verification.id,
        userId: verification.userId,
        level: verification.level,
        status: verification.status,
        rejectionReason: verification.rejectionReason,
        adminNotes: verification.adminNotes,
        reviewedBy: verification.reviewedBy,
        reviewedAt: verification.reviewedAt,
        expiresAt: verification.expiresAt,
        createdAt: verification.createdAt,
        updatedAt: verification.updatedAt,
        user: {
          id: verification.user.id,
          username: verification.user.username,
          email: verification.user.email,
          createdAt: verification.user.createdAt,
        },
        documents: documents.map((doc) => ({
          id: doc.id,
          documentType: doc.documentType,
          originalFileName: doc.originalFileName,
          fileSize: doc.fileSize,
          mimeType: doc.mimeType,
          status: doc.status,
          rejectionReason: doc.rejectionReason,
          createdAt: doc.createdAt,
        })),
        basicInfo: basicInfo
          ? {
              firstName: basicInfo.firstName,
              lastName: basicInfo.lastName,
              dateOfBirth: basicInfo.dateOfBirth,
              phoneNumber: basicInfo.phoneNumber,
              address: basicInfo.address,
              city: basicInfo.city,
              state: basicInfo.state,
              postalCode: basicInfo.postalCode,
              country: basicInfo.country,
              createdAt: basicInfo.createdAt,
            }
          : undefined,
      });
    }

    return result;
  }
}
