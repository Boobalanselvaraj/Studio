const { connectRabbitMQ } = require('../../config/rabbitmq');
const immichService = require('../../services/immich/immich.service');

async function startMediaSyncWorker() {
  const { channel } = await connectRabbitMQ();
  if (!channel) return;

  const queue = 'media-sync';
  console.log(`[Worker] Started Media Sync consumer on queue '${queue}'`);

  channel.consume(queue, async (msg) => {
    if (msg !== null) {
      try {
        const payload = JSON.parse(msg.content.toString());
        console.log('[Media Sync Worker] Processing media event:', payload);

        if (payload.action === 'index_asset') {
          await immichService.indexAsset(payload);
        }

        channel.ack(msg);
      } catch (err) {
        console.error('[Media Sync Worker] Error handling message:', err);
        channel.nack(msg, false, false);
      }
    }
  });
}

module.exports = { startMediaSyncWorker };
