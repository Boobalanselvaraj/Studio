FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npx prisma generate --schema=prisma/schema.prisma

EXPOSE 4000

CMD ["sh", "-c", "npx prisma generate --schema=prisma/schema.prisma && node src/server.js"]
