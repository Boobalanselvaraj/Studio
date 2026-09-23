const { connectRabbitMQ } = require('../config/rabbitmq');
const prisma = require('../config/prisma');
const emailService = require('../services/emailService');

async function handleNotificationMessage(payload) {
  if (!payload.action) {
    throw new Error('Notification payload requires action');
  }

  await prisma.audit_logs.create({
    data: {
      studio_id: payload.studioId || null,
      user_id: payload.userId || null,
      action: payload.action,
      resource_type: 'notification',
      resource_id: payload.eventId || payload.albumId || null,
      details: payload,
    },
  });

  if (payload.action === 'gallery_shared' && payload.customerEmail) {
    await emailService.sendGalleryShareEmail(payload).catch((err) => {
      console.warn('[Notification Worker] Email share dispatch note:', err.message);
    });
  } else if (payload.action === 'status_changed' && payload.customerEmail) {
    await emailService.sendShootStatusEmail(payload).catch((err) => {
      console.warn('[Notification Worker] Email status dispatch note:', err.message);
    });
  }

  return { status: 'recorded' };
}

async function startNotificationWorker() {
  const { channel } = await connectRabbitMQ();
  if (!channel) return;

  const queue = 'notifications';
  console.log(`[Worker] Started Notification consumer on queue '${queue}'`);

  channel.consume(queue, async (msg) => {
    if (msg !== null) {
      try {
        const payload = JSON.parse(msg.content.toString());
        console.log('[Notification Worker] Processing notification payload:', payload);

        await handleNotificationMessage(payload);
        
        channel.ack(msg);
      } catch (err) {
        console.error('[Notification Worker] Error handling message:', err);
        channel.nack(msg, false, false); // Route to dead-letter
      }
    }
  });
}

module.exports = {
  handleNotificationMessage,
  startNotificationWorker,
};
