import { BadRequestException } from '@nestjs/common';
import { MatchCompositionService } from './match-composition.service.js';
import type {
  ComposablePlayer,
  CompositionOptions,
} from './match-composition.service.js';
import {
  GenderPreferenceType,
  GenderType,
  MatchMakingMode,
  SkillLevel,
} from '../../../../../prisma/generated/prisma/enums.js';

function player(
  id: number,
  skillLevel: SkillLevel = SkillLevel.BEGINNER,
  gender: GenderType | null = GenderType.MALE,
  total = 1,
): ComposablePlayer {
  return {
    id,
    clubMember: { skillLevel, gender },
    fairness: { total },
  };
}

function options(
  mode: MatchMakingMode,
  genderPreference: GenderPreferenceType | null = null,
): CompositionOptions {
  return { mode, genderPreference };
}

describe('MatchCompositionService', () => {
  let service: MatchCompositionService;

  beforeEach(() => {
    service = new MatchCompositionService();
  });

  it('rejects when there are not enough players', () => {
    expect(() =>
      service.compose(
        [player(1), player(2), player(3)],
        options(MatchMakingMode.BALANCED),
      ),
    ).toThrow(BadRequestException);
  });

  describe('BALANCED', () => {
    it('splits teams so their strengths are as close as possible', () => {
      // 3,3,0,0 -> any split balances equally
      const lineup = service.compose(
        [
          player(1, SkillLevel.INTERMEDIATE),
          player(2, SkillLevel.INTERMEDIATE),
          player(3, SkillLevel.NEWBIE),
          player(4, SkillLevel.NEWBIE),
        ],
        options(MatchMakingMode.BALANCED),
      );

      expect(lineup.teamA).toHaveLength(2);
      expect(lineup.teamB).toHaveLength(2);
      expect([...lineup.teamA, ...lineup.teamB].sort()).toEqual([1, 2, 3, 4]);
    });

    it('never leaves a team with both of the strongest players', () => {
      const lineup = service.compose(
        [
          player(1, SkillLevel.ADVANCE),
          player(2, SkillLevel.ADVANCE),
          player(3, SkillLevel.NEWBIE),
          player(4, SkillLevel.NEWBIE),
        ],
        options(MatchMakingMode.BALANCED),
      );

      const strengths = (team: number[]) =>
        team.reduce((sum, id) => sum + (id <= 2 ? 3 : 0), 0);

      expect(strengths(lineup.teamA)).toBe(strengths(lineup.teamB));
    });

    it('prefers a subset whose teams balance best', () => {
      const strengths: Record<number, SkillLevel> = {
        1: SkillLevel.NEWBIE,
        2: SkillLevel.NEWBIE,
        3: SkillLevel.ADVANCE,
        4: SkillLevel.ADVANCE,
        5: SkillLevel.NEWBIE,
        6: SkillLevel.NEWBIE,
      };
      const value = (id: number) =>
        Object.keys(SkillLevel).indexOf(strengths[id]);

      const lineup = service.compose(
        Object.entries(strengths).map(([id, skill]) =>
          player(Number(id), skill),
        ),
        options(MatchMakingMode.BALANCED),
      );

      // The two ADVANCE players must be split across the two teams.
      expect(lineup.teamA.includes(3)).not.toBe(lineup.teamB.includes(3));
      expect(
        lineup.teamA.reduce((sum, id) => sum + value(id), 0),
      ).toBe(lineup.teamB.reduce((sum, id) => sum + value(id), 0));
    });
  });

  describe('SKILL_BASED', () => {
    it('prefers a tight skill band over a lower-fairness wide group', () => {
      const lineup = service.compose(
        [
          player(1, SkillLevel.BEGINNER),
          player(2, SkillLevel.BEGINNER),
          player(3, SkillLevel.BEGINNER),
          player(4, SkillLevel.BEGINNER),
          player(5, SkillLevel.ADVANCE),
          player(6, SkillLevel.ADVANCE),
        ],
        options(MatchMakingMode.SKILL_BASED),
      );

      expect(lineup.selected).toEqual([1, 2, 3, 4]);
    });
  });

  describe('RANDOM', () => {
    it('ignores skill and takes the top four by fairness', () => {
      const lineup = service.compose(
        [
          player(1, SkillLevel.ADVANCE),
          player(2, SkillLevel.ADVANCE),
          player(3, SkillLevel.NEWBIE),
          player(4, SkillLevel.NEWBIE),
          player(5, SkillLevel.ADVANCE),
        ],
        options(MatchMakingMode.RANDOM),
      );

      expect(lineup.selected).toEqual([1, 2, 3, 4]);
      expect(lineup.teamA).toEqual([1, 3]);
      expect(lineup.teamB).toEqual([2, 4]);
    });
  });

  describe('gender preference', () => {
    it('adds a bonus for mixed teams', () => {
      const mixed = service.compose(
        [
          player(1, SkillLevel.BEGINNER, GenderType.MALE),
          player(2, SkillLevel.BEGINNER, GenderType.FEMALE),
          player(3, SkillLevel.BEGINNER, GenderType.MALE),
          player(4, SkillLevel.BEGINNER, GenderType.FEMALE),
          player(5, SkillLevel.BEGINNER, GenderType.MALE),
          player(6, SkillLevel.BEGINNER, GenderType.MALE),
        ],
        options(MatchMakingMode.BALANCED, GenderPreferenceType.PREFER_MIXED),
      );

      for (const team of [mixed.teamA, mixed.teamB]) {
        const genders = team
          .map((id) => (id % 2 === 1 ? GenderType.MALE : GenderType.FEMALE))
          .sort();
        expect(new Set(genders).size).toBe(2);
      }
    });

    it('adds a bonus for same-gender teams', () => {
      const lineup = service.compose(
        [
          player(1, SkillLevel.BEGINNER, GenderType.MALE),
          player(2, SkillLevel.BEGINNER, GenderType.MALE),
          player(3, SkillLevel.BEGINNER, GenderType.MALE),
          player(4, SkillLevel.BEGINNER, GenderType.MALE),
        ],
        options(
          MatchMakingMode.BALANCED,
          GenderPreferenceType.PREFER_SAME_GENDER,
        ),
      );

      expect(lineup.teamA).toHaveLength(2);
      expect(lineup.teamB).toHaveLength(2);
    });

    it('still forms a match when the preference cannot be satisfied', () => {
      const lineup = service.compose(
        [
          player(1, SkillLevel.BEGINNER, GenderType.MALE),
          player(2, SkillLevel.BEGINNER, GenderType.MALE),
          player(3, SkillLevel.BEGINNER, GenderType.MALE),
          player(4, SkillLevel.BEGINNER, GenderType.MALE),
        ],
        options(
          MatchMakingMode.BALANCED,
          GenderPreferenceType.PREFER_MIXED,
        ),
      );

      expect(lineup.teamA).toHaveLength(2);
      expect(lineup.teamB).toHaveLength(2);
    });

    it('ignores gender when the preference is OFF', () => {
      const lineup = service.compose(
        [
          player(1, SkillLevel.BEGINNER, GenderType.MALE),
          player(2, SkillLevel.BEGINNER, GenderType.MALE),
          player(3, SkillLevel.BEGINNER, GenderType.MALE),
          player(4, SkillLevel.BEGINNER, GenderType.MALE),
        ],
        options(MatchMakingMode.BALANCED, GenderPreferenceType.OFF),
      );

      expect(lineup.selected).toEqual([1, 2, 3, 4]);
    });
  });

  it('is deterministic for identical input', () => {
    const pool = [
      player(1, SkillLevel.INTERMEDIATE),
      player(2, SkillLevel.NEWBIE),
      player(3, SkillLevel.ADVANCE),
      player(4, SkillLevel.BEGINNER),
      player(5, SkillLevel.INTERMEDIATE),
    ];

    const first = service.compose(pool, options(MatchMakingMode.BALANCED));
    const second = service.compose(pool, options(MatchMakingMode.BALANCED));

    expect(first).toEqual(second);
  });

  it('only considers the top of the fairness window', () => {
    const pool = Array.from({ length: 20 }, (_, index) =>
      player(index + 1, SkillLevel.BEGINNER),
    );

    const lineup = service.compose(pool, options(MatchMakingMode.BALANCED));

    for (const id of lineup.selected) {
      expect(pool.find((p) => p.id === id)!.fairness.total).toBe(1);
    }
    expect(lineup.selected).toHaveLength(4);
  });
});