import type { SessionSettings } from '../../../../prisma/generated/prisma/client.js';
import { SessionStatus } from '../../../../prisma/generated/prisma/enums.js';

export type SessionContextSettings = Pick<
  SessionSettings,
  'attendanceCheckIn'
> &
  Partial<
    Pick<
      SessionSettings,
      | 'equalPlayPriority'
      | 'prioritizeWaitingPlayers'
      | 'lateJoinerPolicy'
      | 'fairnessThreshold'
    >
  >;

export interface SessionContext {
  id: string;
  clubId: string;
  status: SessionStatus;
  title: string | null;
  startedAt?: Date | null;
  sessionSettings?: SessionContextSettings | null;
  _count: { sessionCourts: number; players: number };
}