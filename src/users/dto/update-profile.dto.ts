import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsEnum,
  MaxLength,
  MinLength,
} from 'class-validator';
import { GenderType } from '../../../prisma/generated/prisma/enums.js';
import { ContainsLetter } from '../../common/validators/contains-letter.validator.js';

export class UpdateProfileDto {
  @Transform(({ value }) => value?.trim())
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(100, { message: 'Username must not exceed 100 characters' })
  @ContainsLetter()
  username?: string;

  @IsOptional()
  @IsEnum(GenderType, { message: 'Gender must be MALE or FEMALE' })
  gender?: GenderType;
}
