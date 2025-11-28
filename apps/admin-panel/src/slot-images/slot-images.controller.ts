import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminActionTypeEnum } from '@zetik/shared-entities';
import { AuditLog } from '../audit/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../audit/interceptors/audit-log.interceptor';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { SlotImageBatchUploadResponseDto, SlotImageResponseDto } from './dto/slot-image.dto';
import { SlotImagesService } from './slot-images.service';

@ApiTags('slot-images')
@Controller('slot-images')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(AuditLogInterceptor)
export class SlotImagesController {
  constructor(private readonly slotImagesService: SlotImagesService) {}

  @Get('list')
  @ApiOperation({ summary: 'List slot images in a directory' })
  @ApiQuery({
    name: 'directory',
    required: true,
    description: 'Root directory (required)',
  })
  @ApiResponse({
    status: 200,
    description: 'Tracked slot images for the directory',
    type: [SlotImageResponseDto],
  })
  @AuditLog({ action: AdminActionTypeEnum.VIEW, resource: 'slot-images' })
  async list(@Query('directory') directory: string): Promise<SlotImageResponseDto[]> {
    const targetDir = directory?.trim();
    if (!targetDir) {
      throw new BadRequestException('directory is required');
    }

    return this.slotImagesService.list(targetDir);
  }

  @Post('upload/batch')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Batch upload slot images',
    description:
      'Upload multiple images at once. Optionally preserve client folder structure using relative paths.',
  })
  @ApiBody({
    description: 'Multiple image files',
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
        directory: {
          type: 'string',
          example: 'slots/awesome-game',
          description: 'Root directory under the bucket (required)',
        },
      },
      required: ['files', 'directory'],
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', 200, {
      fileFilter: (req, file, cb) => {
        const allowed = ['image/avif', 'image/webp', 'image/png', 'image/jpeg', 'image/svg+xml'];
        if (!allowed.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Invalid type. Use .avif, .webp, .png, .jpg, or .svg'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024, files: 200 },
    }),
  )
  @ApiResponse({
    status: 201,
    description: 'Uploaded result for each file including persisted metadata when available',
    type: SlotImageBatchUploadResponseDto,
  })
  @AuditLog({ action: AdminActionTypeEnum.CREATE, resource: 'slot-images' })
  async uploadBatch(
    @CurrentAdmin('id') adminId: string,
    @UploadedFiles() files: any[],
    @Body('directory') directory: string,
  ): Promise<SlotImageBatchUploadResponseDto> {
    const targetDir = directory && directory.trim();
    if (!targetDir) {
      throw new BadRequestException('directory is required');
    }
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one image is required');
    }

    return this.slotImagesService.uploadBatch({
      directory: targetDir,
      files,
      uploadedBy: adminId,
    });
  }

  @Delete('bulk')
  @ApiOperation({ summary: 'Bulk delete slot images' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        keys: {
          type: 'array',
          items: { type: 'string' },
          description: 'S3 object keys relative to the bucket',
        },
      },
      required: ['keys'],
    },
  })
  @ApiResponse({ status: 200, description: 'Deletion results per key' })
  @AuditLog({ action: AdminActionTypeEnum.DELETE, resource: 'slot-images' })
  async bulkDelete(@Body('keys') keys: string[]) {
    if (!Array.isArray(keys) || keys.length === 0) {
      throw new BadRequestException('keys array is required');
    }
    return this.slotImagesService.bulkDelete(keys);
  }
}
