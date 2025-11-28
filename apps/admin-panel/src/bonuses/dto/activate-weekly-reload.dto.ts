import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ActivateWeeklyReloadDto {
  @ApiProperty({ description: 'User ID to activate weekly reload for' })
  @IsUUID()
  userId!: string;
}
