import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  RoleType,
  SkillLevel,
} from '../../../prisma/generated/prisma/enums.js';

export class SportMemberQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit must not exceed 100' })
  limit?: number = 20;

  @IsOptional()
  @IsEnum(RoleType, { message: 'Role must be OWNER, ADMIN or MEMBER' })
  role?: RoleType;

  @IsOptional()
  @IsEnum(SkillLevel, {
    message: 'Skill level must be NEWBIE, BEGINNER, INTERMEDIATE or ADVANCE',
  })
  skillLevel?: SkillLevel;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'isGuest must be a boolean' })
  isGuest?: boolean;

  @IsOptional()
  @IsString({ message: 'Search must be a string' })
  search?: string;
}
