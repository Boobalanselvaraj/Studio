const { PrismaClient } = require('@prisma/client');
const env = require('./env');

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

module.exports = prisma;
