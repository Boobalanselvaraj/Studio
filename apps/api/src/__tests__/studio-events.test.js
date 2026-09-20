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
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  studio_users: {
    findUnique: jest.fn(),
  },
  events: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  event_status_history: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  event_task_templates: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
}));

jest.mock('../config/rabbitmq', () => ({
  publishToQueue: jest.fn(),
}));

const prisma = require('../config/prisma');
const { publishToQueue } = require('../config/rabbitmq');
const createApp = require('../app');

const app = createApp({ enableRateLimit: false });

function authToken(userId = '11111111-1111-1111-1111-111111111111') {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function mockAuthenticatedStudioUser(role = 'studio_owner') {
  prisma.users.findUnique.mockResolvedValue({
    id: '11111111-1111-1111-1111-111111111111',
    email: 'owner@example.com',
    full_name: 'Studio Owner',
    is_super_admin: false,
  });
  prisma.studios.findUnique.mockResolvedValue({
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Lumina Studio',
    slug: 'lumina',
    is_active: true,
  });
  prisma.studio_users.findUnique.mockResolvedValue({ role });
}

describe('studio API auth, tenancy, and event workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects studio routes when the request is not authenticated', async () => {
    const response = await request(app)
      .get('/api/studio/events')
      .set('x-studio-id', '22222222-2222-2222-2222-222222222222');

    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/Authentication required/i);
  });

  it('rejects authenticated users who do not belong to the selected studio', async () => {
    prisma.users.findUnique.mockResolvedValue({
      id: '11111111-1111-1111-1111-111111111111',
      email: 'outsider@example.com',
      full_name: 'Outsider',
      is_super_admin: false,
    });
    prisma.studios.findUnique.mockResolvedValue({
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Lumina Studio',
      slug: 'lumina',
      is_active: true,
    });
    prisma.studio_users.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .get('/api/studio/events')
      .set('Authorization', `Bearer ${authToken()}`)
      .set('x-studio-id', '22222222-2222-2222-2222-222222222222');

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/do not have access/i);
  });

  it('routes task-template requests before dynamic event-id routes', async () => {
    mockAuthenticatedStudioUser('studio_manager');
    prisma.event_task_templates.findMany.mockResolvedValue([
      {
        id: '33333333-3333-3333-3333-333333333333',
        studio_id: '22222222-2222-2222-2222-222222222222',
        event_type: 'wedding',
        title: 'Backup SD cards',
        sort_order: 1,
      },
    ]);

    const response = await request(app)
      .get('/api/studio/events/task-templates?event_type=wedding')
      .set('Authorization', `Bearer ${authToken()}`)
      .set('x-studio-id', '22222222-2222-2222-2222-222222222222');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(prisma.event_task_templates.findMany).toHaveBeenCalledWith({
      where: {
        studio_id: '22222222-2222-2222-2222-222222222222',
        event_type: 'wedding',
      },
      orderBy: { sort_order: 'asc' },
    });
    expect(prisma.events.findFirst).not.toHaveBeenCalled();
  });

  it('updates event status only through a valid transition and records history', async () => {
    mockAuthenticatedStudioUser('photographer');
    prisma.events.findFirst.mockResolvedValue({
      id: '44444444-4444-4444-4444-444444444444',
      studio_id: '22222222-2222-2222-2222-222222222222',
      status: 'scheduled',
    });

    const updatedEvent = {
      id: '44444444-4444-4444-4444-444444444444',
      status: 'shooting',
    };
    prisma.$transaction.mockImplementation(async (callback) => callback({
      events: {
        update: jest.fn().mockResolvedValue(updatedEvent),
      },
      event_status_history: {
        create: jest.fn().mockResolvedValue({ id: '55555555-5555-5555-5555-555555555555' }),
      },
    }));

    const response = await request(app)
      .post('/api/studio/events/44444444-4444-4444-4444-444444444444/status')
      .set('Authorization', `Bearer ${authToken()}`)
      .set('x-studio-id', '22222222-2222-2222-2222-222222222222')
      .send({ to_status: 'shooting', note: 'First upload arrived' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('shooting');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(publishToQueue).toHaveBeenCalledWith('event-automation', {
      action: 'status_changed',
      studioId: '22222222-2222-2222-2222-222222222222',
      eventId: '44444444-4444-4444-4444-444444444444',
      fromStatus: 'scheduled',
      toStatus: 'shooting',
      userId: '11111111-1111-1111-1111-111111111111',
    });
  });

  it('rejects invalid event status transitions', async () => {
    mockAuthenticatedStudioUser('studio_owner');
    prisma.events.findFirst.mockResolvedValue({
      id: '44444444-4444-4444-4444-444444444444',
      studio_id: '22222222-2222-2222-2222-222222222222',
      status: 'lead',
    });

    const response = await request(app)
      .post('/api/studio/events/44444444-4444-4444-4444-444444444444/status')
      .set('Authorization', `Bearer ${authToken()}`)
      .set('x-studio-id', '22222222-2222-2222-2222-222222222222')
      .send({ to_status: 'delivered' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Invalid status transition/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(publishToQueue).not.toHaveBeenCalled();
  });
});
