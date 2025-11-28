import { ApiProperty } from '@nestjs/swagger';
import { DocumentType } from '@zetik/shared-entities';
import { IsEnum } from 'class-validator';

export class DocumentUploadDto {
  @ApiProperty({
    description: 'Type of document being uploaded',
    enum: DocumentType,
    example: DocumentType.GOVERNMENT_ID,
  })
  @IsEnum(DocumentType)
  documentType!: DocumentType;
}

export class DocumentUploadResponseDto {
  @ApiProperty({
    description: 'Document ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id!: string;

  @ApiProperty({
    description: 'Document type',
    enum: DocumentType,
    example: DocumentType.GOVERNMENT_ID,
  })
  documentType!: DocumentType;

  @ApiProperty({
    description: 'Original file name',
    example: 'my-id.jpg',
  })
  originalFileName!: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 1048576,
  })
  fileSize!: number;

  @ApiProperty({
    description: 'Upload timestamp',
  })
  uploadedAt!: Date;

  @ApiProperty({
    description: 'Document verification status',
    enum: ['pending', 'approved', 'rejected'],
    example: 'pending',
  })
  status!: string;
}
