import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { ERROR_MESSAGES } from '../../common/constants/error-messages';

export class UpdateClientSeedDto {
  @ApiProperty({
    description: 'New client seed for provably fair generation',
    example: 'my_custom_client_seed_123',
    minLength: 1,
    maxLength: 64,
  })
  @IsString()
  @IsNotEmpty({ message: ERROR_MESSAGES.VALIDATION.REQUIRED_FIELD })
  @Length(1, 64, { message: 'Client seed must be between 1 and 64 characters' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Client seed can only contain letters, numbers, underscores, and hyphens',
  })
  @Transform(({ value }: { value: unknown }): string =>
    typeof value === 'string' ? value.trim() : (value as string),
  )
  clientSeed!: string;
}
