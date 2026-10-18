import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TeamGroup } from '../../../../../prisma/generated/prisma/enums.js';

export class FinishMatchDto {
  /**
   * Winner for sessions that do not track a score. Ignored when the session
   * tracks score, because the live score decides the outcome.
   */
  @IsOptional()
  @IsEnum(TeamGroup, { message: 'winningTeam must be TEAM_A or TEAM_B' })
  winningTeam?: TeamGroup;

  @IsOptional()
  @IsString({ message: 'notes must be a string' })
  @MaxLength(500, { message: 'notes must not exceed 500 characters' })
  notes?: string;
}