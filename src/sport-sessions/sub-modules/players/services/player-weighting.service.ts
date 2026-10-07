import { Injectable } from '@nestjs/common';
import type { SessionPlayer } from '../../../../../prisma/generated/prisma/client.js';
import { LateJoinerPolicy } from '../../../../../prisma/generated/prisma/enums.js';
import { DEFAULT_CLUB_SETTINGS } from '../../../../club-settings/club-settings.constant.js';
import {
  LATE_JOINER_CATCHUP_BONUS,
  PRIORITY_WEIGHTS,
} from '../../../shared/constants/sport-sessions.constant.js';
import type {
  SessionContext,
  SessionContextSettings,
} from '../../../shared/types/sport-sessions.types.js';

export type WeightablePlayer = Pick<
  SessionPlayer,
  'id' | 'playCount' | 'checkedInAt' | 'lastMatchFinishedAt'
>;

export interface FairnessBreakdown {
  total: number;
  playCountScore: number;
  waitingScore: number;
  arrivalRatio: number;
  bucket: number;
  weights: { equalPlay: number; waitingTime: number };
}

export type WeightedPlayer<T extends WeightablePlayer> = T & {
  fairness: FairnessBreakdown;
};

@Injectable()
export class PlayerWeightingService {
  weight<T extends WeightablePlayer>(
    players: T[],
    session: SessionContext,
    now: Date = new Date(),
  ): WeightedPlayer<T>[] {
    if (players.length === 0) return [];

    const settings = this.resolveSettings(session);
    const weights = {
      equalPlay: PRIORITY_WEIGHTS[settings.equalPlayPriority],
      waitingTime: PRIORITY_WEIGHTS[settings.prioritizeWaitingPlayers],
    };

    const playScores = this.normalize(
      players.map((player) => player.playCount ?? 0),
      true,
    );

    const waitScores = this.normalize(
      players.map((player) => this.idleMs(player, session, now)),
      false,
    );

    const arrivals = players.map((player) =>
      this.arrivalRatio(player, session, now),
    );

    const applyCatchup =
      settings.lateJoinerPolicy === LateJoinerPolicy.EQUAL_PLAY_CATCHUP;

    const totals = players.map((player, index) => {
      const catchup =
        applyCatchup && arrivals[index] > 0
          ? LATE_JOINER_CATCHUP_BONUS * arrivals[index] * weights.equalPlay
          : 0;

      return (
        playScores[index] * weights.equalPlay +
        waitScores[index] * weights.waitingTime +
        catchup
      );
    });

    const minTotal = Math.min(...totals);
    const maxTotal = Math.max(...totals);
    const range = maxTotal - minTotal;
    const deadband = range > 0 ? (settings.fairnessThreshold / 100) * range : 0;

    const rows: WeightedPlayer<T>[] = players.map((player, index) => ({
      ...player,
      fairness: {
        total: totals[index],
        playCountScore: playScores[index],
        waitingScore: waitScores[index],
        arrivalRatio: arrivals[index],
        bucket:
          deadband > 0 ? Math.floor((totals[index] - minTotal) / deadband) : 0,
        weights,
      },
    }));

    return rows.sort((a, b) => {
      if (deadband > 0) {
        const bucketA = Math.floor((a.fairness.total - minTotal) / deadband);
        const bucketB = Math.floor((b.fairness.total - minTotal) / deadband);
        if (bucketA !== bucketB) return bucketB - bucketA;
        return this.byCheckedInThenId(a, b);
      }

      if (a.fairness.total !== b.fairness.total) {
        return b.fairness.total - a.fairness.total;
      }
      return this.byCheckedInThenId(a, b);
    });
  }

  private resolveSettings(session: SessionContext) {
    const settings: Partial<SessionContextSettings> =
      session.sessionSettings ?? {};

    return {
      equalPlayPriority:
        settings.equalPlayPriority ?? DEFAULT_CLUB_SETTINGS.equalPlayPriority,
      prioritizeWaitingPlayers:
        settings.prioritizeWaitingPlayers ??
        DEFAULT_CLUB_SETTINGS.prioritizeWaitingPlayers,
      lateJoinerPolicy:
        settings.lateJoinerPolicy ?? DEFAULT_CLUB_SETTINGS.lateJoinerPolicy,
      fairnessThreshold:
        settings.fairnessThreshold ?? DEFAULT_CLUB_SETTINGS.fairnessThreshold,
    };
  }

  private normalize(values: number[], lowerIsBetter: boolean): number[] {
    const min = Math.min(...values);
    const max = Math.max(...values);

    if (max === min) return values.map(() => 0.5);

    return values.map((value) =>
      lowerIsBetter ? (max - value) / (max - min) : (value - min) / (max - min),
    );
  }

  private idleMs(
    player: WeightablePlayer,
    session: SessionContext,
    now: Date,
  ): number {
    const checkedIn = player.checkedInAt ?? session.startedAt ?? null;
    const finished = player.lastMatchFinishedAt ?? null;

    let reference: Date | null;
    if (checkedIn && finished) {
      reference =
        checkedIn.getTime() > finished.getTime() ? checkedIn : finished;
    } else {
      reference = checkedIn ?? finished;
    }

    if (!reference) return 0;

    return Math.max(0, now.getTime() - reference.getTime());
  }

  private arrivalRatio(
    player: WeightablePlayer,
    session: SessionContext,
    now: Date,
  ): number {
    if (!session.startedAt || !player.checkedInAt) return 0;

    const elapsed = now.getTime() - session.startedAt.getTime();
    if (elapsed <= 0) return 0;

    const lag = player.checkedInAt.getTime() - session.startedAt.getTime();

    return Math.min(1, Math.max(0, lag / elapsed));
  }

  private byCheckedInThenId<T extends WeightablePlayer>(a: T, b: T): number {
    const aTime = a.checkedInAt ? a.checkedInAt.getTime() : 0;
    const bTime = b.checkedInAt ? b.checkedInAt.getTime() : 0;

    if (aTime !== bTime) return aTime - bTime;

    return a.id - b.id;
  }
}
