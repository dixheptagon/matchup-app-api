import slugify from 'slugify';
import { PrismaService } from '../../config/prisma/prisma.service.js';

export async function generateUniqueSlug(
  name: string,
  db: PrismaService,
  modelName: 'sportClub' | 'sportSession',
): Promise<string> {
  const baseSlug = slugify(name, {
    lower: true,
    strict: true,
    trim: true,
  });
  let slug = baseSlug;
  let count = 1;

  while ((await (db[modelName] as any).count({ where: { slug } })) > 0) {
    slug = `${baseSlug}-${count}`;
    count++;
  }

  return slug;
}
