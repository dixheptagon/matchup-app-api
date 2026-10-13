import type { ClubSettings, Prisma } from '../../../../prisma/generated/prisma/client.js';
import {
  MatchStatus,
  PlayerStatus,
  SessionsType,
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
 */
export function buildEligiblePlayersWhere(sessionId: string) {
  return {
    sessionId,
    status: PlayerStatus.WAITING,
    matchPlayers: {
      none: { match: { status: { in: ACTIVE_MATCH_STATUSES } } },
    },
  };
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
