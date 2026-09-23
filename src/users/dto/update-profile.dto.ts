import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsEnum,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { GenderType } from '../../../prisma/generated/prisma/enums.js';
import { ContainsLetter } from '../../common/validators/contains-letter.validator.js';

export class UpdateProfileDto {
  @Transform(({ value }) => value?.trim())
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @MinLength(1, { message: 'Name must not be empty' })
  @MaxLength(250, { message: 'Name must not exceed 250 characters' })
  name?: string;

  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(100, { message: 'Username must not exceed 100 characters' })
  @Matches(/^[a-zA-Z0-9_.]+$/, {
    message: 'Username may only contain letters, numbers, underscores and dots',
  })
  @ContainsLetter(3, { label: 'Username' })
  username?: string;

  @IsOptional()
  @IsEnum(GenderType, { message: 'Gender must be MALE or FEMALE' })
  gender?: GenderType;
}
