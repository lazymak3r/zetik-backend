import { ApiProperty } from '@nestjs/swagger';

export class ProviderGameDto {
  @ApiProperty({ description: 'Unique game code' })
  code!: string;

  @ApiProperty({ description: 'Game name' })
  name!: string;

  @ApiProperty({ description: 'Game description', nullable: true, required: false })
  description?: string | null;
}
