import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CalculateWeeklyReloadDto {
  @ApiProperty({ description: 'User ID to calculate weekly reload for' })
  @IsUUID()
  userId!: string;
}
