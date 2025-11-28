import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserEntity } from '@zetik/shared-entities';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DocumentUploadDto, DocumentUploadResponseDto } from './dto/document-upload.dto';
import { SubmitBasicInfoDto } from './dto/submit-basic-info.dto';
import { UserVerificationOverviewDto } from './dto/verification-status.dto';
import { VerificationService } from './verification.service';

@ApiTags('verification')
@Controller('verification')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Get verification status overview',
    description:
      'Returns the current verification status for all levels (email, basic info, identity)',
  })
  @ApiResponse({
    status: 200,
    description: 'Verification status overview',
    type: UserVerificationOverviewDto,
  })
  async getVerificationStatus(
    @CurrentUser() user: UserEntity,
  ): Promise<UserVerificationOverviewDto> {
    return this.verificationService.getVerificationOverview(user.id);
  }

  @Post('basic-info')
  @ApiOperation({
    summary: 'Submit basic information for Level 2 verification',
    description:
      'Submit personal information required for Level 2 verification. User must be 18+ years old.',
  })
  @ApiResponse({
    status: 201,
    description: 'Basic information submitted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or user under 18',
  })
  async submitBasicInfo(
    @CurrentUser() user: UserEntity,
    @Body() dto: SubmitBasicInfoDto,
  ): Promise<void> {
    return this.verificationService.submitBasicInfo(user.id, dto);
  }

  @Get('basic-info')
  @ApiOperation({
    summary: 'Get current basic information',
    description: 'Returns the submitted basic information if available',
  })
  @ApiResponse({
    status: 200,
    description: 'Basic information data',
  })
  async getBasicInfo(@CurrentUser() user: UserEntity) {
    return this.verificationService.getBasicInfo(user.id);
  }

  @Post('documents')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload identity document',
    description:
      'Upload identity documents for Level 3 verification. Accepts JPEG, PNG, WebP images and PDF files up to 10MB.',
  })
  @ApiResponse({
    status: 201,
    description: 'Document uploaded successfully',
    type: DocumentUploadResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type or size',
  })
  async uploadDocument(
    @CurrentUser() user: UserEntity,
    @UploadedFile() file: any,
    @Body() dto: DocumentUploadDto,
  ): Promise<DocumentUploadResponseDto> {
    return this.verificationService.uploadDocument(user.id, file, dto);
  }

  @Get('documents')
  @ApiOperation({
    summary: 'Get uploaded documents',
    description: 'Returns list of uploaded identity documents with their status',
  })
  @ApiResponse({
    status: 200,
    description: 'List of uploaded documents',
    type: [DocumentUploadResponseDto],
  })
  async getDocuments(@CurrentUser() user: UserEntity): Promise<DocumentUploadResponseDto[]> {
    return this.verificationService.getDocuments(user.id);
  }

  @Delete('documents/:id')
  @ApiOperation({
    summary: 'Delete uploaded document',
    description: 'Delete an uploaded document. Only pending or rejected documents can be deleted.',
  })
  @ApiResponse({
    status: 200,
    description: 'Document deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete approved documents',
  })
  @ApiResponse({
    status: 404,
    description: 'Document not found',
  })
  async deleteDocument(
    @CurrentUser() user: UserEntity,
    @Param('id', ParseUUIDPipe) documentId: string,
  ): Promise<void> {
    return this.verificationService.deleteDocument(user.id, documentId);
  }
}
