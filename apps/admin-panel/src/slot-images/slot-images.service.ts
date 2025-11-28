import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SlotImageEntity } from '@zetik/shared-entities';
import { Like, Repository } from 'typeorm';
import { UploadService } from '../upload/upload.service';
import {
  SlotImageBatchResultDto,
  SlotImageBatchUploadResponseDto,
  SlotImageResponseDto,
} from './dto/slot-image.dto';
import { UploadBatchParams } from './types/upload-batch-params.type';

@Injectable()
export class SlotImagesService {
  private readonly logger = new Logger(SlotImagesService.name);

  constructor(
    private readonly uploadService: UploadService,
    @InjectRepository(SlotImageEntity)
    private readonly slotImageRepository: Repository<SlotImageEntity>,
  ) {}

  async list(directory: string): Promise<SlotImageResponseDto[]> {
    const images = await this.slotImageRepository.find({
      where: { directory },
      order: { createdAt: 'DESC' },
    });

    return images.map((image) => this.toDto(image));
  }

  async uploadBatch(params: UploadBatchParams): Promise<SlotImageBatchUploadResponseDto> {
    const { directory, files, uploadedBy } = params;

    const results: SlotImageBatchResultDto[] = [];
    const concurrency = 5;
    let index = 0;

    const next = async () => {
      const i = index++;
      if (i >= files.length) return;
      const file = files[i];

      try {
        const normalizedOriginalName = this.buildSafeFileName(
          file.originalname,
          file.originalname,
        ).toLowerCase();

        if (normalizedOriginalName.length > 255) {
          throw new BadRequestException(
            `File name "${file.originalname}" is too long. Maximum allowed length is 255 characters.`,
          );
        }

        const url = await this.uploadService.upload(
          { ...file, originalname: normalizedOriginalName },
          directory,
          true,
        );
        this.logger.log(`Uploaded ${normalizedOriginalName} to ${url}`);
        const key = this.uploadService.extractKeyFromUrl(url);
        const fileName = (key.split('/').pop() ?? normalizedOriginalName).toLowerCase();

        const metadata = await this.upsertSlotImage({
          directory,
          fileName,
          key,
          url,
          sizeBytes: file.size,
          mimeType: file.mimetype,
          uploadedBy,
        });
        results[i] = {
          fileName,
          key,
          url,
          size: file.size,
          mimeType: file.mimetype,
          status: 'success',
          uploadedBy,
          metadata,
        };
      } catch (e: any) {
        this.logger.warn(`Failed to upload ${file.originalname}: ${e?.message || e}`);
        results[i] = {
          fileName: file.originalname.toLowerCase(),
          key: `${directory}/${file.originalname}`,
          size: file.size,
          mimeType: file.mimetype,
          status: 'failed',
          error: e?.message || 'Upload failed',
          uploadedBy,
        };
      }
      await next();
    };

    const workers = Array.from({ length: Math.min(concurrency, files.length) }, () => next());
    await Promise.all(workers);

    return {
      directory,
      results,
      succeeded: results.filter((r) => r.status === 'success').length,
      failed: results.filter((r) => r.status === 'failed').length,
    };
  }

  async bulkDelete(keys: string[]) {
    const results: Array<{ key: string; status: 'deleted' | 'failed'; error?: string }> = [];
    for (const key of keys) {
      try {
        await this.uploadService.deleteFile(key);
        this.logger.log(`Deleted slot image ${key}.`);
        await this.slotImageRepository.delete({ key });
        results.push({ key, status: 'deleted' });
      } catch (e: any) {
        this.logger.warn(`Failed deleting ${key}: ${e?.message || e}`);
        results.push({ key, status: 'failed', error: e?.message || 'Delete failed' });
      }
    }
    return { results };
  }

  private async findExistingImagesByBaseName(
    directory: string,
    baseName: string,
  ): Promise<SlotImageEntity[]> {
    return this.slotImageRepository.find({
      where: {
        directory,
        fileName: Like(`${this.sanitizeFileNamePart(baseName)}.%`),
      },
    });
  }

  private async upsertSlotImage(payload: {
    directory: string;
    fileName: string;
    key: string;
    url: string;
    sizeBytes: number;
    mimeType: string;
    uploadedBy: string;
  }): Promise<SlotImageResponseDto | undefined> {
    try {
      const baseName = payload.fileName.replace(/\.[^/.]+$/, '');
      const existingImages = await this.findExistingImagesByBaseName(payload.directory, baseName);

      const imagesToDelete = existingImages.filter((img) => img.key !== payload.key);

      for (const image of imagesToDelete) {
        try {
          await this.uploadService.deleteFile(image.key);
          await this.slotImageRepository.delete({ key: image.key });
        } catch (error: any) {
          this.logger.warn(
            `Failed to delete old slot image ${image.fileName} (${image.key}): ${error?.message || error}`,
          );
        }
      }

      await this.slotImageRepository.upsert(
        {
          directory: payload.directory,
          fileName: payload.fileName,
          key: payload.key,
          url: payload.url,
          sizeBytes: payload.sizeBytes.toString(),
          mimeType: payload.mimeType,
          uploadedBy: payload.uploadedBy,
        },
        ['key'],
      );
      const record = await this.slotImageRepository.findOne({ where: { key: payload.key } });
      return record ? this.toDto(record) : undefined;
    } catch (error) {
      this.logger.error(
        `Failed to persist metadata for slot image ${payload.fileName} (${payload.key})`,
        error,
      );
      return undefined;
    }
  }

  private toDto(entity: SlotImageEntity): SlotImageResponseDto {
    return {
      id: entity.id,
      directory: entity.directory,
      fileName: entity.fileName,
      key: entity.key,
      url: entity.url,
      sizeBytes: Number(entity.sizeBytes),
      mimeType: entity.mimeType,
      uploadedBy: entity.uploadedBy,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private buildSafeFileName(desiredName: string, fallbackFileName: string): string {
    const trimmed = desiredName.trim();
    const desiredParts = this.splitFileName(trimmed);
    const fallbackParts = this.splitFileName(fallbackFileName);

    const sanitizedBase = this.sanitizeFileNamePart(desiredParts.name || fallbackParts.name);
    const sanitizedExtension = this.sanitizeExtension(
      desiredParts.extension || fallbackParts.extension,
    );

    const baseCapped = this.enforceMaxLength(sanitizedBase, sanitizedExtension);
    return sanitizedExtension ? `${baseCapped}.${sanitizedExtension}` : baseCapped;
  }

  private sanitizeFileNamePart(part: string): string {
    const cleaned = part
      .replace(/[\r\n]+/g, ' ')
      .replace(/[\\/]+/g, '-')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^[-.]+/, '')
      .replace(/[-.]+$/, '');
    return cleaned || 'image';
  }

  private sanitizeExtension(ext: string): string {
    return ext.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  }

  private enforceMaxLength(base: string, extension: string, limit = 255): string {
    if (extension) {
      const allowed = limit - (extension.length + 1);
      if (base.length > allowed) {
        const trimmed = base.slice(0, Math.max(1, allowed));
        return trimmed || 'image';
      }
      return base || 'image';
    }
    if (base.length > limit) {
      const trimmed = base.slice(0, Math.max(1, limit));
      return trimmed || 'image';
    }
    return base || 'image';
  }

  private splitFileName(fileName: string): { name: string; extension: string } {
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot <= 0 || lastDot === fileName.length - 1) {
      return { name: fileName, extension: '' };
    }
    return {
      name: fileName.slice(0, lastDot),
      extension: fileName.slice(lastDot + 1),
    };
  }
}
