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
  studio_billing_profile: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  storage_usage_snapshots: {
    aggregate: jest.fn(),
  },
  billing_plans: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
}));

jest.mock('../config/rabbitmq', () => ({
  publishToQueue: jest.fn(),
}));

const prisma = require('../config/prisma');
const createApp = require('../app');

const app = createApp({ enableRateLimit: false });

const superAdminId = '11111111-1111-1111-1111-111111111111';
const studioUserId = '22222222-2222-2222-2222-222222222222';
const studioId = '33333333-3333-3333-3333-333333333333';

function token(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function mockSuperAdmin() {
  prisma.users.findUnique.mockResolvedValue({
    id: superAdminId,
    email: 'admin@example.com',
    full_name: 'Admin',
    is_super_admin: true,
  });
}

function mockStudioUser() {
  prisma.users.findUnique.mockResolvedValue({
    id: studioUserId,
    email: 'owner@example.com',
    full_name: 'Owner',
    is_super_admin: false,
  });
  prisma.studios.findUnique.mockResolvedValue({
    id: studioId,
    name: 'Lumina',
    slug: 'lumina',
    is_active: true,
  });
  prisma.studio_users.findUnique.mockResolvedValue({ role: 'studio_owner' });
}

describe('admin and billing contracts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects invalid studio slugs before creating admin studios', async () => {
    mockSuperAdmin();

    const response = await request(app)
      .post('/api/admin/studios')
      .set('Authorization', `Bearer ${token(superAdminId)}`)
      .send({ name: 'Bad Studio', slug: 'Bad Studio!' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/lowercase letters/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('normalizes studio slugs and validates positive quota on create', async () => {
    mockSuperAdmin();
    prisma.studios.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(async (callback) => callback({
      studios: {
        create: jest.fn().mockResolvedValue({
          id: studioId,
          name: 'Lumina Studio',
          slug: 'lumina-studio',
        }),
      },
      studio_branding: {
        create: jest.fn().mockResolvedValue({ id: 'branding-1' }),
      },
      studio_billing_profile: {
        create: jest.fn().mockResolvedValue({ id: 'billing-1' }),
      },
    }));

    const response = await request(app)
      .post('/api/admin/studios')
      .set('Authorization', `Bearer ${token(superAdminId)}`)
      .send({ name: 'Lumina Studio', slug: '  lumina-studio  ', storage_quota_gb: 100 });

    expect(response.status).toBe(201);
    expect(prisma.studios.findUnique).toHaveBeenCalledWith({ where: { slug: 'lumina-studio' } });
  });

  it('does not update billing for a missing studio', async () => {
    mockSuperAdmin();
    prisma.studios.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .patch('/api/admin/studios/missing-studio/billing-profile')
      .set('Authorization', `Bearer ${token(superAdminId)}`)
      .send({ storage_quota_gb: 100 });

    expect(response.status).toBe(404);
    expect(response.body.error).toMatch(/Studio not found/i);
    expect(prisma.studio_billing_profile.upsert).not.toHaveBeenCalled();
  });

  it('meters only platform-hosted storage in usage responses', async () => {
    mockStudioUser();
    prisma.studio_billing_profile.findUnique.mockResolvedValue({
      studio_id: studioId,
      storage_quota_gb: 10,
      billing_status: 'active',
      billing_plan: { name: 'Starter' },
    });
    prisma.storage_usage_snapshots.aggregate.mockResolvedValue({
      _sum: { bytes_used: 5 * 1024 * 1024 * 1024 },
    });

    const response = await request(app)
      .get('/api/studio/billing/usage')
      .set('Authorization', `Bearer ${token(studioUserId)}`)
      .set('x-studio-id', studioId);

    expect(response.status).toBe(200);
    expect(response.body.percentUsed).toBe(50);
    expect(prisma.storage_usage_snapshots.aggregate).toHaveBeenCalledWith({
      where: {
        studio_id: studioId,
        snapshot_date: { gte: expect.any(Date) },
        storage_provider: {
          provider_type: 'platform',
        },
      },
      _sum: { bytes_used: true },
    });
  });

  it('retires quota requests in favor of support tickets', async () => {
    mockStudioUser();

    const response = await request(app)
      .post('/api/studio/billing/request-upgrade')
      .set('Authorization', `Bearer ${token(studioUserId)}`)
      .set('x-studio-id', studioId)
      .send({ requested_quota_gb: -1 });

    expect(response.status).toBe(410);
    expect(response.body.error).toMatch(/support tickets/i);
  });
});
