import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelMatchDto {
  /**
   * Only persisted when a live (PLAYING) match is soft-cancelled. Matches that
   * never started are hard deleted, so the reason is discarded.
   */
  @IsOptional()
  @IsString({ message: 'reason must be a string' })
  @MaxLength(500, { message: 'reason must not exceed 500 characters' })
  reason?: string;
}