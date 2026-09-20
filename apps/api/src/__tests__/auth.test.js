process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.SESSION_SECRET = 'test_session_secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../config/prisma', () => ({
  users: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  studio_users: {
    findMany: jest.fn(),
  },
}));

jest.mock('../config/rabbitmq', () => ({
  publishToQueue: jest.fn(),
}));

const prisma = require('../config/prisma');
const createApp = require('../app');

const app = createApp({ enableRateLimit: false });

const userId = '11111111-1111-1111-1111-111111111111';

function token() {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

describe('auth contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not allow public registration to create super admins', async () => {
    prisma.users.findUnique.mockResolvedValue(null);
    prisma.users.create.mockImplementation(async ({ data }) => ({
      id: userId,
      email: data.email,
      full_name: data.full_name,
      phone: data.phone,
      is_super_admin: data.is_super_admin,
      created_at: new Date(),
    }));

    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: '  NewUser@Example.COM ',
        password: 'strongpass123',
        full_name: 'New User',
        is_super_admin: true,
      });

    expect(response.status).toBe(201);
    expect(prisma.users.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: 'newuser@example.com',
        is_super_admin: false,
      }),
    }));
    expect(response.body.user.is_super_admin).toBe(false);
  });

  it('rejects weak registration passwords', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'new@example.com',
        password: 'short',
        full_name: 'New User',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/at least 8/i);
    expect(prisma.users.create).not.toHaveBeenCalled();
  });

  it('returns active studio memberships from /auth/me', async () => {
    prisma.users.findUnique.mockResolvedValue({
      id: userId,
      email: 'owner@example.com',
      full_name: 'Owner',
      is_super_admin: false,
    });
    prisma.studio_users.findMany.mockResolvedValue([
      {
        role: 'studio_owner',
        studio: {
          id: 'studio-active',
          name: 'Active Studio',
          slug: 'active-studio',
          is_active: true,
        },
      },
      {
        role: 'staff',
        studio: {
          id: 'studio-inactive',
          name: 'Inactive Studio',
          slug: 'inactive-studio',
          is_active: false,
        },
      },
    ]);

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token()}`);

    expect(response.status).toBe(200);
    expect(response.body.studios).toEqual([
      {
        id: 'studio-active',
        name: 'Active Studio',
        slug: 'active-studio',
        role: 'studio_owner',
      },
    ]);
  });
});
