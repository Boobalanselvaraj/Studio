const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const RedisStore = require('connect-redis').default;

const env = require('./config/env');
const redisClient = require('./config/redis');
const { connectRabbitMQ } = require('./config/rabbitmq');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const { apiLimiter } = require('./middlewares/rateLimiter');

// Import queue consumers
const { startNotificationWorker } = require('./queues/notifications/notification.worker');
const { startMediaSyncWorker } = require('./queues/media-sync/mediaSync.worker');
const { startEventAutomationWorker } = require('./queues/event-automation/eventAutomation.worker');
const { startBillingMeteringWorker } = require('./queues/billing-metering/billingMetering.worker');

const app = express();

// Security & Base Middlewares
app.use(helmet());
app.use(cors({
  origin: env.APP_URL,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Redis-backed Session Middleware
app.use(
  session({
    store: new RedisStore({ client: redisClient, prefix: 'sess:' }),
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    },
  })
);

// Global Rate Limiting
app.use('/api', apiLimiter);

// API Route Mount
app.use('/api', routes);

// Centralized Error Handler
app.use(errorHandler);

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
