import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { SessionMatchUndoService } from './session-match-undo.service.js';
import { SessionMatchResultService } from './session-match-result.service.js';
import { PrismaService } from '../../../../config/prisma/prisma.service.js';
import { PlayerStatus, MatchStatus } from '../../../../../prisma/generated/prisma/enums.js';
import type { SessionContext } from '../../../shared/types/sport-sessions.types.js';

describe('SessionMatchUndoService', () => {
  let service: SessionMatchUndoService;
  let mockPrisma: any;
  let matchResults: { reconcilePlayers: ReturnType<typeof vi.fn> };

  const mockSession: SessionContext = {
    id: 'session-1',
    clubId: 'club-1',
    status: 'ACTIVE',
    title: 'Open Play',
    sessionSettings: { attendanceCheckIn: true },
    _count: { sessionCourts: 1, players: 8 },
  };

  beforeEach(async () => {
    mockPrisma = {
      sessionMatch: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
      },
      sessionPlayer: {
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
      matchPlayer: {
        count: vi.fn(),
      },
      matchResult: {
        deleteMany: vi.fn(),
      },
      sessionCourt: {
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    };
    mockPrisma.$transaction = vi.fn(async (arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as Function)(mockPrisma),
    );

    matchResults = {
      reconcilePlayers: vi.fn().mockResolvedValue(new Map()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionMatchUndoService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SessionMatchResultService, useValue: matchResults },
      ],
    }).compile();

    service = module.get<SessionMatchUndoService>(SessionMatchUndoService);
  });

  const primeUndo = (options: {
    status?: MatchStatus;
    playerIds?: number[];
    playerStatuses?: PlayerStatus[];
    committed?: number;
    aggregates?: Map<
      number,
      { playCount: number; lastMatchFinishedAt: Date | null }
    >;
  } = {}) => {
    const playerIds = options.playerIds ?? [1, 2, 3, 4];
    const playerStatuses =
      options.playerStatuses ??
      playerIds.map(() => PlayerStatus.RESTING);

    mockPrisma.sessionMatch.findFirst.mockResolvedValue({
      id: 'match-1',
      status: options.status ?? MatchStatus.FINISHED,
      players: playerIds.map((sessionPlayerId) => ({ sessionPlayerId })),
    });
    mockPrisma.sessionPlayer.findMany.mockResolvedValue(
      playerIds.map((id, index) => ({
        id,
        status: playerStatuses[index],
      })),
    );
    mockPrisma.matchPlayer.count.mockResolvedValue(options.committed ?? 0);
    mockPrisma.sessionMatch.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.sessionPlayer.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.matchResult.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.sessionMatch.findUnique.mockResolvedValue({ id: 'match-1' });
    matchResults.reconcilePlayers.mockResolvedValue(
      options.aggregates ?? new Map(),
    );

    return playerIds;
  };

  it('throws when the match does not belong to the session', async () => {
    mockPrisma.sessionMatch.findFirst.mockResolvedValue(null);

    await expect(service.undoFinishMatch(mockSession, 'match-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(mockPrisma.sessionMatch.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a match that is not finished', async () => {
    primeUndo({ status: MatchStatus.PLAYING });

    await expect(service.undoFinishMatch(mockSession, 'match-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(mockPrisma.sessionMatch.updateMany).not.toHaveBeenCalled();
    expect(matchResults.reconcilePlayers).not.toHaveBeenCalled();
  });

  it('rejects a second undo of the same match', async () => {
    primeUndo({ status: MatchStatus.QUEUED });

    await expect(service.undoFinishMatch(mockSession, 'match-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('moves the match back to the queue without touching the court', async () => {
    primeUndo();

    await service.undoFinishMatch(mockSession, 'match-1');

    expect(mockPrisma.sessionMatch.updateMany).toHaveBeenCalledWith({
      where: { id: 'match-1', status: { in: [MatchStatus.FINISHED] } },
      data: {
        status: MatchStatus.QUEUED,
        sequence: null,
        sessionCourtId: null,
        assignedAt: null,
        startedAt: null,
        endedAt: null,
        scoreTeamA: 0,
        scoreTeamB: 0,
        cancelReason: null,
        cancelledAt: null,
      },
    });
    expect(mockPrisma.sessionCourt.update).not.toHaveBeenCalled();
    expect(mockPrisma.sessionCourt.updateMany).not.toHaveBeenCalled();
  });

  it('reserves the players again and clears their rest timer', async () => {
    primeUndo({
      aggregates: new Map([[1, { playCount: 2, lastMatchFinishedAt: null }]]),
    });

    await service.undoFinishMatch(mockSession, 'match-1');

    expect(mockPrisma.sessionPlayer.updateMany).toHaveBeenCalledWith({
      where: {
        id: 1,
        sessionId: mockSession.id,
        status: { in: [PlayerStatus.RESTING, PlayerStatus.WAITING] },
      },
      data: {
        status: PlayerStatus.RESERVED,
        restUntil: null,
        playCount: 2,
        lastMatchFinishedAt: null,
      },
    });
  });

  it('updates players in ascending id order', async () => {
    primeUndo({ playerIds: [3, 1, 2] });

    await service.undoFinishMatch(mockSession, 'match-1');

    const updatedIds = mockPrisma.sessionPlayer.updateMany.mock.calls.map(
      (call: any[]) => call[0].where.id,
    );
    expect(updatedIds).toEqual([1, 2, 3]);
  });

  it('recomputes from the remaining finished matches, sorted by id', async () => {
    primeUndo({ playerIds: [4, 2] });

    await service.undoFinishMatch(mockSession, 'match-1');

    expect(matchResults.reconcilePlayers).toHaveBeenCalledWith(
      mockPrisma,
      mockSession.id,
      [2, 4],
    );
  });

  it('deletes the derived result row', async () => {
    primeUndo();

    await service.undoFinishMatch(mockSession, 'match-1');

    expect(mockPrisma.matchResult.deleteMany).toHaveBeenCalledWith({
      where: { matchId: 'match-1' },
    });
  });

  it('rejects when a player no longer belongs to the session', async () => {
    primeUndo();
    mockPrisma.sessionPlayer.findMany.mockResolvedValue([
      { id: 1, status: PlayerStatus.RESTING },
    ]);

    await expect(service.undoFinishMatch(mockSession, 'match-1')).rejects.toThrow(
      ConflictException,
    );
    expect(mockPrisma.sessionMatch.updateMany).not.toHaveBeenCalled();
  });

  it('rejects when a player is not resting or waiting', async () => {
    primeUndo({
      playerIds: [1, 2],
      playerStatuses: [PlayerStatus.RESTING, PlayerStatus.LEFT],
    });

    await expect(service.undoFinishMatch(mockSession, 'match-1')).rejects.toThrow(
      ConflictException,
    );
    expect(mockPrisma.sessionMatch.updateMany).not.toHaveBeenCalled();
  });

  it('rejects when a player is committed to another active match', async () => {
    primeUndo({ committed: 1 });

    await expect(service.undoFinishMatch(mockSession, 'match-1')).rejects.toThrow(
      ConflictException,
    );
    expect(mockPrisma.sessionMatch.updateMany).not.toHaveBeenCalled();
    expect(matchResults.reconcilePlayers).not.toHaveBeenCalled();
  });

  it('rejects when the match was undone concurrently', async () => {
    primeUndo();
    mockPrisma.sessionMatch.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.undoFinishMatch(mockSession, 'match-1')).rejects.toThrow(
      ConflictException,
    );
    expect(matchResults.reconcilePlayers).not.toHaveBeenCalled();
  });

  it('rejects when a player was reserved concurrently', async () => {
    primeUndo();
    mockPrisma.sessionPlayer.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.undoFinishMatch(mockSession, 'match-1')).rejects.toThrow(
      ConflictException,
    );
    expect(mockPrisma.matchResult.deleteMany).not.toHaveBeenCalled();
  });

  it('runs the undo in a single transaction', async () => {
    primeUndo();

    await service.undoFinishMatch(mockSession, 'match-1');

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
  });
});
