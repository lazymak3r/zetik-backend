import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  UserEntity,
  UserVerificationEntity,
  VerificationBasicInfoEntity,
  VerificationDocumentEntity,
  VerificationLevel,
  VerificationStatus,
} from '@zetik/shared-entities';
import * as crypto from 'crypto';
import * as path from 'path';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { UploadService } from '../upload/upload.service';
import { DocumentUploadDto, DocumentUploadResponseDto } from './dto/document-upload.dto';
import { SubmitBasicInfoDto } from './dto/submit-basic-info.dto';
import { UserVerificationOverviewDto, VerificationStatusDto } from './dto/verification-status.dto';

@Injectable()
export class VerificationService {
  private readonly allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(UserVerificationEntity)
    private readonly verificationRepository: Repository<UserVerificationEntity>,
    @InjectRepository(VerificationDocumentEntity)
    private readonly documentRepository: Repository<VerificationDocumentEntity>,
    @InjectRepository(VerificationBasicInfoEntity)
    private readonly basicInfoRepository: Repository<VerificationBasicInfoEntity>,
    private readonly uploadService: UploadService,
  ) {}

  async getVerificationOverview(userId: string): Promise<UserVerificationOverviewDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const verifications = await this.verificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const basicInfo = verifications.find((v) => v.level === VerificationLevel.LEVEL_2_BASIC_INFO);
    const identity = verifications.find((v) => v.level === VerificationLevel.LEVEL_3_IDENTITY);

    // Calculate overall progress
    let progress = 0;
    if (user.isEmailVerified) progress += 33.33;
    if (basicInfo && basicInfo.status === VerificationStatus.APPROVED) progress += 33.33;
    if (identity && identity.status === VerificationStatus.APPROVED) progress += 33.34;

    return {
      emailVerified: user.isEmailVerified,
      basicInfo: basicInfo ? this.mapToVerificationStatusDto(basicInfo) : undefined,
      identity: identity ? this.mapToVerificationStatusDto(identity) : undefined,
      overallProgress: Math.round(progress),
    };
  }

  async submitBasicInfo(userId: string, dto: SubmitBasicInfoDto): Promise<void> {
    // Validate age (must be 18+)
    const birthDate = new Date(dto.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      throw new BadRequestException('You must be at least 18 years old to verify your account');
    }

    // Check if basic info already exists
    const existingBasicInfo = await this.basicInfoRepository.findOne({
      where: { userId },
    });

    if (existingBasicInfo) {
      // Update existing basic info
      await this.basicInfoRepository.update(existingBasicInfo.id, {
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: birthDate,
        phoneNumber: dto.phoneNumber,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        country: dto.country,
      });
    } else {
      // Create new basic info
      const basicInfo = this.basicInfoRepository.create({
        userId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: birthDate,
        phoneNumber: dto.phoneNumber,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        country: dto.country,
      });

      await this.basicInfoRepository.save(basicInfo);
    }

    // Create or update level 2 verification
    let verification = await this.verificationRepository.findOne({
      where: {
        userId,
        level: VerificationLevel.LEVEL_2_BASIC_INFO,
      },
    });

    if (verification) {
      verification.status = VerificationStatus.APPROVED;
      verification.updatedAt = new Date();
    } else {
      verification = this.verificationRepository.create({
        userId,
        level: VerificationLevel.LEVEL_2_BASIC_INFO,
        status: VerificationStatus.APPROVED,
      });
    }

    await this.verificationRepository.save(verification);
  }

  async uploadDocument(
    userId: string,
    file: any,
    dto: DocumentUploadDto,
  ): Promise<DocumentUploadResponseDto> {
    // Validate file
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, WebP images and PDF files are allowed',
      );
    }

    if (file.size > this.maxFileSize) {
      throw new BadRequestException('File size too large. Maximum size is 10MB');
    }

    // Ensure level 3 verification exists
    let verification = await this.verificationRepository.findOne({
      where: {
        userId,
        level: VerificationLevel.LEVEL_3_IDENTITY,
      },
    });

    if (!verification) {
      verification = this.verificationRepository.create({
        userId,
        level: VerificationLevel.LEVEL_3_IDENTITY,
        status: VerificationStatus.PENDING,
      });
      verification = await this.verificationRepository.save(verification);
    }

    try {
      // Generate secure file name
      const fileExtension = path.extname(file.originalname);
      const storedFileName = `${uuidv4()}-${crypto.randomBytes(8).toString('hex')}${fileExtension}`;
      const key = `verification/${storedFileName}`;

      // Upload to minIO
      const fileUrl = await this.uploadService.uploadWithCustomKey(file, key);

      // Create document record
      const document = this.documentRepository.create({
        verificationId: verification.id,
        documentType: dto.documentType,
        originalFileName: file.originalname,
        storedFileName,
        filePath: fileUrl, // Store the minIO URL instead of local path
        mimeType: file.mimetype,
        fileSize: file.size,
        status: VerificationStatus.PENDING,
      });

      const savedDocument = await this.documentRepository.save(document);

      // Update verification status to pending if it was not_started
      if (verification.status === VerificationStatus.NOT_STARTED) {
        verification.status = VerificationStatus.PENDING;
        await this.verificationRepository.save(verification);
      }

      return {
        id: savedDocument.id,
        documentType: savedDocument.documentType,
        originalFileName: savedDocument.originalFileName,
        fileSize: savedDocument.fileSize,
        uploadedAt: savedDocument.createdAt,
        status: savedDocument.status,
      };
    } catch (error) {
      console.error('Document upload failed:', error);
      throw new InternalServerErrorException('Failed to upload document');
    }
  }

  async getDocuments(userId: string): Promise<DocumentUploadResponseDto[]> {
    const verification = await this.verificationRepository.findOne({
      where: {
        userId,
        level: VerificationLevel.LEVEL_3_IDENTITY,
      },
      relations: ['documents'],
    });

    if (!verification) {
      return [];
    }

    const documents = await this.documentRepository.find({
      where: { verificationId: verification.id },
      order: { createdAt: 'DESC' },
    });

    return documents.map((doc) => ({
      id: doc.id,
      documentType: doc.documentType,
      originalFileName: doc.originalFileName,
      fileSize: doc.fileSize,
      uploadedAt: doc.createdAt,
      status: doc.status,
    }));
  }

  async deleteDocument(userId: string, documentId: string): Promise<void> {
    const verification = await this.verificationRepository.findOne({
      where: {
        userId,
        level: VerificationLevel.LEVEL_3_IDENTITY,
      },
    });

    if (!verification) {
      throw new NotFoundException('Verification not found');
    }

    const document = await this.documentRepository.findOne({
      where: {
        id: documentId,
        verificationId: verification.id,
      },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Only allow deletion if document is not approved
    if (document.status === VerificationStatus.APPROVED) {
      throw new BadRequestException('Cannot delete approved documents');
    }

    // Remove from database (minIO files remain accessible via URL)
    await this.documentRepository.remove(document);
  }

  async getBasicInfo(userId: string): Promise<VerificationBasicInfoEntity | null> {
    return this.basicInfoRepository.findOne({
      where: { userId },
    });
  }

  private mapToVerificationStatusDto(verification: UserVerificationEntity): VerificationStatusDto {
    return {
      level: verification.level,
      status: verification.status,
      rejectionReason: verification.rejectionReason,
      reviewedAt: verification.reviewedAt,
      expiresAt: verification.expiresAt,
      createdAt: verification.createdAt,
      updatedAt: verification.updatedAt,
    };
  }
}
