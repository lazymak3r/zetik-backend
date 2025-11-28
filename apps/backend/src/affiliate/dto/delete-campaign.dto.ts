import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DeleteCampaignDto {
  @ApiProperty({
    description: 'Campaign code to delete',
    example: 'SUMMER2025',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code!: string;
}
