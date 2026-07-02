import { IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  token!: string;
}

export class RequestPasswordResetDto {
  @IsString()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
