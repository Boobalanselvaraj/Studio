process.env.NODE_ENV = 'test';

jest.mock('../config/prisma', () => ({
  events: {
    findFirst: jest.fn(),
  },
  event_tasks: {
    count: jest.fn(),
    createMany: jest.fn(),
  },
  event_task_templates: {
    findMany: jest.fn(),
  },
  audit_logs: {
    create: jest.fn(),
  },
  storage_providers: {
    findMany: jest.fn(),
  },
  assets: {
    aggregate: jest.fn(),
  },
  storage_usage_snapshots: {
    upsert: jest.fn(),
  },
}));

jest.mock('../config/rabbitmq', () => ({
  connectRabbitMQ: jest.fn(),
  publishToQueue: jest.fn(),
}));

const prisma = require('../config/prisma');
const { publishToQueue } = require('../config/rabbitmq');
const { handleEventAutomationMessage } = require('../queues/eventAutomationWorker');
const { handleNotificationMessage } = require('../queues/notificationWorker');
const { handleBillingMeteringMessage } = require('../queues/billingMeteringWorker');

const studioId = '22222222-2222-2222-2222-222222222222';

describe('queue worker handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('seeds event tasks from templates on event creation', async () => {
    prisma.events.findFirst.mockResolvedValue({ id: 'event-1', event_type: 'wedding' });
    prisma.event_tasks.count.mockResolvedValue(0);
    prisma.event_task_templates.findMany.mockResolvedValue([
      { title: 'Backup cards', sort_order: 1 },
      { title: 'Cull previews', sort_order: 2 },
    ]);
    prisma.event_tasks.createMany.mockResolvedValue({ count: 2 });

    const result = await handleEventAutomationMessage({
      action: 'event_created',
      studioId,
      eventId: 'event-1',
    });

    expect(result).toEqual({ status: 'tasks_seeded', created: 2 });
    expect(prisma.event_tasks.createMany).toHaveBeenCalledWith({
      data: [
        { event_id: 'event-1', title: 'Backup cards' },
        { event_id: 'event-1', title: 'Cull previews' },
      ],
    });
  });

  it('queues notifications for event status changes', async () => {
    const result = await handleEventAutomationMessage({
      action: 'status_changed',
      studioId,
      eventId: 'event-1',
      fromStatus: 'scheduled',
      toStatus: 'shooting',
      userId: 'user-1',
    });

    expect(result).toEqual({ status: 'notification_queued' });
    expect(publishToQueue).toHaveBeenCalledWith('notifications', {
      action: 'event_status_changed',
      studioId,
      eventId: 'event-1',
      fromStatus: 'scheduled',
      toStatus: 'shooting',
      userId: 'user-1',
    });
  });

  it('records notification attempts as audit logs', async () => {
    prisma.audit_logs.create.mockResolvedValue({ id: 'audit-1' });

    const result = await handleNotificationMessage({
      action: 'event_status_changed',
      studioId,
      eventId: 'event-1',
      userId: 'user-1',
      toStatus: 'review',
    });

    expect(result).toEqual({ status: 'recorded' });
    expect(prisma.audit_logs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studio_id: studioId,
        user_id: 'user-1',
        action: 'event_status_changed',
        resource_type: 'notification',
        resource_id: 'event-1',
      }),
    });
  });

  it('writes daily platform storage usage snapshots', async () => {
    prisma.storage_providers.findMany.mockResolvedValue([{ id: 'storage-1' }]);
    prisma.assets.aggregate.mockResolvedValue({ _sum: { file_size_bytes: BigInt(4096) } });
    prisma.storage_usage_snapshots.upsert.mockResolvedValue({ id: 'snapshot-1' });

    const result = await handleBillingMeteringMessage({
      action: 'daily_storage_snapshot',
      studioId,
      snapshotDate: '2026-09-20T12:00:00.000Z',
    });

    expect(result).toEqual({ status: 'snapshots_recorded', snapshotsCreated: 1 });
    expect(prisma.storage_providers.findMany).toHaveBeenCalledWith({
      where: {
        studio_id: studioId,
        provider_type: 'platform',
      },
      select: { id: true },
    });
    expect(prisma.storage_usage_snapshots.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        studio_id: studioId,
        storage_provider_id: 'storage-1',
        bytes_used: BigInt(4096),
      }),
    }));
  });
});
