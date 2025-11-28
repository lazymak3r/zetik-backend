import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class ApiKeyDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  key!: string;

  @ApiProperty({ type: [String] })
  permissions!: string[];

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ nullable: true })
  lastUsedAt?: Date;

  @ApiProperty({ nullable: true })
  createdBy?: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class CreateApiKeyDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  permissions!: string[] | string;
}

export class UpdateApiKeyDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[] | string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
