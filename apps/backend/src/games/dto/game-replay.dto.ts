import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class GetReplayStepsDto {
  @ApiProperty({ description: 'Game session ID' })
  @IsUUID()
  gameSessionId!: string;

  @ApiPropertyOptional({ description: 'Starting step number', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fromStep?: number;

  @ApiPropertyOptional({ description: 'Ending step number' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  toStep?: number;
}

export class BatchReplayDto {
  @ApiProperty({ description: 'Array of game session IDs' })
  @IsArray()
  @IsString({ each: true })
  @IsUUID(4, { each: true })
  gameSessionIds!: string[];
}
