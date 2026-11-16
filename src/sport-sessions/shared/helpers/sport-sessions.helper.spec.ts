import {
  allocateMatchSequence,
  applyEffectivePlayerStatus,
  buildEligiblePlayersWhere,
  buildRestingFallbackPlayersWhere,
  promoteRestedPlayers,
} from './sport-sessions.helper.js';
import { PlayerStatus } from '../../../../prisma/generated/prisma/enums.js';

describe('allocateMatchSequence', () => {
  let tx: any;

  beforeEach(() => {
    tx = { sessionMatch: { findFirst: vi.fn() } };
  });

  it('starts at 1 when the session has no sequence yet', async () => {
    tx.sessionMatch.findFirst.mockResolvedValue(null);

    const sequence = await allocateMatchSequence(tx, 'session-1');

    expect(sequence).toBe(1);
  });

  it('increments past the highest allocated sequence', async () => {
    tx.sessionMatch.findFirst.mockResolvedValue({ sequence: 7 });

    const sequence = await allocateMatchSequence(tx, 'session-1');

    expect(sequence).toBe(8);
  });

  it('ignores matches that have not been assigned a sequence', async () => {
    tx.sessionMatch.findFirst.mockResolvedValue({ sequence: 3 });

    await allocateMatchSequence(tx, 'session-1');

    expect(tx.sessionMatch.findFirst).toHaveBeenCalledWith({
      where: { sessionId: 'session-1', sequence: { not: null } },
      orderBy: { sequence: 'desc' },
      select: { sequence: true },
    });
  });
});

describe('buildEligiblePlayersWhere', () => {
  it('restricts the physical pool to waiting players', () => {
    const where = buildEligiblePlayersWhere('session-1');

    expect(where.status).toBe(PlayerStatus.WAITING);
    expect(where.OR).toBeUndefined();
  });

  it('counts elapsed rests and timed breaks as waiting when given now', () => {
    const now = new Date('2026-10-01T12:00:00.000Z');
    const where = buildEligiblePlayersWhere('session-1', now);

    expect(where.OR).toEqual([
      { status: PlayerStatus.WAITING },
      {
        status: PlayerStatus.RESTING,
        OR: [{ restUntil: null }, { restUntil: { lte: now } }],
      },
      { status: PlayerStatus.BREAK, restUntil: { not: null, lte: now } },
    ]);
  });

  it('always excludes players committed to an unfinished match', () => {
    const where = buildEligiblePlayersWhere('session-1', new Date());

    expect(where.matchPlayers.none.match.status.in).toContain('PLAYING');
    expect(where.matchPlayers.none.match.status.in).not.toContain('FINISHED');
  });
});

describe('buildRestingFallbackPlayersWhere', () => {
  it('selects resting players not committed to an unfinished match', () => {
    const where = buildRestingFallbackPlayersWhere('session-1');

    expect(where.sessionId).toBe('session-1');
    expect(where.status).toBe(PlayerStatus.RESTING);
    expect(where.matchPlayers.none.match.status.in).not.toContain('FINISHED');
  });
});

describe('applyEffectivePlayerStatus', () => {
  const now = new Date('2026-10-01T12:00:00.000Z');

  it('presents an elapsed rest as waiting', () => {
    const player = {
      status: PlayerStatus.RESTING,
      restUntil: new Date('2026-10-01T11:00:00.000Z'),
    };

    expect(applyEffectivePlayerStatus(player, now)).toEqual({
      status: PlayerStatus.WAITING,
      restUntil: null,
    });
  });

  it('treats a rest without a timer as elapsed', () => {
    const player = { status: PlayerStatus.RESTING, restUntil: null };

    expect(applyEffectivePlayerStatus(player, now).status).toBe(
      PlayerStatus.WAITING,
    );
  });

  it('presents an elapsed timed break as waiting', () => {
    const player = {
      status: PlayerStatus.BREAK,
      restUntil: new Date('2026-10-01T11:00:00.000Z'),
    };

    expect(applyEffectivePlayerStatus(player, now)).toEqual({
      status: PlayerStatus.WAITING,
      restUntil: null,
    });
  });

  it('keeps an indefinite break until an admin resumes it', () => {
    const player = { status: PlayerStatus.BREAK, restUntil: null };

    expect(applyEffectivePlayerStatus(player, now)).toEqual(player);
  });

  it('keeps a still-running break untouched', () => {
    const player = {
      status: PlayerStatus.BREAK,
      restUntil: new Date('2026-10-01T20:00:00.000Z'),
    };

    expect(applyEffectivePlayerStatus(player, now)).toEqual(player);
  });
});

describe('promoteRestedPlayers', () => {
  let tx: any;

  beforeEach(() => {
    tx = { sessionPlayer: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) } };
  });

  it('promotes elapsed rests, clearing the timer', async () => {
    const now = new Date('2026-10-01T12:00:00.000Z');

    await promoteRestedPlayers(tx, 'session-1', now);

    expect(tx.sessionPlayer.updateMany).toHaveBeenCalledWith({
      where: {
        sessionId: 'session-1',
        status: PlayerStatus.RESTING,
        OR: [{ restUntil: null }, { restUntil: { lte: now } }],
      },
      data: { status: PlayerStatus.WAITING, restUntil: null },
    });
  });

  it('promotes only timed breaks that have elapsed', async () => {
    const now = new Date('2026-10-01T12:00:00.000Z');

    await promoteRestedPlayers(tx, 'session-1', now);

    expect(tx.sessionPlayer.updateMany).toHaveBeenCalledWith({
      where: {
        sessionId: 'session-1',
        status: PlayerStatus.BREAK,
        restUntil: { not: null, lte: now },
      },
      data: { status: PlayerStatus.WAITING, restUntil: null },
    });
  });
});
