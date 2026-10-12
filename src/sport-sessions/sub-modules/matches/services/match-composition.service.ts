import { Injectable, BadRequestException } from '@nestjs/common';
import {
  GenderPreferenceType,
  GenderType,
  MatchMakingMode,
  SkillLevel,
} from '../../../../../prisma/generated/prisma/enums.js';
import {
  GENDER_MATCH_BONUS,
  PLAYERS_PER_MATCH,
  SELECTION_WINDOW,
} from '../../../shared/constants/sport-sessions.constant.js';

export interface ComposablePlayer {
  id: number;
  clubMember: {
    skillLevel: SkillLevel;
    gender: GenderType | null;
  };
  fairness: { total: number };
}

export interface CompositionOptions {
  mode: MatchMakingMode;
  genderPreference: GenderPreferenceType | null;
}

export interface ComposedLineup {
  teamA: number[];
  teamB: number[];
  /** Ordered ids, best candidates first, for logging/diagnostics. */
  selected: number[];
}

/** The three distinct 2v2 splits of a 4-element set. */
const PARTITIONS: ReadonlyArray<[number, number, number, number]> = [
  [0, 1, 2, 3],
  [0, 2, 1, 3],
  [0, 3, 1, 2],
];

@Injectable()
export class MatchCompositionService {
  compose(
    players: ComposablePlayer[],
    options: CompositionOptions,
  ): ComposedLineup {
    if (players.length < PLAYERS_PER_MATCH) {
      throw new BadRequestException(
        `At least ${PLAYERS_PER_MATCH} players are required to form a match`,
      );
    }

    // Fairness gate: only the highest-ranked players are ever considered.
    const window = players.slice(0, SELECTION_WINDOW);

    const chosen =
      options.mode === MatchMakingMode.RANDOM
        ? window.slice(0, PLAYERS_PER_MATCH)
        : this.selectBestSubset(window, options);

    const [teamA, teamB] = this.splitTeams(chosen, options.mode);

    return {
      teamA: teamA.map((player) => player.id),
      teamB: teamB.map((player) => player.id),
      selected: chosen.map((player) => player.id),
    };
  }

  private selectBestSubset(
    window: ComposablePlayer[],
    options: CompositionOptions,
  ): ComposablePlayer[] {
    let best: {
      group: ComposablePlayer[];
      quality: number;
      fairnessSum: number;
      ranks: number[];
    } | null = null;

    for (const ranks of combinations(window.length, PLAYERS_PER_MATCH)) {
      const group = ranks.map((rank) => window[rank]);
      const [teamA, teamB] = this.splitTeams(group, options.mode);

      const quality =
        this.scoreSkillFit(group, teamA, teamB, options.mode) +
        this.scoreGenderBonus(teamA, teamB, options);
      const fairnessSum = group.reduce(
        (sum, player) => sum + player.fairness.total,
        0,
      );

      const isBetter =
        best === null ||
        quality > best.quality ||
        (quality === best.quality && fairnessSum > best.fairnessSum) ||
        (quality === best.quality &&
          fairnessSum === best.fairnessSum &&
          compareRanks(ranks, best.ranks) < 0);

      if (isBetter) {
        best = { group, quality, fairnessSum, ranks };
      }
    }

    return best!.group;
  }

  private scoreSkillFit(
    group: ComposablePlayer[],
    teamA: ComposablePlayer[],
    teamB: ComposablePlayer[],
    mode: MatchMakingMode,
  ): number {
    if (mode === MatchMakingMode.SKILL_BASED) {
      const skills = group.map((player) =>
        skillValue(player.clubMember.skillLevel),
      );
      return -(Math.max(...skills) - Math.min(...skills));
    }

    return -Math.abs(teamStrength(teamA) - teamStrength(teamB));
  }

  private scoreGenderBonus(
    teamA: ComposablePlayer[],
    teamB: ComposablePlayer[],
    options: CompositionOptions,
  ): number {
    const preference = options.genderPreference;

    if (!preference || preference === GenderPreferenceType.OFF) return 0;

    const satisfies = (team: ComposablePlayer[]) => {
      const genders = team.map((player) => player.clubMember.gender);
      if (genders.some((gender) => gender === null)) return false;

      const distinct = new Set(genders).size;
      return preference === GenderPreferenceType.PREFER_MIXED
        ? distinct === 2
        : distinct === 1;
    };

    return [teamA, teamB].filter(satisfies).length * GENDER_MATCH_BONUS;
  }

  private splitTeams(
    group: ComposablePlayer[],
    mode: MatchMakingMode,
  ): [ComposablePlayer[], ComposablePlayer[]] {
    if (mode === MatchMakingMode.RANDOM) {
      // Deterministic, skill-agnostic split of the fairness order.
      return [
        [group[0], group[2]],
        [group[1], group[3]],
      ];
    }

    let best: {
      a: ComposablePlayer[];
      b: ComposablePlayer[];
      diff: number;
    } | null = null;

    for (const [i0, i1, i2, i3] of PARTITIONS) {
      const a = [group[i0], group[i1]];
      const b = [group[i2], group[i3]];
      const diff = Math.abs(teamStrength(a) - teamStrength(b));

      if (best === null || diff < best.diff) {
        best = { a, b, diff };
      }
    }

    return [best!.a, best!.b];
  }
}

function teamStrength(team: ComposablePlayer[]): number {
  return team.reduce(
    (sum, player) => sum + skillValue(player.clubMember.skillLevel),
    0,
  );
}

function skillValue(skillLevel: SkillLevel): number {
  return Object.keys(SkillLevel).indexOf(skillLevel);
}

function compareRanks(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function combinations(size: number, take: number): number[][] {
  const result: number[][] = [];

  const walk = (start: number, current: number[]) => {
    if (current.length === take) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < size; i += 1) {
      current.push(i);
      walk(i + 1, current);
      current.pop();
    }
  };

  walk(0, []);
  return result;
}
