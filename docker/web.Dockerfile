FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
COPY apps/web/package*.json ./apps/web/

RUN npm install --workspace=apps/web

COPY apps/web ./apps/web

WORKDIR /usr/src/app/apps/web

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host"]
