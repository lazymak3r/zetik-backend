import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DefaultAvatarEntity } from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { UploadService } from '../upload/upload.service';
import { DefaultAvatarResponseDto, UpdateDefaultAvatarDto } from './dto/default-avatar.dto';

@Injectable()
export class DefaultAvatarsService {
  private readonly logger = new Logger(DefaultAvatarsService.name);

  constructor(
    @InjectRepository(DefaultAvatarEntity)
    private readonly defaultAvatarRepository: Repository<DefaultAvatarEntity>,
    private readonly uploadService: UploadService,
  ) {}

  async getAllDefaultAvatars(): Promise<DefaultAvatarResponseDto[]> {
    const avatars = await this.defaultAvatarRepository.find({
      order: { displayOrder: 'ASC', createdAt: 'ASC' },
    });

    return avatars.map((avatar) => this.toDto(avatar));
  }

  async getActiveDefaultAvatars(): Promise<DefaultAvatarResponseDto[]> {
    const avatars = await this.defaultAvatarRepository.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC', createdAt: 'ASC' },
    });

    return avatars.map((avatar) => this.toDto(avatar));
  }

  async getDefaultAvatarById(id: string): Promise<DefaultAvatarResponseDto> {
    const avatar = await this.defaultAvatarRepository.findOne({ where: { id } });

    if (!avatar) {
      throw new NotFoundException(`Default avatar with ID ${id} not found`);
    }

    return this.toDto(avatar);
  }

  async uploadDefaultAvatar(
    file: any,
    displayOrder: number,
    description?: string,
  ): Promise<DefaultAvatarResponseDto> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, WebP, and AVIF images are allowed.',
      );
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException('File size too large. Maximum size is 5MB.');
    }

    try {
      // Upload file to MinIO in default-avatars directory
      const avatarUrl = await this.uploadService.upload(file, 'default-avatars');

      // Create default avatar entity
      const defaultAvatar = this.defaultAvatarRepository.create({
        avatarUrl,
        originalFilename: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        displayOrder,
        description,
        isActive: true,
      });

      const saved = await this.defaultAvatarRepository.save(defaultAvatar);

      this.logger.log(`Default avatar uploaded: ${saved.id} (${file.originalname}) by admin`);

      return this.toDto(saved);
    } catch (error) {
      this.logger.error('Failed to upload default avatar:', error);
      throw new BadRequestException('Failed to upload default avatar');
    }
  }

  async updateDefaultAvatar(
    id: string,
    updateDto: UpdateDefaultAvatarDto,
  ): Promise<DefaultAvatarResponseDto> {
    const avatar = await this.defaultAvatarRepository.findOne({ where: { id } });

    if (!avatar) {
      throw new NotFoundException(`Default avatar with ID ${id} not found`);
    }

    if (updateDto.displayOrder !== undefined) {
      avatar.displayOrder = updateDto.displayOrder;
    }

    if (updateDto.isActive !== undefined) {
      avatar.isActive = updateDto.isActive;
    }

    if (updateDto.description !== undefined) {
      avatar.description = updateDto.description;
    }

    const updated = await this.defaultAvatarRepository.save(avatar);

    this.logger.log(`Default avatar updated: ${id} by admin`);

    return this.toDto(updated);
  }

  async deleteDefaultAvatar(id: string): Promise<void> {
    const avatar = await this.defaultAvatarRepository.findOne({ where: { id } });

    if (!avatar) {
      throw new NotFoundException(`Default avatar with ID ${id} not found`);
    }

    // Delete file from MinIO
    try {
      const key = this.uploadService.extractKeyFromUrl(avatar.avatarUrl);
      await this.uploadService.deleteFile(key);
    } catch (error) {
      this.logger.warn(`Failed to delete file for default avatar ${id}:`, error);
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database
    await this.defaultAvatarRepository.remove(avatar);

    this.logger.log(`Default avatar deleted: ${id} by admin`);
  }

  private toDto(entity: DefaultAvatarEntity): DefaultAvatarResponseDto {
    return {
      id: entity.id,
      avatarUrl: entity.avatarUrl,
      originalFilename: entity.originalFilename,
      fileSize: entity.fileSize,
      mimeType: entity.mimeType,
      displayOrder: entity.displayOrder,
      isActive: entity.isActive,
      description: entity.description,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
