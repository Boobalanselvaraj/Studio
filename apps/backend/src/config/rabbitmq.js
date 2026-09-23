const amqp = require('amqplib');
const env = require('./env');

let connection = null;
let channel = null;

async function connectRabbitMQ() {
  if (channel) return { connection, channel };

  try {
    connection = await amqp.connect(env.RABBITMQ_URL);
    channel = await connection.createChannel();

    console.log('Connected to RabbitMQ');

    // Assert exchanges and queues
    await channel.assertExchange('studio.direct', 'direct', { durable: true });
    
    const queues = ['notifications', 'media-sync', 'event-automation', 'billing-metering'];
    for (const q of queues) {
      await channel.assertQueue(q, { durable: true });
    }

    return { connection, channel };
  } catch (error) {
    console.error('RabbitMQ connection failed:', error.message);
    return { connection: null, channel: null };
  }
}

async function publishToQueue(queueName, message) {
  try {
    if (!channel) {
      await connectRabbitMQ();
    }
    if (channel) {
      channel.sendToQueue(queueName, Buffer.from(JSON.stringify(message)), {
        persistent: true,
      });
    }
  } catch (err) {
    console.error(`Failed to publish message to queue ${queueName}:`, err);
  }
}

module.exports = {
  connectRabbitMQ,
  publishToQueue,
};
