process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.SESSION_SECRET = 'test_session_secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.setTimeout(20000);

jest.mock('../config/prisma', () => ({
  users: {
    findUnique: jest.fn(),
  },
  studios: {
    findUnique: jest.fn(),
  },
  studio_users: {
    findUnique: jest.fn(),
  },
  albums: {
    findFirst: jest.fn(),
  },
  album_assets: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  album_customers: {
    findFirst: jest.fn(),
  },
  storage_providers: {
    findFirst: jest.fn(),
  },
}));

jest.mock('../config/rabbitmq', () => ({
  publishToQueue: jest.fn(),
}));

const prisma = require('../config/prisma');
const createApp = require('../app');

const app = createApp({ enableRateLimit: false });

const userId = '11111111-1111-1111-1111-111111111111';
const studioId = '22222222-2222-2222-2222-222222222222';
const albumId = '33333333-3333-3333-3333-333333333333';

function authToken() {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function mockStudioUser(role = 'studio_owner') {
  prisma.users.findUnique.mockResolvedValue({
    id: userId,
    email: 'owner@example.com',
    full_name: 'Studio Owner',
    is_super_admin: false,
  });
  prisma.studios.findUnique.mockResolvedValue({
    id: studioId,
    name: 'Test Studio',
    slug: 'test-studio',
    is_active: true,
  });
  prisma.studio_users.findUnique.mockResolvedValue({
    role,
  });
}

describe('Album Export & Favorites Download Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Studio Album Export (/api/studio/albums/:id/download)', () => {
    it('downloads full album zip for studio', async () => {
      mockStudioUser();
      prisma.albums.findFirst.mockResolvedValue({
        id: albumId,
        title: 'Wedding Shoot',
        studio_id: studioId,
        album_assets: [
          {
            id: 'aa-1',
            is_favorite: false,
            asset: { id: 'asset-1', filename: 'photo1.jpg', is_soft_deleted: false },
          },
          {
            id: 'aa-2',
            is_favorite: true,
            asset: { id: 'asset-2', filename: 'photo2.jpg', is_soft_deleted: false },
          },
        ],
      });

      const res = await request(app)
        .get(`/api/studio/albums/${albumId}/download`)
        .set('Authorization', `Bearer ${authToken()}`)
        .set('x-studio-id', studioId);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/zip');
      expect(res.headers['content-disposition']).toContain('Wedding_Shoot_full.zip');
    });

    it('downloads favorites-only zip for studio', async () => {
      mockStudioUser();
      prisma.albums.findFirst.mockResolvedValue({
        id: albumId,
        title: 'Wedding Shoot',
        studio_id: studioId,
        album_assets: [
          {
            id: 'aa-2',
            is_favorite: true,
            asset: { id: 'asset-2', filename: 'photo2.jpg', is_soft_deleted: false },
          },
        ],
      });

      const res = await request(app)
        .get(`/api/studio/albums/${albumId}/download?favorites=true`)
        .set('Authorization', `Bearer ${authToken()}`)
        .set('x-studio-id', studioId);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/zip');
      expect(res.headers['content-disposition']).toContain('Wedding_Shoot_favorites.zip');
    });

    it('returns 400 when favorites=true and album has no favorites', async () => {
      mockStudioUser();
      prisma.albums.findFirst.mockResolvedValue({
        id: albumId,
        title: 'Wedding Shoot',
        studio_id: studioId,
        album_assets: [],
      });

      const res = await request(app)
        .get(`/api/studio/albums/${albumId}/download?favorites=true`)
        .set('Authorization', `Bearer ${authToken()}`)
        .set('x-studio-id', studioId);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/No client favorite photos/i);
    });
  });

  describe('Customer Album Download (/api/customer/albums/:albumId/download)', () => {
    it('downloads full album zip for customer', async () => {
      prisma.users.findUnique.mockResolvedValue({
        id: userId,
        email: 'client@example.com',
        full_name: 'Client User',
      });
      prisma.albums.findFirst.mockResolvedValue({
        id: albumId,
        title: 'Portrait Session',
        studio_id: studioId,
        album_assets: [
          {
            id: 'aa-1',
            is_favorite: false,
            asset: { id: 'asset-1', filename: 'portrait1.jpg', is_soft_deleted: false },
          },
        ],
      });

      const res = await request(app)
        .get(`/api/customer/albums/${albumId}/download`)
        .set('Authorization', `Bearer ${authToken()}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/zip');
      expect(res.headers['content-disposition']).toContain('Portrait_Session_photos.zip');
    });

    it('downloads favorites-only zip for customer', async () => {
      prisma.users.findUnique.mockResolvedValue({
        id: userId,
        email: 'client@example.com',
        full_name: 'Client User',
      });
      prisma.albums.findFirst.mockResolvedValue({
        id: albumId,
        title: 'Portrait Session',
        studio_id: studioId,
        album_assets: [
          {
            id: 'aa-1',
            is_favorite: true,
            asset: { id: 'asset-1', filename: 'portrait1.jpg', is_soft_deleted: false },
          },
        ],
      });

      const res = await request(app)
        .get(`/api/customer/albums/${albumId}/download?favorites=true`)
        .set('Authorization', `Bearer ${authToken()}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/zip');
      expect(res.headers['content-disposition']).toContain('Portrait_Session_favorites.zip');
    });

    it('returns 400 when favorites=true and customer has no favorites in album', async () => {
      prisma.users.findUnique.mockResolvedValue({
        id: userId,
        email: 'client@example.com',
        full_name: 'Client User',
      });
      prisma.albums.findFirst.mockResolvedValue({
        id: albumId,
        title: 'Portrait Session',
        studio_id: studioId,
        album_assets: [],
      });

      const res = await request(app)
        .get(`/api/customer/albums/${albumId}/download?favorites=true`)
        .set('Authorization', `Bearer ${authToken()}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/No favorite photos/i);
    });
  });
});
