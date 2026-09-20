const env = require('./config/env');
const { connectRabbitMQ } = require('./config/rabbitmq');
const createApp = require('./app');

// Import queue consumers
const { startNotificationWorker } = require('./queues/notificationWorker');
const { startMediaSyncWorker } = require('./queues/mediaSyncWorker');
const { startEventAutomationWorker } = require('./queues/eventAutomationWorker');
const { startBillingMeteringWorker } = require('./queues/billingMeteringWorker');

const app = createApp();

// Start Server and Queue Workers
async function bootstrap() {
  try {
    // Initialize RabbitMQ connection and workers
    await connectRabbitMQ();
    startNotificationWorker();
    startMediaSyncWorker();
    startEventAutomationWorker();
    startBillingMeteringWorker();

    const server = app.listen(env.PORT, () => {
      console.log(`[API Server] Running on http://localhost:${env.PORT} in ${env.NODE_ENV} mode`);
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
