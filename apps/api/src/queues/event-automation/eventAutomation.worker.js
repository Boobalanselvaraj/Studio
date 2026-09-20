const { connectRabbitMQ } = require('../../config/rabbitmq');

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

        // Process reminders, task escalation, and auto status transitions
        
        channel.ack(msg);
      } catch (err) {
        console.error('[Event Automation Worker] Error handling message:', err);
        channel.nack(msg, false, false);
      }
    }
  });
}

module.exports = { startEventAutomationWorker };
