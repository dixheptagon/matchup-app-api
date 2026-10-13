import { IsEnum, IsOptional } from 'class-validator';
import { MatchStatus } from '../../../../../prisma/generated/prisma/enums.js';

export class MatchQueueQueryDto {
  /** Narrows the queue to a single status. Defaults to all not-yet-playing matches. */
  @IsOptional()
  @IsEnum(MatchStatus, { message: 'status must be a valid MatchStatus' })
  status?: MatchStatus;
}