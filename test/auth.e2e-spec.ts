import request from 'supertest';
import {
  setupTestApp,
  cleanupTestApp,
  authHeader,
  type TestContext,
} from './helpers/test-setup.js';

describe('Auth (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestApp();
  }, 30000);

  afterAll(async () => {
    await cleanupTestApp(ctx.prisma, ctx.testUser.id);
    await ctx.app.close();
  });

  describe('POST /auth/refresh', () => {
    it('should return new token pair with valid refresh token', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: ctx.refreshToken })
        .expect(200);

      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data).toHaveProperty('user');
      expect(res.body.data.user.id).toBe(ctx.testUser.id);
    });

    it('should return 401 with invalid refresh token', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' })
        .expect(401);
    });

    it('should return 400 with empty body', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/auth/refresh')
        .send({})
        .expect(400);
    });
  });

  describe('POST /auth/logout', () => {
    it('should revoke refresh token and return 200', async () => {
      // Create a new refresh token to revoke
      const tokenService = ctx.tokenService;
      const newRefreshToken = tokenService.signRefreshToken(ctx.testUser.id);
      await tokenService.createRefreshSession(
        ctx.testUser.id,
        newRefreshToken,
        {
          deviceName: 'Logout Test',
          ipAddress: '127.0.0.1',
          userAgent: 'supertest',
        },
      );

      const res = await request(ctx.app.getHttpServer())
        .post('/api/auth/logout')
        .set(authHeader(ctx.accessToken))
        .send({ refreshToken: newRefreshToken })
        .expect(200);

      expect(res.body.message).toBe('Logged out successfully');
    });

    it('should return 401 without JWT token', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/auth/logout')
        .send({ refreshToken: 'some-token' })
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    it('should return user profile with valid JWT', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/api/auth/me')
        .set(authHeader(ctx.accessToken))
        .expect(200);

      expect(res.body.data.id).toBe(ctx.testUser.id);
      expect(res.body.data.name).toBe(ctx.testUser.name);
      expect(res.body.data.email).toBe(ctx.testUser.email);
      expect(res.body.data).toHaveProperty('isVerified');
      expect(res.body.data).toHaveProperty('createdAt');
    });

    it('should return 401 without JWT token', async () => {
      await request(ctx.app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('should return 401 with invalid JWT token', async () => {
      await request(ctx.app.getHttpServer())
        .get('/api/auth/me')
        .set(authHeader('invalid-jwt-token'))
        .expect(401);
    });

    it('should include username and gender in response', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/api/auth/me')
        .set(authHeader(ctx.accessToken))
        .expect(200);

      expect(res.body.data.username).toBe(ctx.testUser.username);
      expect(res.body.data.gender).toBe(ctx.testUser.gender);
    });
  });
});
