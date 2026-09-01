FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/player/package.json apps/player/package.json
COPY apps/admin/package.json apps/admin/package.json
RUN npm ci
COPY packages/shared ./packages/shared
COPY apps/player ./apps/player
RUN npm run build -w @farmhand/player

FROM nginx:1.27-alpine
COPY apps/player/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/player/dist /usr/share/nginx/html
