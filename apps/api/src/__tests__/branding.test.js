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
  studio_branding: {
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

function mockStudioOwner() {
  prisma.users.findUnique.mockResolvedValue({
    id: userId,
    email: 'owner@example.com',
    full_name: 'Owner',
    is_super_admin: false,
  });
  prisma.studios.findUnique.mockResolvedValue({
    id: studioId,
    name: 'Lumina Studio',
    slug: 'lumina',
    is_active: true,
  });
  prisma.studio_users.findUnique.mockResolvedValue({ role: 'studio_owner' });
}

describe('branding validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects invalid brand colors', async () => {
    mockStudioOwner();

    const response = await request(app)
      .put('/api/studio/branding')
      .set('Authorization', `Bearer ${token()}`)
      .set('x-studio-id', studioId)
      .send({ brand_name: 'Lumina', primary_color: 'blue' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/primary_color/i);
    expect(prisma.studio_branding.upsert).not.toHaveBeenCalled();
  });

  it('trims brand names before saving', async () => {
    mockStudioOwner();
    prisma.studio_branding.upsert.mockResolvedValue({
      id: 'branding-1',
      studio_id: studioId,
      brand_name: 'Lumina',
      primary_color: '#2563EB',
    });

    const response = await request(app)
      .put('/api/studio/branding')
      .set('Authorization', `Bearer ${token()}`)
      .set('x-studio-id', studioId)
      .send({ brand_name: '  Lumina  ', primary_color: '#2563EB' });

    expect(response.status).toBe(200);
    expect(prisma.studio_branding.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ brand_name: 'Lumina' }),
      update: expect.objectContaining({ brand_name: 'Lumina' }),
    }));
  });
});
