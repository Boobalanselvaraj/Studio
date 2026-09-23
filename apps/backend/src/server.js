const env = require('./config/env');
const { connectRabbitMQ } = require('./config/rabbitmq');
const createApp = require('./app');

// Import queue consumers & real-time watchers
const { startNotificationWorker } = require('./queues/notificationWorker');
const { startMediaSyncWorker } = require('./queues/mediaSyncWorker');
const { startEventAutomationWorker } = require('./queues/eventAutomationWorker');
const { startBillingMeteringWorker } = require('./queues/billingMeteringWorker');
const { startStorageWatcher } = require('./services/storageWatcher');

const app = createApp();

// Start Server, Real-time File Watchers and Queue Workers
async function bootstrap() {
  try {
    // Initialize real-time camera storage watcher
    startStorageWatcher();

    // Initialize RabbitMQ connection and workers
    await connectRabbitMQ();
    startNotificationWorker();
    startMediaSyncWorker();
    startEventAutomationWorker();
    startBillingMeteringWorker();

    const server = app.listen(env.PORT, '0.0.0.0', () => {
      console.log(`[API Server] Running on http://0.0.0.0:${env.PORT} in ${env.NODE_ENV} mode`);
    });

    const shutdown = async () => {
      console.log('\n[API Server] Gracefully shutting down...');
      server.close(() => {
        console.log('[API Server] Closed HTTP server');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('[Bootstrap Error]:', error);
    process.exit(1);
  }
}

bootstrap();

module.exports = app;
