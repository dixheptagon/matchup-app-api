import { SessionStatus } from '../../../../prisma/generated/prisma/enums.js';

export interface SessionContext {
  id: string;
  clubId: string;
  status: SessionStatus;
  title: string | null;
  sessionSettings?: { attendanceCheckIn: boolean } | null;
  _count: { sessionCourts: number; players: number };
}
