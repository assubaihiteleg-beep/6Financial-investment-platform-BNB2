FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY tsconfig.json tsconfig.base.json ./
COPY artifacts ./artifacts
COPY lib ./lib
COPY scripts ./scripts
COPY firebase-applet-config.json ./firebase-applet-config.json
COPY firebase-blueprint.json ./firebase-blueprint.json
COPY firestore.rules ./firestore.rules

RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm run build

FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json
COPY --from=builder /app/firebase-blueprint.json ./firebase-blueprint.json
COPY --from=builder /app/firestore.rules ./firestore.rules

EXPOSE 8080

CMD ["node", "dist/index.mjs"]
