import { ApiProperty } from '@nestjs/swagger';

export class NotificationResponseDto {
  @ApiProperty({
    description: 'Notification ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'User ID who should receive the notification',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  userId!: string;

  @ApiProperty({
    description: 'Type of notification (deposit, withdrawal, etc.)',
    example: 'deposit',
  })
  type!: string;

  @ApiProperty({
    description: 'Notification title',
    example: 'Deposit Successful',
  })
  title!: string;

  @ApiProperty({
    description: 'Notification message',
    example: 'Your deposit of $100 has been processed successfully.',
  })
  message!: string;

  @ApiProperty({
    description: 'Additional notification data',
    example: { amount: 100, currency: 'USD', transactionId: 'tx_123' },
    required: false,
  })
  data?: Record<string, any>;

  @ApiProperty({
    description: 'Whether the notification has been read by the user',
    example: false,
  })
  isRead!: boolean;

  @ApiProperty({
    description: 'Whether the notification has been deleted by the user',
    example: false,
  })
  isDeleted!: boolean;

  @ApiProperty({
    description: 'Notification creation timestamp',
    example: '2023-12-01T10:30:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Notification read timestamp',
    example: '2023-12-01T11:30:00.000Z',
    required: false,
  })
  readAt?: Date;

  @ApiProperty({
    description: 'Notification deleted timestamp',
    example: '2023-12-01T12:30:00.000Z',
    required: false,
  })
  deletedAt?: Date;
}
