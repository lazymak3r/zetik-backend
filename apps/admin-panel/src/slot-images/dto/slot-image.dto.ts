import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SlotImageResponseDto {
  @ApiProperty({ description: 'Unique identifier of the slot image record' })
  id!: string;

  @ApiProperty({ description: 'Directory/folder the image belongs to' })
  directory!: string;

  @ApiProperty({ description: 'Original uploaded filename' })
  fileName!: string;

  @ApiProperty({ description: 'Unique storage key within the bucket' })
  key!: string;

  @ApiProperty({ description: 'Publicly accessible URL for the image' })
  url!: string;

  @ApiProperty({ description: 'File size in bytes' })
  sizeBytes!: number;

  @ApiProperty({ description: 'MIME type of the image' })
  mimeType!: string;

  @ApiProperty({ description: 'Admin identifier who uploaded the file' })
  uploadedBy!: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: string;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: string;
}

export class SlotImageBatchResultDto {
  @ApiProperty({ description: 'Original uploaded filename' })
  fileName!: string;

  @ApiProperty({ description: 'Storage key for the uploaded file' })
  key!: string;

  @ApiPropertyOptional({ description: 'Public URL for the uploaded file' })
  url?: string;

  @ApiProperty({ description: 'File size in bytes' })
  size!: number;

  @ApiProperty({ description: 'MIME type of the file' })
  mimeType!: string;

  @ApiProperty({ enum: ['success', 'failed'] })
  status!: 'success' | 'failed';

  @ApiPropertyOptional({ description: 'Error message when the upload failed' })
  error?: string;

  @ApiProperty({ description: 'Identifier of the admin who uploaded the file' })
  uploadedBy!: string;

  @ApiPropertyOptional({
    type: SlotImageResponseDto,
    description: 'Persisted metadata when available',
  })
  metadata?: SlotImageResponseDto;
}

export class SlotImageBatchUploadResponseDto {
  @ApiProperty({ description: 'Target directory for the upload batch' })
  directory!: string;

  @ApiProperty({ type: [SlotImageBatchResultDto] })
  results!: SlotImageBatchResultDto[];

  @ApiProperty({ description: 'Number of successfully uploaded files' })
  succeeded!: number;

  @ApiProperty({ description: 'Number of failed uploads' })
  failed!: number;
}
