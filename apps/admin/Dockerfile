FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/player/package.json apps/player/package.json
COPY apps/admin/package.json apps/admin/package.json
RUN npm ci --ignore-scripts
COPY packages/shared ./packages/shared
COPY apps/admin ./apps/admin
RUN npm run build -w @farmhand/admin

FROM nginx:1.27-alpine
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html/admin
