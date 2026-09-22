FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

RUN npm install --workspace=apps/api

COPY apps/api ./apps/api

WORKDIR /usr/src/app/apps/api

RUN npx prisma generate --schema=prisma/schema.prisma

EXPOSE 4000

CMD ["sh", "-c", "npx prisma generate --schema=prisma/schema.prisma && node src/server.js"]
