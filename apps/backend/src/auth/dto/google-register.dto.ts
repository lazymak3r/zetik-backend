import { IsNotEmpty, IsString, Matches } from 'class-validator';

export interface IGoogleRegisterInput {
  idToken: string;
  usernamePlatform: string;
}

export class GoogleRegisterDto implements IGoogleRegisterInput {
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9_]{3,32}$/, {
    message: 'Username must be 3-32 characters and contain only letters, numbers, and underscores',
  })
  usernamePlatform!: string;
}
