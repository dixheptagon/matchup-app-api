import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  GenderType,
  RoleType,
  SkillLevel,
} from '../../../prisma/generated/prisma/enums.js';
import { ContainsLetter } from '../../common/validators/contains-letter.validator.js';

export class UpdateSportMemberDto {
  @IsOptional()
  @IsEnum(RoleType, { message: 'Role must be OWNER, ADMIN or MEMBER' })
  role?: RoleType;

  @Transform(({ value }) => value?.trim())
  @IsOptional()
  @IsString({ message: 'Display name must be a string' })
  @MaxLength(100, { message: 'Display name must not exceed 100 characters' })
  @ContainsLetter()
  displayName?: string;

  @IsOptional()
  @IsEnum(GenderType, { message: 'Gender must be MALE or FEMALE' })
  gender?: GenderType;

  @IsOptional()
  @IsEnum(SkillLevel, {
    message: 'Skill level must be NEWBIE, BEGINNER, INTERMEDIATE or ADVANCE',
  })
  skillLevel?: SkillLevel;
}
