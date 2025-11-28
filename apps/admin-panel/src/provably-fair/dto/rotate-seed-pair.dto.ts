import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RotateSeedPairDto {
  @ApiProperty({
    description: 'Client seed for the new seed pair',
    example: 'my-new-client-seed',
  })
  @IsString()
  @IsNotEmpty({ message: 'Client seed is required' })
  clientSeed!: string;
}
