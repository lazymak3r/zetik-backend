import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { StartBlackjackGameDto } from './start-blackjack-game.dto';

export class StartBlackjackGameTestDto extends StartBlackjackGameDto {
  @ApiProperty({
    description: 'Override server seed for testing specific scenarios',
    example: 'test-server-seed-123',
    required: false,
  })
  @IsOptional()
  @IsString()
  testServerSeed?: string;

  @ApiProperty({
    description: 'Override client seed for testing specific scenarios',
    example: 'test-client-seed-456',
    required: false,
  })
  @IsOptional()
  @IsString()
  testClientSeed?: string;

  @ApiProperty({
    description: 'Override nonce for testing specific scenarios',
    example: 12345,
    minimum: 0,
    maximum: 999999,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999999)
  testNonce?: number;

  @ApiProperty({
    description: 'Override card cursor for testing specific scenarios',
    example: 0,
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  testCardCursor?: number;
}
