FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json apps/api/
COPY apps/web/package*.json apps/web/
RUN npm ci --workspace=apps/web
COPY apps/web apps/web
ENV VITE_API_BASE_URL=/api
RUN npm run build:web
FROM nginx:stable-alpine
COPY docker/web.production.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 3000
