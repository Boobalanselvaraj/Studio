const { connectRabbitMQ } = require('../../config/rabbitmq');

async function startBillingMeteringWorker() {
  const { channel } = await connectRabbitMQ();
  if (!channel) return;

  const queue = 'billing-metering';
  console.log(`[Worker] Started Billing Metering consumer on queue '${queue}'`);

  channel.consume(queue, async (msg) => {
    if (msg !== null) {
      try {
        const payload = JSON.parse(msg.content.toString());
        console.log('[Billing Metering Worker] Processing daily snapshot / quota check:', payload);

        // Daily storage snapshot and tier threshold calculation
        
        channel.ack(msg);
      } catch (err) {
        console.error('[Billing Metering Worker] Error handling message:', err);
        channel.nack(msg, false, false);
      }
    }
  });
}

module.exports = { startBillingMeteringWorker };
