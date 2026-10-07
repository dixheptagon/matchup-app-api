// TODO : Refactor include while developing FE

import { Prisma } from '../../../../prisma/generated/prisma/client.js';
import { PriorityLevel } from '../../../../prisma/generated/prisma/enums.js';

// Return only the fields that are needed for FE
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
