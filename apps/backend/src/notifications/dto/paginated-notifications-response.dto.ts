import { ApiProperty } from '@nestjs/swagger';
import { NotificationResponseDto } from './notification-response.dto';

export class PaginatedNotificationsResponseDto {
  @ApiProperty({
    description: 'Array of notifications',
    type: [NotificationResponseDto],
  })
  notifications!: NotificationResponseDto[];

  @ApiProperty({
    description: 'Total number of notifications',
    example: 150,
  })
  total!: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 8,
  })
  totalPages!: number;

  @ApiProperty({
    description: 'Number of unread notifications',
    example: 5,
  })
  unreadCount!: number;
}
