import { allocateMatchSequence } from './sport-sessions.helper.js';

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