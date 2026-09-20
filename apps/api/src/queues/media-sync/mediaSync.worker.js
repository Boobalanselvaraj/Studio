const { connectRabbitMQ } = require('../../config/rabbitmq');
const prisma = require('../../config/prisma');

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

        if (payload.action === 'index_asset' && payload.asset_id) {
          // Direct asset status update & sync logic
          await prisma.assets.update({
            where: { asset_id: payload.asset_id },
            data: { sync_status: 'SYNCED', indexed_at: new Date() }
          });
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
