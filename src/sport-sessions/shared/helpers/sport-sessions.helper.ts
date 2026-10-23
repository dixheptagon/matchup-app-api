import { BadRequestException } from '@nestjs/common';
import type { ClubSettings, Prisma } from '../../../../prisma/generated/prisma/client.js';
import {
  MatchStatus,
  PlayerStatus,
  SessionsType,
  TeamGroup,
} from '../../../../prisma/generated/prisma/enums.js';
import { ACTIVE_EDITABLE_SETTINGS } from '../constants/sport-sessions.constant.js';

export type SessionSettingsFields = Omit<
  ClubSettings,
  'id' | 'clubId' | 'createdAt' | 'updatedAt'
>;

export function buildSessionSettings(
  source: ClubSettings | SessionSettingsFields,
): SessionSettingsFields {
  const {
    id: _id,
    clubId: _clubId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...settings
  } = source as ClubSettings;

  return settings;
}

export function buildFallbackTitle(type?: SessionsType): string {
  const label = type === SessionsType.TOURNAMENT ? 'Tournament' : 'Open Play';

  const dateStr = new Date().toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return `${label} - ${dateStr}`;
}

export function getLockedActiveSettings(dto: object): string[] {
  return Object.entries(dto)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key)
    .filter((key) => !ACTIVE_EDITABLE_SETTINGS.includes(key));
}

export const ACTIVE_MATCH_STATUSES: MatchStatus[] = [
  MatchStatus.QUEUED,
  MatchStatus.READY,
  MatchStatus.PLAYING,
];

/**
 * Players who may be picked for a new match: checked in, and not already
 * committed to a match that has not finished yet.
 *
 * Without `now` the filter is strictly physical (`WAITING` rows only) and is
 * used by matchmaking, which promotes rested players before reserving. With
 * `now`, an elapsed rest counts as waiting too, so read-only GETs can present
 * the virtual state without writing.
 */
export function buildEligiblePlayersWhere(sessionId: string, now?: Date) {
  const statusFilter = now
    ? {
        OR: [
          { status: PlayerStatus.WAITING },
          {
            status: PlayerStatus.RESTING,
            OR: [{ restUntil: null }, { restUntil: { lte: now } }],
          },
        ],
      }
    : { status: PlayerStatus.WAITING };

  return {
    sessionId,
    ...statusFilter,
    matchPlayers: {
      none: { match: { status: { in: ACTIVE_MATCH_STATUSES } } },
    },
  };
}

/**
 * A rest is over when its timer is gone or has run out. Matches the `lte`
 * comparison promoteRestedPlayers uses, so a read and a later write agree on
 * the boundary instant.
 */
export function isRestElapsed(
  restUntil: Date | null | undefined,
  now: Date,
): boolean {
  return restUntil === null || restUntil === undefined ||
    restUntil.getTime() <= now.getTime();
}

/**
 * Presents a player's virtual status: a resting player whose cooldown has
 * elapsed reads back as WAITING with no rest timer. The database row is left
 * untouched, so this is safe for GET routes; physical promotion happens on the
 * write paths that actually need a WAITING row.
 */
export function applyEffectivePlayerStatus<
  T extends { status: PlayerStatus; restUntil: Date | null },
>(player: T, now: Date): T {
  if (
    player.status === PlayerStatus.RESTING &&
    isRestElapsed(player.restUntil, now)
  ) {
    return { ...player, status: PlayerStatus.WAITING, restUntil: null };
  }

  return player;
}

/**
 * Next play-order number for a session. Matches that have not started yet carry
 * a null sequence, so the `sequence: { not: null }` filter is required —
 * without it the descending sort could pick a null row and reset the counter.
 */
export async function allocateMatchSequence(
  tx: Prisma.TransactionClient,
  sessionId: string,
): Promise<number> {
  const latest = await tx.sessionMatch.findFirst({
    where: { sessionId, sequence: { not: null } },
    orderBy: { sequence: 'desc' },
    select: { sequence: true },
  });

  return (latest?.sequence ?? 0) + 1;
}

/**
 * Players resting after a match become available again once their cooldown has
 * elapsed. There is no scheduler, so physical writes happen lazily in the two
 * matchmaking transactions, where a WAITING row is actually required to
 * reserve. Read-only GETs do not promote; they present elapsed rests as
 * waiting via applyEffectivePlayerStatus instead.
 */
export async function promoteRestedPlayers(
  tx: Prisma.TransactionClient,
  sessionId: string,
  now: Date = new Date(),
): Promise<void> {
  await tx.sessionPlayer.updateMany({
    where: {
      sessionId,
      status: PlayerStatus.RESTING,
      OR: [{ restUntil: null }, { restUntil: { lte: now } }],
    },
    data: { status: PlayerStatus.WAITING, restUntil: null },
  });
}

export interface WinnerResolutionInput {
  scoreTeamA: number;
  scoreTeamB: number;
  /** Whether this session records a score at all. */
  trackMatchScore: boolean;
  pointsToWin: number | null;
  allowEndWithoutScore: boolean;
  /** Winner chosen by the caller, only honoured when scores are not tracked. */
  requestedTeam?: TeamGroup;
}

/**
 * Works out the outcome of a finished match from its live score.
 *
 * A drawn scoreline is rejected unless the session allows ending without a
 * result, and a leader that has not reached pointsToWin is rejected on the same
 * terms. When scores are not tracked the caller must state the winner, unless
 * the session allows ending without one.
 */
export function resolveWinningTeam(
  input: WinnerResolutionInput,
): TeamGroup | null {
  if (!input.trackMatchScore) {
    if (input.requestedTeam) return input.requestedTeam;
    if (input.allowEndWithoutScore) return null;
    throw new BadRequestException(
      'winningTeam is required when this session does not track score',
    );
  }

  if (input.scoreTeamA === input.scoreTeamB) {
    if (input.allowEndWithoutScore) return null;
    throw new BadRequestException(
      'Cannot finish a drawn match: correct the score, or allow ending without a result',
    );
  }

  const leader =
    input.scoreTeamA > input.scoreTeamB ? TeamGroup.TEAM_A : TeamGroup.TEAM_B;
  const leaderScore = Math.max(input.scoreTeamA, input.scoreTeamB);

  if (
    input.pointsToWin !== null &&
    leaderScore < input.pointsToWin &&
    !input.allowEndWithoutScore
  ) {
    throw new BadRequestException(
      `Winning team has not reached pointsToWin (${input.pointsToWin})`,
    );
  }

  return leader;
}
