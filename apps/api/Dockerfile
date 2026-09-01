FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/player/package.json apps/player/package.json
COPY apps/admin/package.json apps/admin/package.json
RUN npm ci --ignore-scripts

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && npx tsx apps/api/src/index.ts"]
