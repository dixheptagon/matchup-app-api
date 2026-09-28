import type { Prisma } from '../../prisma/generated/prisma/client.js';

// TODO : Refactor include while developing FE
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
