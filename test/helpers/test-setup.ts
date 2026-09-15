import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
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

const TEST_USER = {
  name: 'E2E Test User',
  email: `e2e-test-${Date.now()}@example.com`,
  gender: 'MALE' as const,
  username: `e2euser-${Date.now()}`,
};

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

  // Clean up any leftover test data
  await cleanupTestApp(prisma);

  // Create test user
  const testUser = await prisma.user.create({
    data: TEST_USER,
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

export async function cleanupTestApp(prisma: PrismaService): Promise<void> {
  // Delete refresh sessions first (foreign key constraint)
  await prisma.refreshSession.deleteMany({});
  // Delete test users
  await prisma.user.deleteMany({});
}

export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
