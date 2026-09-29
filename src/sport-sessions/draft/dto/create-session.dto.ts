import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SessionsType } from '../../../../prisma/generated/prisma/enums.js';

export class CreateSessionDto {
  @Transform(({ value }) => value?.trim())
  @IsOptional()
  @IsString({ message: 'Title must be a string' })
  @MaxLength(250, { message: 'Title must not exceed 250 characters' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @MaxLength(5000, { message: 'Description must not exceed 5000 characters' })
  description?: string;

  @IsOptional()
  @IsEnum(SessionsType, { message: 'Type must be OPEN_PLAY or TOURNAMENT' })
  type?: SessionsType;

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'scheduledAt must be a valid date' })
  scheduledAt?: Date;
}
