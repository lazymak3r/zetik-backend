import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export interface ISteamRegisterInput {
  openidAssocHandle: string;
  openidSigned: string;
  openidSig: string;
  openidNs: string;
  openidMode: string;
  openidOpEndpoint: string;
  openidClaimedId: string;
  openidIdentity: string;
  openidReturnTo: string;
  openidResponseNonce: string;
}

export class SteamRegisterDto implements ISteamRegisterInput {
  @IsString()
  @IsNotEmpty()
  openidAssocHandle!: string;

  @IsString()
  @IsNotEmpty()
  openidSigned!: string;

  @IsString()
  @IsNotEmpty()
  openidSig!: string;

  @IsString()
  @IsNotEmpty()
  openidNs!: string;

  @IsString()
  @IsNotEmpty()
  openidMode!: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  openidOpEndpoint!: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  openidClaimedId!: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  openidIdentity!: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  openidReturnTo!: string;

  @IsString()
  @IsNotEmpty()
  openidResponseNonce!: string;
}
