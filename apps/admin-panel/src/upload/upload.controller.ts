import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UploadService } from './upload.service';

@Controller('upload')
@ApiTags('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Get('list')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List files in a directory' })
  @ApiQuery({ name: 'directory', required: false })
  @ApiResponse({ type: [String] })
  async listFiles(@Query('directory') directory?: string) {
    return this.uploadService.listFiles(directory);
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload a file to MinIO' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        directory: {
          type: 'string',
          description: 'Target folder inside bucket',
          example: 'images',
        },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, cb) => {
        const allowed = ['image/avif', 'image/webp', 'image/svg+xml', 'image/png', 'image/jpeg'];
        if (!allowed.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Invalid file type. Use .avif, .webp, .svg, .png or .jpg'),
            false,
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 200 * 1024 },
    }),
  )
  async upload(@UploadedFile() file: any, @Body('directory') directory?: string) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    try {
      const path = await this.uploadService.upload(file, directory);
      return { path };
    } catch (err) {
      if ((err as any).code === 'LIMIT_FILE_SIZE') {
        throw new BadRequestException(
          'File too large. Please use .avif, .webp, .svg, .png or .jpg and reduce dimensions',
        );
      }
      throw err;
    }
  }
}
