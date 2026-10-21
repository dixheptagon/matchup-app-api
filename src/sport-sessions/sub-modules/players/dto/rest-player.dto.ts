import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class RestPlayerDto {
  /**
   * How long the player rests, in minutes. Falls back to the session's
   * minimumRestTime when omitted; matching defaults to 5 minutes.
   */
  @IsOptional()
  @IsInt({ message: 'durationMinutes must be an integer' })
  @Min(1, { message: 'durationMinutes must be at least 1' })
  @Max(120, { message: 'durationMinutes must not exceed 120' })
  durationMinutes?: number;
}
