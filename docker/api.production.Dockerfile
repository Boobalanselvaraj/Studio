FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/
RUN npm ci --workspace=apps/api
COPY apps/api apps/api
RUN npm run build:api
WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "npx prisma generate --schema=prisma/schema.prisma && node src/server.js"]
