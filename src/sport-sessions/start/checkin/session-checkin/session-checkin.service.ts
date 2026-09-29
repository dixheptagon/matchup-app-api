import { Injectable } from '@nestjs/common';
import { SessionContext } from '../../../draft/sport-sessions.types.js';
import { PlayerStatus } from '../../../../../prisma/generated/prisma/enums.js';

@Injectable()
export class SessionCheckinService {
  async getCheckInStatus(session: SessionContext) {
    // Return all sessionPlayers with clubMember info + computed fields
    // Include: playCount, restCount, status, checkedInAt
  }

  async checkInPlayers(session: SessionContext, playerIds: number[]) {
    // 1. Verify session is ACTIVE
    // 2. Verify attendanceCheckIn enabled in SessionSettings
    // 3. For each player:
    //    - Must be NOT_ARRIVED
    //    - Update: status=WAITING, checkedInAt=now(), playCount=0, restCount=0
    // 4. Return updated players
  }

  async updatePlayerStatus(
    session: SessionContext,
    playerId: number,
    status: PlayerStatus,
  ) {
    // Validate transition: NOT_ARRIVED → WAITING/RESERVED, WAITING → PLAYING/RESTING/LEFT, etc.
    // Update status + relevant timestamps
  }

  async checkOutPlayer(session: SessionContext, playerId: number) {
    // Set status=LEFT, lastMatchFinishedAt=now()
  }
}
