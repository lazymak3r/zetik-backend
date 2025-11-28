import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '@zetik/shared-entities';

export class AdminResponseDto {
  @ApiProperty({
    description: 'Admin ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Admin email',
    example: 'admin@example.com',
  })
  email!: string;

  @ApiProperty({
    description: 'Admin name',
    example: 'John Doe',
  })
  name!: string;

  @ApiProperty({
    description: 'Admin role',
    enum: AdminRole,
    example: AdminRole.ADMIN,
  })
  role!: AdminRole;
}
