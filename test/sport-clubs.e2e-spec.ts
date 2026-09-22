import request from 'supertest';
import { randomUUID } from 'node:crypto';
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

      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('slug');
      expect(res.body.data.name).toBe('E2E Test Club');
      expect(res.body.data.ownerId).toBe(ctx.testUser.id);
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

  describe('GET /api/sport-clubs/:slug', () => {
    let testClubId: string;
    let testClubSlug: string;

    beforeAll(async () => {
      const res = await request(ctx.app.getHttpServer())
        .post('/api/sport-clubs')
        .set(authHeader(ctx.accessToken))
        .send({ name: 'Get Test Club' });
      testClubId = res.body.data.id;
      testClubSlug = res.body.data.slug;
    });

    it('should return club by slug with counts', async () => {
      const res = await request(ctx.app.getHttpServer())
        .get(`/api/sport-clubs/${testClubSlug}`)
        .set(authHeader(ctx.accessToken))
        .expect(200);

      expect(res.body.data.id).toBe(testClubId);
      expect(res.body.data.name).toBe('Get Test Club');
      expect(res.body.data).toHaveProperty('_count');
      expect(res.body.data._count).toHaveProperty('members');
      expect(res.body.data._count).toHaveProperty('sessions');
      expect(res.body.data._count).toHaveProperty('courts');
    });

    it('should return 404 when club not found', async () => {
      await request(ctx.app.getHttpServer())
        .get('/api/sport-clubs/nonexistent-club')
        .set(authHeader(ctx.accessToken))
        .expect(404);
    });

    it('should return 401 without JWT token', async () => {
      await request(ctx.app.getHttpServer())
        .get(`/api/sport-clubs/${testClubSlug}`)
        .expect(401);
    });
  });

  describe('PATCH /api/sport-clubs/:slug', () => {
    let testClubSlug: string;
    let otherUserClubSlug: string;

    beforeAll(async () => {
      // Create club owned by test user via API
      const clubRes = await request(ctx.app.getHttpServer())
        .post('/api/sport-clubs')
        .set(authHeader(ctx.accessToken))
        .send({ name: 'Update Test Club' });
      testClubSlug = clubRes.body.data.slug;

      // Create another user and their club directly in DB
      const otherUser = await ctx.prisma.user.create({
        data: {
          name: 'Other Owner',
          email: `other-owner-${Date.now()}@example.com`,
          gender: 'FEMALE',
        },
      });
      const otherClub = await ctx.prisma.sportClub.create({
        data: {
          name: 'Other Club',
          slug: `other-club-${randomUUID()}`,
          ownerId: otherUser.id,
        },
      });
      otherUserClubSlug = otherClub.slug;
    });

    it('should update club name when owner', async () => {
      const res = await request(ctx.app.getHttpServer())
        .patch(`/api/sport-clubs/${testClubSlug}`)
        .set(authHeader(ctx.accessToken))
        .send({ name: 'Updated Club Name' })
        .expect(200);

      expect(res.body.data.name).toBe('Updated Club Name');
    });

    it('should return 403 when not owner', async () => {
      await request(ctx.app.getHttpServer())
        .patch(`/api/sport-clubs/${otherUserClubSlug}`)
        .set(authHeader(ctx.accessToken))
        .send({ name: 'Hacked Name' })
        .expect(403);
    });

    it('should return 404 when club not found', async () => {
      await request(ctx.app.getHttpServer())
        .patch('/api/sport-clubs/nonexistent-club')
        .set(authHeader(ctx.accessToken))
        .send({ name: 'New Name' })
        .expect(404);
    });

    it('should return 401 without JWT token', async () => {
      await request(ctx.app.getHttpServer())
        .patch(`/api/sport-clubs/${testClubSlug}`)
        .send({ name: 'No Auth' })
        .expect(401);
    });

    it('should return 400 with name too long', async () => {
      await request(ctx.app.getHttpServer())
        .patch(`/api/sport-clubs/${testClubSlug}`)
        .set(authHeader(ctx.accessToken))
        .send({ name: 'a'.repeat(101) })
        .expect(400);
    });
  });

  describe('DELETE /api/sport-clubs/:slug', () => {
    let testClubSlug: string;
    let otherUserClubSlug: string;

    beforeAll(async () => {
      // Create club owned by test user via API
      const clubRes = await request(ctx.app.getHttpServer())
        .post('/api/sport-clubs')
        .set(authHeader(ctx.accessToken))
        .send({ name: 'Delete Test Club' });
      testClubSlug = clubRes.body.data.slug;

      // Create another user and their club directly in DB
      const otherUser = await ctx.prisma.user.create({
        data: {
          name: 'Delete Other Owner',
          email: `delete-other-${Date.now()}@example.com`,
          gender: 'MALE',
        },
      });
      const otherClub = await ctx.prisma.sportClub.create({
        data: {
          name: 'Delete Other Club',
          slug: `delete-other-club-${randomUUID()}`,
          ownerId: otherUser.id,
        },
      });
      otherUserClubSlug = otherClub.slug;
    });

    it('should delete club and return success message when owner', async () => {
      const res = await request(ctx.app.getHttpServer())
        .delete(`/api/sport-clubs/${testClubSlug}`)
        .set(authHeader(ctx.accessToken))
        .expect(200);

      expect(res.body.message).toBe('Club deleted successfully');
    });

    it('should return 403 when not owner', async () => {
      await request(ctx.app.getHttpServer())
        .delete(`/api/sport-clubs/${otherUserClubSlug}`)
        .set(authHeader(ctx.accessToken))
        .expect(403);
    });

    it('should return 404 when club not found', async () => {
      await request(ctx.app.getHttpServer())
        .delete('/api/sport-clubs/nonexistent-club')
        .set(authHeader(ctx.accessToken))
        .expect(404);
    });

    it('should return 401 without JWT token', async () => {
      await request(ctx.app.getHttpServer())
        .delete(`/api/sport-clubs/${otherUserClubSlug}`)
        .expect(401);
    });
  });
});
