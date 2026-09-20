FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

RUN npm install --workspace=apps/api

COPY apps/api ./apps/api

WORKDIR /usr/src/app/apps/api

EXPOSE 4000

CMD ["npm", "run", "dev"]
