const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');

const env = require('./config/env');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const { apiLimiter } = require('./middlewares/rateLimiter');

function createApp(options = {}) {
  const app = express();
  const enableRateLimit = options.enableRateLimit ?? env.NODE_ENV !== 'test';
  const sessionStore = options.sessionStore ?? createSessionStore();

  if (env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => {
      // Allow any requesting origin (localhost, LAN IP, remote) with credentials
      callback(null, true);
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.set('json replacer', (_key, value) => (
    typeof value === 'bigint' ? value.toString() : value
  ));

  app.use(
    session({
      store: sessionStore,
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7,
        sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
      },
    })
  );

  if (enableRateLimit) {
    app.use('/api', apiLimiter);
  }

  app.use('/api', routes);
  app.use(errorHandler);

  return app;
}

function createSessionStore() {
  if (env.NODE_ENV === 'test') {
    return new session.MemoryStore();
  }

  try {
    const RedisStore = require('connect-redis').default;
    const redisClient = require('./config/redis');
    return new RedisStore({ client: redisClient, prefix: 'sess:' });
  } catch (err) {
    console.warn('[Session] Redis store initialization failed, falling back to MemoryStore:', err.message);
    return new session.MemoryStore();
  }
}

module.exports = createApp;
