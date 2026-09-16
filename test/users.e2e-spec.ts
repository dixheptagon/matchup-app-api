import request from 'supertest';
import {
  setupTestApp,
  cleanupTestApp,
  authHeader,
  type TestContext,
} from './helpers/test-setup.js';

describe('Users (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestApp();
  }, 30000);

  afterAll(async () => {
    await cleanupTestApp(ctx.prisma, ctx.testUser.id);
    await ctx.app.close();
  });

  describe('PATCH /users/me', () => {
    it('should update username', async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch('/api/users/me')
        .set(authHeader(ctx.accessToken))
        .send({ username: 'newusername' })
        .expect(200);

      expect(res.body.username).toBe('newusername');
      expect(res.body.id).toBe(ctx.testUser.id);
    });

    it('should update gender', async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch('/api/users/me')
        .set(authHeader(ctx.accessToken))
        .send({ gender: 'FEMALE' })
        .expect(200);

      expect(res.body.gender).toBe('FEMALE');
    });

    it('should update both username and gender', async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch('/api/users/me')
        .set(authHeader(ctx.accessToken))
        .send({ username: 'bothupdated', gender: 'MALE' })
        .expect(200);

      expect(res.body.username).toBe('bothupdated');
      expect(res.body.gender).toBe('MALE');
    });

    it('should return 409 when username is already taken', async () => {
      // Create another user with a specific username
      const otherUser = await ctx.prisma.user.create({
        data: {
          name: 'Other User',
          email: 'other@example.com',
          gender: 'FEMALE',
          username: 'takenname',
        },
      });

      await request(ctx.app.getHttpServer())
        .patch('/api/users/me')
        .set(authHeader(ctx.accessToken))
        .send({ username: 'takenname' })
        .expect(409);

      // Cleanup
      await ctx.prisma.user.delete({ where: { id: otherUser.id } });
    });

    it('should return 401 without JWT token', async () => {
      await request(ctx.app.getHttpServer())
        .patch('/api/users/me')
        .send({ username: 'noauth' })
        .expect(401);
    });

    it('should return 400 with invalid gender value', async () => {
      await request(ctx.app.getHttpServer())
        .patch('/api/users/me')
        .set(authHeader(ctx.accessToken))
        .send({ gender: 'OTHER' })
        .expect(400);
    });

    it('should return 400 with username too short', async () => {
      await request(ctx.app.getHttpServer())
        .patch('/api/users/me')
        .set(authHeader(ctx.accessToken))
        .send({ username: 'ab' })
        .expect(400);
    });
  });
});
