import { St8ResponseStatusEnum } from '../enums/st8.enum';

export interface ISt8BaseResponse {
  status: St8ResponseStatusEnum;
}

export interface ISt8SuccessBalanceResponse extends ISt8BaseResponse {
  status: St8ResponseStatusEnum.OK;
  balance: string;
  currency: string;
}

export interface ISt8ErrorResponse extends ISt8BaseResponse {
  status: Exclude<St8ResponseStatusEnum, St8ResponseStatusEnum.OK>;
}

export interface ISt8PlayerProfileResponse extends ISt8BaseResponse {
  status: St8ResponseStatusEnum.OK;
  id: string;
  jurisdiction: string;
  default_currency: string;
  reg_country: string;
  affiliate: null;
  bet_limits: string;
  birth_date: string;
  reg_date: string;
  attributes: {
    labels: string[];
  } | null;
}
