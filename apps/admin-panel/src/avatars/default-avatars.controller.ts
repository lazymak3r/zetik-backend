import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminActionTypeEnum } from '@zetik/shared-entities';
import { AuditLog } from '../audit/decorators/audit-log.decorator';
import { AuditLogInterceptor } from '../audit/interceptors/audit-log.interceptor';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DefaultAvatarsService } from './default-avatars.service';
import {
  DefaultAvatarResponseDto,
  UpdateDefaultAvatarDto,
  UploadDefaultAvatarDto,
} from './dto/default-avatar.dto';

@ApiTags('default-avatars')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('avatars/default')
export class DefaultAvatarsController {
  constructor(private readonly defaultAvatarsService: DefaultAvatarsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all default avatars',
    description: 'Retrieve all system-wide default avatars including inactive ones',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns list of default avatars',
    type: [DefaultAvatarResponseDto],
  })
  @AuditLog({
    action: AdminActionTypeEnum.VIEW,
    resource: 'default-avatars',
    getDetails: () => ({ action: 'list-default-avatars' }),
  })
  async getAllDefaultAvatars(): Promise<DefaultAvatarResponseDto[]> {
    return this.defaultAvatarsService.getAllDefaultAvatars();
  }

  @Get('active')
  @ApiOperation({
    summary: 'Get active default avatars',
    description: 'Retrieve only active system-wide default avatars',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns list of active default avatars',
    type: [DefaultAvatarResponseDto],
  })
  @AuditLog({
    action: AdminActionTypeEnum.VIEW,
    resource: 'default-avatars',
    getDetails: () => ({ action: 'list-active-default-avatars' }),
  })
  async getActiveDefaultAvatars(): Promise<DefaultAvatarResponseDto[]> {
    return this.defaultAvatarsService.getActiveDefaultAvatars();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get default avatar by ID',
    description: 'Retrieve a specific default avatar',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns default avatar',
    type: DefaultAvatarResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Default avatar not found',
  })
  @AuditLog({
    action: AdminActionTypeEnum.VIEW,
    resource: 'default-avatars',
    getResourceId: (args) => args[0] as string,
  })
  async getDefaultAvatarById(@Param('id') id: string): Promise<DefaultAvatarResponseDto> {
    return this.defaultAvatarsService.getDefaultAvatarById(id);
  }

  @Post()
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload new default avatar',
    description:
      'Upload a new system-wide default avatar. Accepts JPEG, PNG, WebP, AVIF images up to 5MB.',
  })
  @ApiBody({
    description: 'Avatar file and metadata',
    schema: {
      type: 'object',
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Avatar image file',
        },
        displayOrder: {
          type: 'string',
          description: 'Display order (0-9999)',
          example: '0',
          default: '0',
        },
        description: {
          type: 'string',
          description: 'Optional description',
          example: 'Cool avatar',
        },
      },
      required: ['avatar'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Default avatar uploaded successfully',
    type: DefaultAvatarResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type or size',
  })
  @AuditLog({
    action: AdminActionTypeEnum.CREATE,
    resource: 'default-avatars',
    getDetails: (args) => {
      const uploadDto = args[1] as UploadDefaultAvatarDto;
      return {
        displayOrder: uploadDto?.displayOrder,
        description: uploadDto?.description,
      };
    },
  })
  async uploadDefaultAvatar(
    @UploadedFile() file: any,
    @Body() uploadDto: UploadDefaultAvatarDto,
  ): Promise<DefaultAvatarResponseDto> {
    // Convert displayOrder from string to number (FormData sends everything as string)
    const displayOrder = uploadDto.displayOrder ? parseInt(uploadDto.displayOrder, 10) : 0;

    return this.defaultAvatarsService.uploadDefaultAvatar(
      file,
      displayOrder,
      uploadDto.description,
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update default avatar',
    description: 'Update default avatar metadata (display order, active status, description)',
  })
  @ApiResponse({
    status: 200,
    description: 'Default avatar updated successfully',
    type: DefaultAvatarResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Default avatar not found',
  })
  @AuditLog({
    action: AdminActionTypeEnum.UPDATE,
    resource: 'default-avatars',
    getResourceId: (args) => args[0] as string,
    getDetails: (args) => {
      const updateDto = args[1] as UpdateDefaultAvatarDto;
      return { updates: updateDto };
    },
  })
  async updateDefaultAvatar(
    @Param('id') id: string,
    @Body() updateDto: UpdateDefaultAvatarDto,
  ): Promise<DefaultAvatarResponseDto> {
    return this.defaultAvatarsService.updateDefaultAvatar(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete default avatar',
    description:
      'Permanently delete a default avatar. This will also remove the file from storage.',
  })
  @ApiResponse({
    status: 200,
    description: 'Default avatar deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Default avatar not found',
  })
  @AuditLog({
    action: AdminActionTypeEnum.DELETE,
    resource: 'default-avatars',
    getResourceId: (args) => args[0] as string,
  })
  async deleteDefaultAvatar(@Param('id') id: string): Promise<{ message: string }> {
    await this.defaultAvatarsService.deleteDefaultAvatar(id);
    return { message: 'Default avatar deleted successfully' };
  }
}
