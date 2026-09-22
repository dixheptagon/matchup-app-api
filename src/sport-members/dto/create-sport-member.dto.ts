import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  GenderType,
  SkillLevel,
} from '../../../prisma/generated/prisma/enums.js';
import { ContainsLetter } from '../../common/validators/contains-letter.validator.js';

export class CreateSportMemberDto {
  @Transform(({ value }) => value?.trim())
  @IsString({ message: 'Display name must be a string' })
  @IsNotEmpty({ message: 'Display name is required' })
  @MaxLength(100, { message: 'Display name must not exceed 100 characters' })
  @ContainsLetter()
  displayName: string;

  @IsOptional()
  @IsBoolean({ message: 'isGuest must be a boolean' })
  isGuest?: boolean;

  @IsOptional()
  @IsEnum(GenderType, { message: 'Gender must be MALE or FEMALE' })
  gender?: GenderType;

  @IsOptional()
  @IsEnum(SkillLevel, {
    message: 'Skill level must be NEWBIE, BEGINNER, INTERMEDIATE or ADVANCE',
  })
  skillLevel?: SkillLevel;
}
