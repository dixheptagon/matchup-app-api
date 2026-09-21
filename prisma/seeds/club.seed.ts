import { prisma } from '../seed.js';

export async function seedClubs(ownerId: string) {
  const club = await prisma.sportClub.upsert({
    where: { name: 'MatchUp Club' },
    update: {},
    create: {
      name: 'MatchUp Club',
      slug: 'matchup-club',
      ownerId,
    },
  });

  return { club };
}
