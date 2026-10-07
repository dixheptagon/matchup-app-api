import { PlayerWeightingService } from './player-weighting.service.js';
import type { WeightablePlayer } from './player-weighting.service.js';
import {
  LateJoinerPolicy,
  PriorityLevel,
} from '../../../../../prisma/generated/prisma/enums.js';
import type {
  SessionContext,
  SessionContextSettings,
} from '../../../shared/types/sport-sessions.types.js';
import { MIN_SESSION_PLAY_COUNT } from '../../../shared/constants/sport-sessions.constant.js';

const SESSION_START = new Date('2026-09-23T10:00:00.000Z');
const NOW = new Date('2026-09-23T11:00:00.000Z');

function session(overrides: Partial<SessionContext> = {}): SessionContext {
  return {
    id: 'session-1',
    clubId: 'club-1',
    status: 'ACTIVE',
    title: null,
    startedAt: SESSION_START,
    sessionSettings: { attendanceCheckIn: true },
    _count: { sessionCourts: 1, players: 4 },
    ...overrides,
  };
}

function withSettings(
  settings: Partial<SessionContextSettings>,
): Partial<SessionContext> {
  return { sessionSettings: { attendanceCheckIn: true, ...settings } };
}

function player(
  overrides: Partial<WeightablePlayer> & { id: number },
): WeightablePlayer {
  return {
    playCount: 0,
    checkedInAt: SESSION_START,
    lastMatchFinishedAt: null,
    ...overrides,
  };
}

function scoreOf(
  ranked: Array<{ id: number; fairness: { playCountScore: number } }>,
  id: number,
): number {
  return ranked.find((p) => p.id === id)!.fairness.playCountScore;
}

