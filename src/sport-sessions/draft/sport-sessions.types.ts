import type { SessionStatus } from '../../../prisma/generated/prisma/enums.js';

export interface SessionContext {
  id: string;
  clubId: string;
  status: SessionStatus;
  title: string | null;
  _count: { sessionCourts: number; players: number };
}
