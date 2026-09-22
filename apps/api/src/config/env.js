const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),
  APP_URL: process.env.APP_URL || 'http://localhost:3000',
  API_URL: process.env.API_URL || 'http://localhost:4000/api',

  INTERNAL_SERVICE_KEY: process.env.INTERNAL_SERVICE_KEY,
  // Secrets
  SESSION_SECRET: process.env.SESSION_SECRET || 'dev_session_secret_12345',
  JWT_SECRET: process.env.JWT_SECRET || 'dev_jwt_secret_12345',
  CREDENTIAL_ENCRYPTION_KEY: process.env.CREDENTIAL_ENCRYPTION_KEY || '01234567890123456789012345678901',

  // Database
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres_secure_password@localhost:5432/photo_studio_db',

  // Redis
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,

  // RabbitMQ
  RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',

  // SFTPGo
  SFTPGO_API_URL: process.env.SFTPGO_API_URL || 'http://localhost:8080/api/v2',
  SFTPGO_API_KEY: process.env.SFTPGO_API_KEY || '',

  // Immich
  IMMICH_API_URL: process.env.IMMICH_API_URL || 'http://localhost:2283/api',
  IMMICH_API_KEY: process.env.IMMICH_API_KEY || '',

  // Storage
  STORAGE_ROOT_PATH: process.env.STORAGE_ROOT_PATH || './storage'
};
