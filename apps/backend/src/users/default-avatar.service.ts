import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DefaultAvatarEntity } from '@zetik/shared-entities';
import { Repository } from 'typeorm';
import { UploadService } from '../upload/upload.service';
import {
  DefaultAvatarDto,
  DefaultAvatarUploadResponseDto,
  UpdateDefaultAvatarDto,
} from './dto/default-avatar.dto';

@Injectable()
export class DefaultAvatarService {
  private readonly logger = new Logger(DefaultAvatarService.name);

  constructor(
    @InjectRepository(DefaultAvatarEntity)
    private readonly defaultAvatarRepository: Repository<DefaultAvatarEntity>,
    private readonly uploadService: UploadService,
  ) {}

  async getActiveDefaultAvatars(): Promise<DefaultAvatarDto[]> {
    const avatars = await this.defaultAvatarRepository.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC', createdAt: 'ASC' },
    });

    return avatars.map((avatar) => this.toDto(avatar));
  }

  async getAllDefaultAvatars(): Promise<DefaultAvatarDto[]> {
    const avatars = await this.defaultAvatarRepository.find({
      order: { displayOrder: 'ASC', createdAt: 'ASC' },
    });

    return avatars.map((avatar) => this.toDto(avatar));
  }

  async getDefaultAvatarById(id: string): Promise<DefaultAvatarEntity> {
    const avatar = await this.defaultAvatarRepository.findOne({ where: { id } });

    if (!avatar) {
      throw new NotFoundException(`Default avatar with ID ${id} not found`);
    }

    return avatar;
  }

  async uploadDefaultAvatar(
    file: any,
    displayOrder: number,
    description?: string,
  ): Promise<DefaultAvatarUploadResponseDto> {
    // Upload file to MinIO
    const avatarUrl = await this.uploadService.upload(file, 'avatars');

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

    this.logger.log(`Default avatar uploaded: ${saved.id} (${file.originalname})`);

    return {
      defaultAvatar: this.toDto(saved),
      message: 'Default avatar uploaded successfully',
    };
  }

  async updateDefaultAvatar(
    id: string,
    updateDto: UpdateDefaultAvatarDto,
  ): Promise<DefaultAvatarDto> {
    const avatar = await this.getDefaultAvatarById(id);

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

    this.logger.log(`Default avatar updated: ${id}`);

    return this.toDto(updated);
  }

  async deleteDefaultAvatar(id: string): Promise<void> {
    const avatar = await this.getDefaultAvatarById(id);

    // Delete file from MinIO
    try {
      const key = this.uploadService.extractKeyFromUrl(avatar.avatarUrl);
      await this.uploadService.deleteFile(key);
    } catch (error) {
      this.logger.warn(`Failed to delete file for default avatar ${id}:`, error);
    }

    // Delete from database
    await this.defaultAvatarRepository.remove(avatar);

    this.logger.log(`Default avatar deleted: ${id}`);
  }

  private toDto(entity: DefaultAvatarEntity): DefaultAvatarDto {
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
