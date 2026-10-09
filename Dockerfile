FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
ARG VITE_ENVIRONMENT=production
RUN yarn build

FROM node:24-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean

COPY --from=build /app/dist ./dist
COPY --from=build /app/server-dist ./server-dist
COPY --from=build /app/scripts ./scripts

RUN mkdir -p /data && chown node:node /data && chmod +x scripts/docker-entrypoint.sh

VOLUME ["/data"]
EXPOSE 3000

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
CMD ["node", "server-dist/main.js"]
