import { prisma } from '../seed.js';

export async function seedUsers() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@matchup.dev' },
    update: {},
    create: {
      name: 'Admin User',
      username: 'admin',
      email: 'admin@matchup.dev',
      gender: 'MALE',
      isVerified: true,
    },
  });

  const member = await prisma.user.upsert({
    where: { email: 'member@matchup.dev' },
    update: {},
    create: {
      name: 'Member User',
      username: 'member',
      email: 'member@matchup.dev',
      gender: 'FEMALE',
      isVerified: true,
    },
  });

  return { admin, member };
}
