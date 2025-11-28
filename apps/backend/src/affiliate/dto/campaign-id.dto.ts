import { IsUUID } from 'class-validator';

export class CampaignIdDto {
  @IsUUID('4')
  id!: string;
}
