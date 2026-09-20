const { connectRabbitMQ } = require('../config/rabbitmq');

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

        // Send Email / SMS logic stub
        
        channel.ack(msg);
      } catch (err) {
        console.error('[Notification Worker] Error handling message:', err);
        channel.nack(msg, false, false); // Route to dead-letter
      }
    }
  });
}

module.exports = { startNotificationWorker };
