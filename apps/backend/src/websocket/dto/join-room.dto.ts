import { GameTypeEnum } from '@zetik/shared-entities';
import { IsEnum } from 'class-validator';
import { ERROR_MESSAGES } from '../../common/constants/error-messages';

export class JoinRoomDto {
  @IsEnum(GameTypeEnum, {
    message: ERROR_MESSAGES.VALIDATION.INVALID_ASSET, // Reuse existing validation message
  })
  gameType!: GameTypeEnum;
}
