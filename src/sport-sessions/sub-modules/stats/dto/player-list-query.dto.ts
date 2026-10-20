import { IsIn, IsOptional } from 'class-validator';

/** Columns the session roster may be sorted by. */
export const PLAYER_SORT_FIELDS = [
  'status',
  'playCount',
  'restUntil',
  'checkedInAt',
  'lastMatchFinishedAt',
  'displayName',
  'skillLevel',
] as const;

export type PlayerSortField = (typeof PLAYER_SORT_FIELDS)[number];

export type SortOrder = 'asc' | 'desc';

export class PlayerListQueryDto {
  /** Defaults to `status`, which puts live players at the top. */
  @IsOptional()
  @IsIn(PLAYER_SORT_FIELDS, {
    message: `sortBy must be one of: ${PLAYER_SORT_FIELDS.join(', ')}`,
  })
  sortBy: PlayerSortField = 'status';

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: 'order must be asc or desc' })
  order: SortOrder = 'asc';
}
