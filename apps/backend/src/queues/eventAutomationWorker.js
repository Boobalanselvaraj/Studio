const { connectRabbitMQ } = require('../config/rabbitmq');
const prisma = require('../config/prisma');
const { publishToQueue } = require('../config/rabbitmq');

async function handleEventAutomationMessage(payload) {
  if (payload.action === 'event_created') {
    return seedTasksFromTemplates(payload);
  }

  if (payload.action === 'status_changed') {
    await publishToQueue('notifications', {
      action: 'event_status_changed',
      studioId: payload.studioId,
      eventId: payload.eventId,
      fromStatus: payload.fromStatus,
      toStatus: payload.toStatus,
      userId: payload.userId,
    });
    return { status: 'notification_queued' };
  }

  return { status: 'ignored', action: payload.action };
}

async function seedTasksFromTemplates(payload) {
  if (!payload.studioId || !payload.eventId) {
    throw new Error('event_created requires studioId and eventId');
  }

  const event = await prisma.events.findFirst({
    where: {
      id: payload.eventId,
      studio_id: payload.studioId,
    },
    select: {
      id: true,
      event_type: true,
    },
  });

  if (!event) {
    throw new Error('Event not found for studio');
  }

  const existingTaskCount = await prisma.event_tasks.count({
    where: { event_id: event.id },
  });

  if (existingTaskCount > 0) {
    return { status: 'skipped_existing_tasks', created: 0 };
  }

  const templates = await prisma.event_task_templates.findMany({
    where: {
      studio_id: payload.studioId,
      event_type: event.event_type,
    },
    orderBy: { sort_order: 'asc' },
  });

  if (templates.length === 0) {
    return { status: 'no_templates', created: 0 };
  }

  await prisma.event_tasks.createMany({
    data: templates.map((template) => ({
      event_id: event.id,
      title: template.title,
    })),
  });

  return { status: 'tasks_seeded', created: templates.length };
}

async function startEventAutomationWorker() {
  const { channel } = await connectRabbitMQ();
  if (!channel) return;

  const queue = 'event-automation';
  console.log(`[Worker] Started Event Automation consumer on queue '${queue}'`);

  channel.consume(queue, async (msg) => {
    if (msg !== null) {
      try {
        const payload = JSON.parse(msg.content.toString());
        console.log('[Event Automation Worker] Processing workflow automation event:', payload);

        await handleEventAutomationMessage(payload);
        
        channel.ack(msg);
      } catch (err) {
        console.error('[Event Automation Worker] Error handling message:', err);
        channel.nack(msg, false, false);
      }
    }
  });
}

module.exports = {
  handleEventAutomationMessage,
  startEventAutomationWorker,
};
