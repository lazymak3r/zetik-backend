import { ApiProperty } from '@nestjs/swagger';
import { IBonusNotificationData } from '../services/bonus-notification.service';

export class BonusNotificationDto {
  @ApiProperty({ description: 'Notification ID' })
  id!: string;

  @ApiProperty({ description: 'User ID' })
  userId!: string;

  @ApiProperty({ description: 'Related bonus transaction ID' })
  bonusTransactionId!: string;

  @ApiProperty({ description: 'Notification type' })
  type!: string;

  @ApiProperty({ description: 'Notification title' })
  title!: string;

  @ApiProperty({ description: 'Notification message' })
  message!: string;

  @ApiProperty({ description: 'Additional notification data', required: false })
  data?: IBonusNotificationData;

  @ApiProperty({ description: 'Whether notification has been viewed' })
  isViewed!: boolean;

  @ApiProperty({ description: 'Notification creation date' })
  createdAt!: Date;

  @ApiProperty({ description: 'Notification view date', required: false })
  viewedAt?: Date;
}

export class BonusNotificationCountDto {
  @ApiProperty({ description: 'Number of unviewed notifications' })
  count!: number;
}

export class BonusNotificationsResponseDto {
  @ApiProperty({
    type: [BonusNotificationDto],
    description: 'List of bonus notifications',
  })
  notifications!: BonusNotificationDto[];

  @ApiProperty({ description: 'Number of unviewed notifications' })
  unviewedCount!: number;
}
