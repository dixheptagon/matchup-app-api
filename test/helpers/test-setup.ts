import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/config/prisma/prisma.service.js';
import { TokenService } from '../../src/auth/token.service.js';
import { User } from '../../prisma/generated/prisma/client.js';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  tokenService: TokenService;
  testUser: User;
  accessToken: string;
  refreshToken: string;
}

export async function setupTestApp(): Promise<TestContext> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();

  const prisma = app.get(PrismaService);
  const tokenService = app.get(TokenService);

  // Create test user with unique identifiers
  const uniqueId = randomUUID().slice(0, 8);
  const testUser = await prisma.user.create({
    data: {
      name: 'E2E Test User',
      email: `e2e-test-${uniqueId}@example.com`,
      gender: 'MALE',
      username: `e2euser-${uniqueId}`,
    },
  });

  // Generate tokens
  const accessToken = tokenService.signAccessToken(testUser as any);
  const refreshToken = tokenService.signRefreshToken(testUser.id);

  // Create refresh session
  await tokenService.createRefreshSession(testUser.id, refreshToken, {
    deviceName: 'E2E Test',
    ipAddress: '127.0.0.1',
    userAgent: 'supertest',
  });

  return { app, prisma, tokenService, testUser, accessToken, refreshToken };
}

export async function cleanupTestApp(
  prisma: PrismaService,
  userId?: number,
): Promise<void> {
  if (userId) {
    // Targeted cleanup: only delete this test user's data
    await prisma.refreshSession.deleteMany({ where: { userId } });
    await prisma.sportClub.deleteMany({ where: { ownerId: userId } });
    await prisma.user.delete({ where: { id: userId } });
  } else {
    // Fallback: clean all (used sparingly)
    await prisma.refreshSession.deleteMany({});
    await prisma.sportClub.deleteMany({});
    await prisma.user.deleteMany({});
  }
}

export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
