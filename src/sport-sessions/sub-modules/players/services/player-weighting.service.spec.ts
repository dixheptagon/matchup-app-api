import { PlayerWeightingService } from './player-weighting.service.js';
import type { WeightablePlayer } from './player-weighting.service.js';
import { LateJoinerPolicy, PriorityLevel } from '../../../../../prisma/generated/prisma/enums.js';
import type { SessionContext } from '../../../shared/types/sport-sessions.types.js';

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

    it('applies no bonus when the policy is not EQUAL_PLAY_CATCHUP', () => {
      const ranked = service.weight(
        [player({ id: 1, checkedInAt: new Date('2026-09-23T10:30:00.000Z') })],
        session({
          sessionSettings: {
            attendanceCheckIn: true,
            lateJoinerPolicy: LateJoinerPolicy.SESSION_AVERAGE,
          },
        }),
        NOW,
      );

      expect(ranked[0].fairness.arrivalRatio).toBeCloseTo(0.5);
      expect(ranked[0].fairness.total).toBe(2.5);
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