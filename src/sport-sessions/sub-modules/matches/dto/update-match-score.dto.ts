import { IsEnum, IsInt, Max, Min } from 'class-validator';
import { TeamGroup } from '../../../../../prisma/generated/prisma/enums.js';

export class UpdateMatchScoreDto {
  @IsEnum(TeamGroup, { message: 'team must be TEAM_A or TEAM_B' })
  team: TeamGroup;

  /**
   * Score change to apply to that team. Bounded to a single point per request
   * because live scoring is a tap-per-point interaction; send several requests
   * for larger changes.
   */
  @IsInt({ message: 'delta must be an integer' })
  @Min(-100, { message: 'delta must be between -100 and 100' })
  @Max(100, { message: 'delta must be between -100 and 100' })
  delta: number;
}
