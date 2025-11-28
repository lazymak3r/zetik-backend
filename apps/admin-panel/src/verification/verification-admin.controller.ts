import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminVerificationResponseDto } from './dto/admin-verification-response.dto';
import { ReviewVerificationDto } from './dto/review-verification.dto';
import { VerificationListQueryDto } from './dto/verification-list-query.dto';
import { VerificationAdminService } from './verification-admin.service';

@ApiTags('admin-verification')
@Controller('verification')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VerificationAdminController {
  constructor(private readonly verificationService: VerificationAdminService) {}

  @Get('pending')
  @ApiOperation({
    summary: 'Get pending verifications',
    description: 'Returns list of verifications pending admin review',
  })
  @ApiResponse({
    status: 200,
    description: 'List of pending verifications',
    type: [AdminVerificationResponseDto],
  })
  async getPendingVerifications(
    @Query() query: VerificationListQueryDto,
  ): Promise<AdminVerificationResponseDto[]> {
    return this.verificationService.getPendingVerifications(query);
  }

  @Get('all')
  @ApiOperation({
    summary: 'Get all verifications',
    description: 'Returns list of all verifications with filtering options',
  })
  @ApiResponse({
    status: 200,
    description: 'List of all verifications',
    type: [AdminVerificationResponseDto],
  })
  async getAllVerifications(
    @Query() query: VerificationListQueryDto,
  ): Promise<AdminVerificationResponseDto[]> {
    return this.verificationService.getAllVerifications(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get verification details',
    description: 'Returns detailed information about a specific verification',
  })
  @ApiResponse({
    status: 200,
    description: 'Verification details',
    type: AdminVerificationResponseDto,
  })
  async getVerificationDetails(
    @Param('id', ParseUUIDPipe) verificationId: string,
  ): Promise<AdminVerificationResponseDto> {
    return this.verificationService.getVerificationDetails(verificationId);
  }

  @Patch(':id/review')
  @ApiOperation({
    summary: 'Review and approve/reject verification',
    description: 'Approve or reject a verification with optional notes',
  })
  @ApiResponse({
    status: 200,
    description: 'Verification reviewed successfully',
  })
  async reviewVerification(
    @Param('id', ParseUUIDPipe) verificationId: string,
    @Body() dto: ReviewVerificationDto,
  ): Promise<void> {
    return this.verificationService.reviewVerification(verificationId, dto);
  }

  @Get('documents/:id/download')
  @ApiOperation({
    summary: 'Download verification document',
    description: 'Download a verification document file',
  })
  @ApiResponse({
    status: 200,
    description: 'Document file',
  })
  async downloadDocument(
    @Param('id', ParseUUIDPipe) documentId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const document = await this.verificationService.getDocumentById(documentId);

    if (!fs.existsSync(document.filePath)) {
      throw new NotFoundException('Document file not found');
    }

    const file = fs.createReadStream(document.filePath);

    res.set({
      'Content-Type': document.mimeType,
      'Content-Disposition': `attachment; filename="${document.originalFileName}"`,
    });

    return new StreamableFile(file);
  }
}
