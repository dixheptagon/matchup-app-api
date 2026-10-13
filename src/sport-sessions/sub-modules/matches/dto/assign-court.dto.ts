import { IsInt, Min } from 'class-validator';

export class AssignCourtDto {
  /** The SessionCourt id (from GET :sessionId/courts), not the master Court id. */
  @IsInt({ message: 'sessionCourtId must be an integer' })
  @Min(1, { message: 'sessionCourtId must be a positive integer' })
  sessionCourtId: number;
}