describe('PlayerWeightingService', () => {
  let service: PlayerWeightingService;

  beforeEach(() => {
    service = new PlayerWeightingService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns an empty array for an empty pool', () => {
    expect(service.weight([], session(), NOW)).toEqual([]);
  });

  describe('playcount score', () => {
    it('ranks the lowest play count first', () => {
      const ranked = service.weight(
        [player({ id: 1, playCount: 2 }), player({ id: 2, playCount: 0 })],
        session(),
        NOW,
      );

      expect(ranked[0].id).toBe(2);
      expect(ranked[0].fairness.playCountScore).toBe(1);
      expect(ranked[1].fairness.playCountScore).toBe(0);
    });

    it('returns a neutral 0.5 when everyone has the same play count', () => {
      const ranked = service.weight(
        [player({ id: 1, playCount: 3 }), player({ id: 2, playCount: 3 })],
        session(),
        NOW,
      );

      expect(ranked[0].fairness.playCountScore).toBe(0.5);
      expect(ranked[1].fairness.playCountScore).toBe(0.5);
      expect(ranked[0].fairness.bucket).toBe(ranked[1].fairness.bucket);
    });

    it('treats a null play count as zero', () => {
      const ranked = service.weight(
        [
          player({ id: 1, playCount: null }),
          player({ id: 2, playCount: 2 }),
        ],
        session(),
        NOW,
      );

      expect(ranked[0].id).toBe(1);
    });
  });

  describe('waiting time score', () => {
    it('ranks the longest idle player first', () => {
      const ranked = service.weight(
        [
          player({ id: 1, checkedInAt: new Date('2026-09-23T10:50:00.000Z') }),
          player({ id: 2, checkedInAt: SESSION_START }),
        ],
        session(),
        NOW,
      );

      expect(ranked[0].id).toBe(2);
      expect(ranked[0].fairness.waitingScore).toBe(1);
      expect(ranked[1].fairness.waitingScore).toBe(0);
    });

    it('gives a player who just finished a match the lowest waiting score', () => {
      const ranked = service.weight(
        [
          player({ id: 1, lastMatchFinishedAt: NOW }),
          player({ id: 2, lastMatchFinishedAt: null }),
        ],
        session(),
        NOW,
      );

      const finished = ranked.find((p) => p.id === 1)!;
      expect(finished.fairness.waitingScore).toBe(0);
      expect(ranked[0].id).toBe(2);
    });
  });

  describe('late joiner catchup', () => {
    it('adds a bonus proportional to how late the player arrived', () => {
      const early = service.weight(
        [player({ id: 1, checkedInAt: SESSION_START })],
        session(),
        NOW,
      );
      const late = service.weight(
        [
          player({
            id: 1,
            checkedInAt: new Date('2026-09-23T10:30:00.000Z'),
          }),
        ],
        session(),
        NOW,
      );

      expect(late[0].fairness.arrivalRatio).toBeCloseTo(0.5);
      expect(early[0].fairness.arrivalRatio).toBe(0);
      expect(late[0].fairness.total).toBeGreaterThan(early[0].fairness.total);
    });

    it('applies no bonus when the session has not started', () => {
      const ranked = service.weight(
        [player({ id: 1, checkedInAt: new Date('2026-09-23T10:30:00.000Z') })],
        session({ startedAt: null }),
        NOW,
      );

      expect(ranked[0].fairness.arrivalRatio).toBe(0);
      expect(ranked[0].fairness.total).toBe(2.5);
    });

    it('does not apply the catchup bonus under SESSION_AVERAGE', () => {
      const ranked = service.weight(
        [player({ id: 1, checkedInAt: new Date('2026-09-23T10:30:00.000Z') })],
        session(
          withSettings({
            lateJoinerPolicy: LateJoinerPolicy.SESSION_AVERAGE,
          }),
        ),
        NOW,
      );

      expect(ranked[0].fairness.arrivalRatio).toBeCloseTo(0.5);
      expect(ranked[0].fairness.total).toBe(2.5);
    });
  });

  describe('SESSION_AVERAGE', () => {
    // pool A=6, B=4, C=2 and D=0 who arrived 48 minutes into the session.
    const pool = () => [
      player({ id: 1, playCount: 6 }),
      player({ id: 2, playCount: 4 }),
      player({ id: 3, playCount: 2 }),
      player({
        id: 4,
        playCount: 0,
        checkedInAt: new Date('2026-09-23T10:48:00.000Z'),
      }),
    ];

    const averaged = () =>
      service.weight(
        pool(),
        session(
          withSettings({ lateJoinerPolicy: LateJoinerPolicy.SESSION_AVERAGE }),
        ),
        NOW,
      );

    it('pulls a late joiner toward the pool average instead of a full catchup', () => {
      const catchup = service.weight(
        pool(),
        session(
          withSettings({
            lateJoinerPolicy: LateJoinerPolicy.EQUAL_PLAY_CATCHUP,
          }),
        ),
        NOW,
      );

      // average is 3, so D blends from 0 to 3 * 0.8 = 2.4
      expect(scoreOf(averaged(), 4)).toBeCloseTo(0.9);
      expect(scoreOf(catchup, 4)).toBeCloseTo(1);
    });

    it('ranks the late joiner just below the least-played on-time player', () => {
      const ranked = averaged();
      const byScore = [...ranked].sort(
        (a, b) => b.fairness.playCountScore - a.fairness.playCountScore,
      );

      expect(byScore.map((p) => p.id)).toEqual([3, 4, 2, 1]);
      expect(scoreOf(ranked, 4)).toBeLessThan(scoreOf(ranked, 3));
      expect(scoreOf(ranked, 4)).toBeGreaterThan(scoreOf(ranked, 2));
    });

    it('preserves the relative order of on-time players', () => {
      const rank = (rows: ReturnType<typeof averaged>) =>
        [...rows]
          .sort(
            (a, b) => b.fairness.playCountScore - a.fairness.playCountScore,
          )
          .map((p) => p.id)
          .filter((id) => id !== 4);

      // The blend is an identity transform for on-time players, so although
      // their absolute scores shift (normalisation is pool-relative), their
      // relative ranking must match the catchup run.
      expect(rank(averaged())).toEqual([3, 2, 1]);
      expect(
        rank(
          service.weight(
            pool(),
            session(
              withSettings({
                lateJoinerPolicy: LateJoinerPolicy.EQUAL_PLAY_CATCHUP,
              }),
            ),
            NOW,
          ),
        ),
      ).toEqual([3, 2, 1]);
    });

    it('is a no-op when nobody arrived late', () => {
      const onTime = [
        player({ id: 1, playCount: 6 }),
        player({ id: 2, playCount: 2 }),
      ];
      const ranked = service.weight(
        onTime,
        session(
          withSettings({ lateJoinerPolicy: LateJoinerPolicy.SESSION_AVERAGE }),
        ),
        NOW,
      );

      expect(scoreOf(ranked, 2)).toBe(1);
      expect(scoreOf(ranked, 1)).toBe(0);
    });
  });

  describe('MIN_SESSION_PLAY', () => {
    const minPlay = () =>
      session(
        withSettings({ lateJoinerPolicy: LateJoinerPolicy.MIN_SESSION_PLAY }),
      );

    it('pins every player below the minimum to the top of the range', () => {
      const ranked = service.weight(
        [
          player({ id: 1, playCount: 0 }),
          player({ id: 2, playCount: MIN_SESSION_PLAY_COUNT - 1 }),
          player({ id: 3, playCount: MIN_SESSION_PLAY_COUNT }),
          player({ id: 4, playCount: 4 }),
        ],
        minPlay(),
        NOW,
      );

      // Without the floor the second player would normalize to 0.75.
      expect(scoreOf(ranked, 1)).toBe(1);
      expect(scoreOf(ranked, 2)).toBe(1);
      expect(scoreOf(ranked, 3)).toBeCloseTo(0.5);
      expect(scoreOf(ranked, 4)).toBe(0);
    });

    it('keeps normal scoring for players at or above the minimum', () => {
      const ranked = service.weight(
        [
          player({ id: 1, playCount: MIN_SESSION_PLAY_COUNT }),
          player({ id: 2, playCount: MIN_SESSION_PLAY_COUNT + 1 }),
          player({ id: 3, playCount: MIN_SESSION_PLAY_COUNT + 2 }),
        ],
        minPlay(),
        NOW,
      );

      expect(scoreOf(ranked, 1)).toBe(1);
      expect(scoreOf(ranked, 2)).toBeCloseTo(0.5);
      expect(scoreOf(ranked, 3)).toBe(0);
    });

    it('keeps the whole pool pinned when everyone is below the minimum', () => {
      const ranked = service.weight(
        [player({ id: 1, playCount: 0 }), player({ id: 2, playCount: 1 })],
        minPlay(),
        NOW,
      );

      expect(ranked.every((p) => p.fairness.playCountScore === 1)).toBe(true);
    });

    it('sorts below-minimum players ahead of the rest', () => {
      const ranked = service.weight(
        [
          player({ id: 1, playCount: 0 }),
          player({ id: 2, playCount: MIN_SESSION_PLAY_COUNT }),
          player({ id: 3, playCount: 5 }),
        ],
        minPlay(),
        NOW,
      );

      expect(ranked.map((p) => p.id)).toEqual([1, 2, 3]);
    });

    it('does not apply the catchup bonus', () => {
      const ranked = service.weight(
        [player({ id: 1, checkedInAt: new Date('2026-09-23T10:30:00.000Z') })],
        minPlay(),
        NOW,
      );

      expect(ranked[0].fairness.arrivalRatio).toBeCloseTo(0.5);
      expect(ranked[0].fairness.total).toBe(3.5);
    });
  });

  describe('weights', () => {
    it('maps priority levels to weights', () => {
      const ranked = service.weight(
        [player({ id: 1 })],
        session({
          sessionSettings: {
            attendanceCheckIn: true,
            equalPlayPriority: PriorityLevel.MAX,
            prioritizeWaitingPlayers: PriorityLevel.LOW,
          },
        }),
        NOW,
      );

      expect(ranked[0].fairness.weights).toEqual({
        equalPlay: 4,
        waitingTime: 1,
      });
    });
  });

  describe('deadband', () => {
    it('separates clearly different scores into different buckets', () => {
      const ranked = service.weight(
        [player({ id: 1, playCount: 0 }), player({ id: 2, playCount: 5 })],
        session(),
        NOW,
      );

      expect(ranked[0].id).toBe(1);
      expect(ranked[0].fairness.bucket).toBeGreaterThan(
        ranked[1].fairness.bucket,
      );
    });
  });

  describe('determinism', () => {
    it('breaks ties by id when scores are identical', () => {
      const ranked = service.weight(
        [
          player({ id: 2 }),
          player({ id: 1 }),
        ],
        session(),
        NOW,
      );

      expect(ranked.map((p) => p.id)).toEqual([1, 2]);
    });
  });
});