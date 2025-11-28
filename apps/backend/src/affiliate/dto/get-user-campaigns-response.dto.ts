import { ApiProperty } from '@nestjs/swagger';
import { CampaignResponseDto } from './campaign-response.dto';

export class GetUserCampaignsResponseDto {
  @ApiProperty({ type: [CampaignResponseDto], description: 'List of campaigns' })
  campaigns!: CampaignResponseDto[];

  @ApiProperty({ description: 'Total number of campaigns', example: 3 })
  total!: number;
}
