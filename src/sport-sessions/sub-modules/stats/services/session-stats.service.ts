import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import {
  GenderType,
  PlayerStatus,
  ScoringType,
  SkillLevel,
} from '../../../../../prisma/generated/prisma/enums.js';
import {
  PLAYER_STATUS_ORDER,
  SKILL_ORDER,
} from '../../../shared/constants/sport-sessions.constant.js';
import type { SessionContext } from '../../../shared/types/sport-sessions.types.js';
import type { PlayerSortField, SortOrder } from '../dto/player-list-query.dto.js';
import type { PlayerListQueryDto } from '../dto/player-list-query.dto.js';

interface LeaderboardRow {
  sessionPlayerId: number;
  status: PlayerStatus;
  displayName: string | null;
  skillLevel: SkillLevel;
  gender: GenderType | null;
  isGuest: boolean;
  matchesPlayed: number;
  matchesWon: number;
  matchesLoss: number;
  matchesDrawn: number;
  pointsScored: number;
  pointsConceded: number;
  totalPoints: number;
}

@Injectable()
export class SessionStatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Roster view: every player in the session with their status, games played,
   * and rest cooldown. Sorted by `sortBy`/`order`, defaulting to live players
   * first.
   */
  async getRoster(session: SessionContext, query: PlayerListQueryDto) {
    const players = await this.prisma.sessionPlayer.findMany({
      where: { sessionId: session.id },
      include: { clubMember: true },
    });

    return {
      data: this.sortRoster(players, query.sortBy, query.order),
      meta: { total: players.length, sessionId: session.id },
    };
  }

  /**
   * Ranked leaderboard. The ranking metric comes from the session's
   * leaderBoardMode; when it is OFF there are no stat rows to rank, so the
   * endpoint returns an empty list with the mode echoed back.
   */
  async getLeaderboard(session: SessionContext) {
    const settings = await this.prisma.sessionSettings.findUnique({
      where: { sessionId: session.id },
      select: { leaderBoardMode: true },
    });
    const mode = settings?.leaderBoardMode ?? ScoringType.OFF;

    if (mode === ScoringType.OFF) {
      return {
        data: [],
        meta: { mode, total: 0, sessionId: session.id },
      };
    }

    const players = await this.prisma.sessionPlayer.findMany({
      where: { sessionId: session.id },
      include: { clubMember: true, stats: true },
    });

    const rows = players
      .map((player) => this.toLeaderboardRow(player))
      .sort((a, b) => this.compareLeaderboard(a, b, mode))
      .map((row, index) => ({ rank: index + 1, ...row }));

    return {
      data: rows,
      meta: { mode, total: rows.length, sessionId: session.id },
    };
  }

  // ── Roster sorting ────────────────────────────────────

  private sortRoster<T extends RosterPlayer>(
    players: T[],
    sortBy: PlayerSortField,
    order: SortOrder,
  ): T[] {
    const dir = order === 'desc' ? -1 : 1;

    return [...players].sort((a, b) => {
      const primary = this.compareRoster(a, b, sortBy);
      if (primary !== 0) return primary * dir;
      return this.rosterTieBreak(a, b);
    });
  }

  private compareRoster(a: RosterPlayer, b: RosterPlayer, field: PlayerSortField): number {
    switch (field) {
      case 'status':
        return PLAYER_STATUS_ORDER[a.status] - PLAYER_STATUS_ORDER[b.status];
      case 'playCount':
        return (a.playCount ?? 0) - (b.playCount ?? 0);
      case 'restUntil':
        return this.compareNullableDate(a.restUntil, b.restUntil);
      case 'checkedInAt':
        return this.compareNullableDate(a.checkedInAt, b.checkedInAt);
      case 'lastMatchFinishedAt':
        return this.compareNullableDate(
          a.lastMatchFinishedAt,
          b.lastMatchFinishedAt,
        );
      case 'displayName':
        return (a.clubMember?.displayName ?? '').localeCompare(
          b.clubMember?.displayName ?? '',
        );
      case 'skillLevel':
        return (
          SKILL_ORDER[a.clubMember?.skillLevel ?? SkillLevel.BEGINNER] -
          SKILL_ORDER[b.clubMember?.skillLevel ?? SkillLevel.BEGINNER]
        );
    }
  }

  /**
   * Null dates compare as +Infinity so that ascending order puts them last and
   * descending order puts them first, matching the direction instead of pinning
   * them in place.
   */
  private compareNullableDate(a: Date | null, b: Date | null): number {
    if (a === null && b === null) return 0;
    const av = a === null ? Number.POSITIVE_INFINITY : a.getTime();
    const bv = b === null ? Number.POSITIVE_INFINITY : b.getTime();
    return av - bv;
  }

  /** Stable fallback when the primary key does not separate two rows. */
  private rosterTieBreak(a: RosterPlayer, b: RosterPlayer): number {
    const nameA = a.clubMember?.displayName ?? '';
    const nameB = b.clubMember?.displayName ?? '';
    if (nameA !== nameB) return nameA.localeCompare(nameB);
    return a.id - b.id;
  }

  // ── Leaderboard ───────────────────────────────────────

  private toLeaderboardRow(player: LeaderboardPlayer): LeaderboardRow {
    const s = player.stats;

    return {
      sessionPlayerId: player.id,
      status: player.status,
      displayName: player.clubMember?.displayName ?? null,
      skillLevel: player.clubMember?.skillLevel ?? SkillLevel.BEGINNER,
      gender: player.clubMember?.gender ?? null,
      isGuest: player.clubMember?.isGuest ?? false,
      matchesPlayed: s?.matchesPlayed ?? 0,
      matchesWon: s?.matchesWon ?? 0,
      matchesLoss: s?.matchesLoss ?? 0,
      matchesDrawn: s?.matchesDrawn ?? 0,
      pointsScored: s?.pointsScored ?? 0,
      pointsConceded: s?.pointsConceded ?? 0,
      totalPoints: s?.totalPoints ?? 0,
    };
  }

  private compareLeaderboard(
    a: LeaderboardRow,
    b: LeaderboardRow,
    mode: ScoringType,
  ): number {
    const primary =
      mode === ScoringType.WINS
        ? b.matchesWon - a.matchesWon
        : b.totalPoints - a.totalPoints;
    if (primary !== 0) return primary;

    const secondary =
      mode === ScoringType.WINS
        ? b.totalPoints - a.totalPoints
        : b.matchesWon - a.matchesWon;
    if (secondary !== 0) return secondary;

    return this.rowTieBreak(a, b);
  }

  private rowTieBreak(a: LeaderboardRow, b: LeaderboardRow): number {
    const nameA = a.displayName ?? '';
    const nameB = b.displayName ?? '';
    if (nameA !== nameB) return nameA.localeCompare(nameB);
    return a.sessionPlayerId - b.sessionPlayerId;
  }
}

type RosterPlayer = {
  id: number;
  status: PlayerStatus;
  playCount: number | null;
  checkedInAt: Date | null;
  lastMatchFinishedAt: Date | null;
  restUntil: Date | null;
  clubMember: {
    displayName: string | null;
    skillLevel: SkillLevel;
  } | null;
};

type LeaderboardPlayer = {
  id: number;
  status: PlayerStatus;
  clubMember: {
    displayName: string | null;
    skillLevel: SkillLevel;
    gender: GenderType | null;
    isGuest: boolean;
  } | null;
  stats: {
    matchesPlayed: number;
    matchesWon: number;
    matchesLoss: number;
    matchesDrawn: number;
    pointsScored: number;
    pointsConceded: number;
    totalPoints: number;
  } | null;
};
