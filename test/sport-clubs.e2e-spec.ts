import request from 'supertest';
import {
  setupTestApp,
  cleanupTestApp,
  authHeader,
  type TestContext,
} from './helpers/test-setup.js';

describe('SportClubs (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupTestApp();
  }, 30000);

  afterAll(async () => {
    await cleanupTestApp(ctx.prisma, ctx.testUser.id);
    await ctx.app.close();
  });

  describe('POST /api/sport-clubs', () => {
    it('should create a new club with valid data', async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/sport-clubs')
        .set(authHeader(ctx.accessToken))
        .send({ name: 'E2E Test Club' })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('E2E Test Club');
      expect(res.body.ownerId).toBe(ctx.testUser.id);
    });

    it('should return 401 without JWT token', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/sport-clubs')
        .send({ name: 'No Auth Club' })
        .expect(401);
    });

    it('should return 400 with empty body', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/sport-clubs')
        .set(authHeader(ctx.accessToken))
        .send({})
        .expect(400);
    });

    it('should return 400 with name too long', async () => {
      await request(ctx.app.getHttpServer())
        .post('/api/sport-clubs')
        .set(authHeader(ctx.accessToken))
        .send({ name: 'a'.repeat(101) })
        .expect(400);
    });
  });

  describe('GET /api/sport-clubs', () => {
    beforeAll(async () => {
      // Create a club via API
      await request(ctx.app.getHttpServer())
        .post('/api/sport-clubs')
        .set(authHeader(ctx.accessToken))
        .send({ name: 'List Test Club' });
    });

    it('should return user clubs', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/api/sport-clubs')
        .set(authHeader(ctx.accessToken))
        .expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.meta).toHaveProperty('page');
      expect(res.body.meta).toHaveProperty('limit');
      expect(res.body.meta).toHaveProperty('total');
    });

    it('should return 401 without JWT token', async () => {
      await request(ctx.app.getHttpServer())
        .get('/api/sport-clubs')
        .expect(401);
    });

    it('should support pagination with page and limit', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get('/api/sport-clubs?page=1&limit=1')
        .set(authHeader(ctx.accessToken))
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(1);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.limit).toBe(1);
    });
  });

  describe('GET /api/sport-clubs/:id', () => {
    let testClubId: number;

    beforeAll(async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/sport-clubs')
        .set(authHeader(ctx.accessToken))
        .send({ name: 'Get Test Club' });
      testClubId = res.body.id;
    });

    it('should return club by ID with counts', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get(`/api/sport-clubs/${testClubId}`)
        .set(authHeader(ctx.accessToken))
        .expect(200);

      expect(res.body.id).toBe(testClubId);
      expect(res.body.name).toBe('Get Test Club');
      expect(res.body).toHaveProperty('_count');
      expect(res.body._count).toHaveProperty('members');
      expect(res.body._count).toHaveProperty('sessions');
      expect(res.body._count).toHaveProperty('courts');
    });

    it('should return 404 when club not found', async () => {
      await request(ctx.app.getHttpServer())
        .get('/api/sport-clubs/99999')
        .set(authHeader(ctx.accessToken))
        .expect(404);
    });

    it('should return 401 without JWT token', async () => {
      await request(ctx.app.getHttpServer())
        .get(`/api/sport-clubs/${testClubId}`)
        .expect(401);
    });
  });

  describe('PATCH /api/sport-clubs/:id', () => {
    let testClubId: number;
    let otherUserClubId: number;

    beforeAll(async () => {
      // Create club owned by test user via API
      const clubRes = await request(ctx.app.getHttpServer())
        .post('/api/sport-clubs')
        .set(authHeader(ctx.accessToken))
        .send({ name: 'Update Test Club' });
      testClubId = clubRes.body.id;

      // Create another user and their club directly in DB
      const otherUser = await ctx.prisma.user.create({
        data: {
          name: 'Other Owner',
          email: `other-owner-${Date.now()}@example.com`,
          gender: 'FEMALE',
        },
      });
      const otherClub = await ctx.prisma.sportClub.create({
        data: { name: 'Other Club', ownerId: otherUser.id },
      });
      otherUserClubId = otherClub.id;
    });

    it('should update club name when owner', async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch(`/api/sport-clubs/${testClubId}`)
        .set(authHeader(ctx.accessToken))
        .send({ name: 'Updated Club Name' })
        .expect(200);

      expect(res.body.name).toBe('Updated Club Name');
    });

    it('should return 403 when not owner', async () => {
      await request(ctx.app.getHttpServer())
        .patch(`/api/sport-clubs/${otherUserClubId}`)
        .set(authHeader(ctx.accessToken))
        .send({ name: 'Hacked Name' })
        .expect(403);
    });

    it('should return 404 when club not found', async () => {
      await request(ctx.app.getHttpServer())
        .patch('/api/sport-clubs/99999')
        .set(authHeader(ctx.accessToken))
        .send({ name: 'New Name' })
        .expect(404);
    });

    it('should return 401 without JWT token', async () => {
      await request(ctx.app.getHttpServer())
        .patch(`/api/sport-clubs/${testClubId}`)
        .send({ name: 'No Auth' })
        .expect(401);
    });

    it('should return 400 with name too long', async () => {
      await request(ctx.app.getHttpServer())
        .patch(`/api/sport-clubs/${testClubId}`)
        .set(authHeader(ctx.accessToken))
        .send({ name: 'a'.repeat(101) })
        .expect(400);
    });
  });

  describe('DELETE /api/sport-clubs/:id', () => {
    let testClubId: number;
    let otherUserClubId: number;

    beforeAll(async () => {
      // Create club owned by test user via API
      const clubRes = await request(ctx.app.getHttpServer())
        .post('/api/sport-clubs')
        .set(authHeader(ctx.accessToken))
        .send({ name: 'Delete Test Club' });
      testClubId = clubRes.body.id;

      // Create another user and their club directly in DB
      const otherUser = await ctx.prisma.user.create({
        data: {
          name: 'Delete Other Owner',
          email: `delete-other-${Date.now()}@example.com`,
          gender: 'MALE',
        },
      });
      const otherClub = await ctx.prisma.sportClub.create({
        data: { name: 'Delete Other Club', ownerId: otherUser.id },
      });
      otherUserClubId = otherClub.id;
    });

    it('should delete club and return success message when owner', async () => {
      const res = await request(ctx.app.getHttpServer())
        .delete(`/api/sport-clubs/${testClubId}`)
        .set(authHeader(ctx.accessToken))
        .expect(200);

      expect(res.body.message).toBe('Club deleted successfully');
    });

    it('should return 403 when not owner', async () => {
      await request(ctx.app.getHttpServer())
        .delete(`/api/sport-clubs/${otherUserClubId}`)
        .set(authHeader(ctx.accessToken))
        .expect(403);
    });

    it('should return 404 when club not found', async () => {
      await request(ctx.app.getHttpServer())
        .delete('/api/sport-clubs/99999')
        .set(authHeader(ctx.accessToken))
        .expect(404);
    });

    it('should return 401 without JWT token', async () => {
      await request(ctx.app.getHttpServer())
        .delete(`/api/sport-clubs/${otherUserClubId}`)
        .expect(401);
    });
  });
});
