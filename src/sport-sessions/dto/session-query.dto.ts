import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  SessionStatus,
  SessionsType,
} from '../../../prisma/generated/prisma/enums.js';

export class SessionQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit must not exceed 100' })
  limit?: number;

  @IsOptional()
  @IsEnum(SessionStatus, {
    message: 'Status must be DRAFT, ACTIVE, FINISHED or ARCHIVED',
  })
  status?: SessionStatus;

  @IsOptional()
  @IsEnum(SessionsType, { message: 'Type must be OPEN_PLAY or TOURNAMENT' })
  type?: SessionsType;

  @IsOptional()
  @IsString({ message: 'Search must be a string' })
  search?: string;
}
