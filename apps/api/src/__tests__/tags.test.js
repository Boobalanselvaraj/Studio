process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.SESSION_SECRET = 'test_session_secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');

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
  tags: {
    findFirst: jest.fn(),
    upsert: jest.fn(),
  },
  events: {
    findFirst: jest.fn(),
  },
  assets: {
    findFirst: jest.fn(),
  },
  event_tags: {
    upsert: jest.fn(),
  },
  asset_tags: {
    upsert: jest.fn(),
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

function token() {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function mockStudioUser() {
  prisma.users.findUnique.mockResolvedValue({
    id: userId,
    email: 'staff@example.com',
    full_name: 'Staff',
    is_super_admin: false,
  });
  prisma.studios.findUnique.mockResolvedValue({
    id: studioId,
    name: 'Lumina Studio',
    slug: 'lumina',
    is_active: true,
  });
  prisma.studio_users.findUnique.mockResolvedValue({ role: 'staff' });
}

function studioRequest(method, url) {
  return request(app)[method](url)
    .set('Authorization', `Bearer ${token()}`)
    .set('x-studio-id', studioId);
}

describe('tag studio isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes tag labels before upsert', async () => {
    mockStudioUser();
    prisma.tags.upsert.mockResolvedValue({
      id: 'tag-1',
      studio_id: studioId,
      label: 'Wedding',
      color: '#6B7280',
    });

    const response = await studioRequest('post', '/api/studio/tags')
      .send({ label: '  Wedding  ' });

    expect(response.status).toBe(201);
    expect(prisma.tags.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        studio_id_label: {
          studio_id: studioId,
          label: 'Wedding',
        },
      },
      create: expect.objectContaining({
        studio_id: studioId,
        label: 'Wedding',
      }),
    }));
  });

  it('rejects event tagging when the tag or event is outside the studio', async () => {
    mockStudioUser();
    prisma.tags.findFirst.mockResolvedValue(null);
    prisma.events.findFirst.mockResolvedValue({ id: 'event-1' });

    const response = await studioRequest('post', '/api/studio/tags/events/event-1')
      .send({ tag_id: 'foreign-tag' });

    expect(response.status).toBe(404);
    expect(response.body.error).toMatch(/Tag or event not found/i);
    expect(prisma.event_tags.upsert).not.toHaveBeenCalled();
  });

  it('rejects asset tagging when the asset is outside the studio', async () => {
    mockStudioUser();
    prisma.tags.findFirst.mockResolvedValue({ id: 'tag-1' });
    prisma.assets.findFirst.mockResolvedValue(null);

    const response = await studioRequest('post', '/api/studio/tags/assets/foreign-asset')
      .send({ tag_id: 'tag-1' });

    expect(response.status).toBe(404);
    expect(response.body.error).toMatch(/Tag or asset not found/i);
    expect(prisma.asset_tags.upsert).not.toHaveBeenCalled();
  });

  it('scopes suggested asset tags to the active studio', async () => {
    mockStudioUser();
    prisma.assets.findFirst.mockResolvedValue({
      id: 'asset-1',
      asset_tags: [
        { tag: { id: 'tag-1', label: 'Bride' } },
      ],
    });

    const response = await studioRequest('get', '/api/studio/tags/assets/asset-1/suggested-tags');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 'tag-1', label: 'Bride' }]);
    expect(prisma.assets.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'asset-1',
        studio_id: studioId,
      },
      include: {
        asset_tags: {
          where: { source: 'suggested' },
          include: { tag: true },
        },
      },
    });
  });
});
