import { IsNotEmpty, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class GetMessagesDto {
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  chatId!: string;
}

export class SendMessageDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(1, {
    message: 'Message must be between 1 and 1000 characters long',
  })
  @MaxLength(1000, {
    message: 'Message must be between 1 and 1000 characters long',
  })
  message!: string;

  @IsNotEmpty()
  @IsString()
  @IsUUID()
  chatId!: string;
}

export class DeleteMessageDto {
  @IsNotEmpty()
  @IsString()
  @IsUUID()
  messageId!: string;
}
