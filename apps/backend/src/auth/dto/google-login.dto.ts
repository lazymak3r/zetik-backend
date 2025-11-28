import { IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export interface IGoogleLoginInput {
  idToken?: string;
  code?: string;
}

export class GoogleLoginDto implements IGoogleLoginInput {
  // ID Token (implicit flow)
  @IsOptional()
  @IsString()
  @ValidateIf((o) => !o.code) // Required if code is not provided
  @IsNotEmpty({ message: 'Either idToken or code must be provided' })
  idToken?: string;

  // Authorization Code (authorization code flow)
  @IsOptional()
  @IsString()
  @ValidateIf((o) => !o.idToken) // Required if idToken is not provided
  @IsNotEmpty({ message: 'Either idToken or code must be provided' })
  code?: string;
}
