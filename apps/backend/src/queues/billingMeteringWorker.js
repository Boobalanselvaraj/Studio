const { connectRabbitMQ } = require('../config/rabbitmq');
const prisma = require('../config/prisma');

async function handleBillingMeteringMessage(payload) {
  if (payload.action !== 'daily_storage_snapshot') {
    return { status: 'ignored', action: payload.action };
  }

  if (!payload.studioId) {
    throw new Error('daily_storage_snapshot requires studioId');
  }

  const snapshotDate = payload.snapshotDate ? new Date(payload.snapshotDate) : new Date();
  snapshotDate.setHours(0, 0, 0, 0);

  const providers = await prisma.storage_providers.findMany({
    where: {
      studio_id: payload.studioId,
      provider_type: 'studio_owned',
    },
    select: { id: true },
  });

  let snapshotsCreated = 0;

  for (const provider of providers) {
    const usage = await prisma.assets.aggregate({
      where: {
        studio_id: payload.studioId,
        storage_provider_id: provider.id,
        is_soft_deleted: false,
      },
      _sum: { file_size_bytes: true },
    });

    await prisma.storage_usage_snapshots.upsert({
      where: {
        storage_provider_id_snapshot_date: {
          storage_provider_id: provider.id,
          snapshot_date: snapshotDate,
        },
      },
      create: {
        studio_id: payload.studioId,
        storage_provider_id: provider.id,
        snapshot_date: snapshotDate,
        bytes_used: usage._sum.file_size_bytes || BigInt(0),
      },
      update: {
        bytes_used: usage._sum.file_size_bytes || BigInt(0),
      },
    });

    snapshotsCreated += 1;
  }

  return { status: 'snapshots_recorded', snapshotsCreated };
}

async function startBillingMeteringWorker() {
  const { channel } = await connectRabbitMQ();
  if (!channel) return;

  const queue = 'billing-metering';
  console.log(`[Worker] Started Billing Metering consumer on queue '${queue}'`);

  channel.consume(queue, async (msg) => {
    if (msg !== null) {
      try {
        const payload = JSON.parse(msg.content.toString());
        console.log('[Billing Metering Worker] Processing external storage usage snapshot:', payload);

        await handleBillingMeteringMessage(payload);
        
        channel.ack(msg);
      } catch (err) {
        console.error('[Billing Metering Worker] Error handling message:', err);
        channel.nack(msg, false, false);
      }
    }
  });
}

module.exports = {
  handleBillingMeteringMessage,
  startBillingMeteringWorker,
};
