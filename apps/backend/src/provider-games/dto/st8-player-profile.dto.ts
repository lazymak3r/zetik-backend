import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { ISt8PlayerProfileInput } from '../interfaces/st8-player-profile.interface';

export class St8PlayerProfileDto implements ISt8PlayerProfileInput {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  player!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  site!: string;
}
