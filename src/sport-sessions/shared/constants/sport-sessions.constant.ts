// TODO : Refactor include while developing FE

import { Prisma } from '../../../../prisma/generated/prisma/client.js';
import {
  MatchStatus,
  PriorityLevel,
} from '../../../../prisma/generated/prisma/enums.js';

// Return only the fields that are needed for FE
export const MATCH_DETAIL_INCLUDE = {
  court: { include: { court: true } },
  players: {
    include: { sessionPlayer: { include: { clubMember: true } } },
    orderBy: [{ team: 'asc' }, { position: 'asc' }],
  },
} satisfies Prisma.SessionMatchInclude;

/** Matches that are committed but not yet playing — i.e. the match queue. */
export const QUEUE_MATCH_STATUSES: MatchStatus[] = [
  MatchStatus.QUEUED,
  MatchStatus.READY,
];

export const SESSION_DETAIL_INCLUDE = {
  sessionSettings: true,
  sessionCourts: { include: { court: true } },
  players: { include: { clubMember: true } },
} satisfies Prisma.SportSessionInclude;

export const SESSION_GUARD_INCLUDE = {
  sessionSettings: true,
  sessionCourts: { include: { court: true } },
  players: { include: { clubMember: true } },
  _count: { select: { sessionCourts: true, players: true } },
} satisfies Prisma.SportSessionInclude;

export const PUBLIC_SESSION_SELECT = {
  title: true,
  slug: true,
  description: true,
  type: true,
  status: true,
  scheduledAt: true,
  startedAt: true,
  endedAt: true,
  club: { select: { name: true, slug: true } },
  sessionCourts: {
    select: { status: true, court: { select: { name: true } } },
  },
  players: {
    select: { status: true, clubMember: { select: { displayName: true } } },
  },
} satisfies Prisma.SportSessionSelect;

export const ACTIVE_EDITABLE_SETTINGS: readonly string[] = [
  'leaderBoardMode',
  'fairnessThreshold',
  'minimumRestTime',
  'pointsToWin',
];

export const MIN_COURTS_TO_START = 1;
export const MIN_PLAYERS_TO_START = 4;

// ─── Fairness weighting ──────────────────────────────────

export const PRIORITY_WEIGHTS: Record<PriorityLevel, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  MAX: 4,
};

export const LATE_JOINER_CATCHUP_BONUS = 1.5;

// Games a player must complete before their play count is considered
// meaningful under LateJoinerPolicy.MIN_SESSION_PLAY.
export const MIN_SESSION_PLAY_COUNT = 2;

// ─── Match composition ───────────────────────────────────

export const PLAYERS_PER_MATCH = 4;
export const TEAM_SIZE = 2;

/** Top-N fairness-ranked players that auto matchmaking may draw from. */
export const SELECTION_WINDOW = 12;

/**
 * Gender is a soft preference: each team satisfying the configured preference
 * adds this to the candidate score. Sized to be comparable to the skill penalty
 * (0..-6) so it can flip close selections but never dominates.
 */
export const GENDER_MATCH_BONUS = 1;
