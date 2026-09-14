import { seedUsers } from './seeds/user.seed.js';
import { seedClubs } from './seeds/club.seed.js';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  const { admin } = await seedUsers();
  console.log('Users seeded.');

  await seedClubs(admin.id);
  console.log('Clubs seeded.');

  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
