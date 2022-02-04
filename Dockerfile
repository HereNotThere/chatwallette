# Install dependencies only when needed
FROM node:alpine AS deps

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat build-base gcc wget git python3
WORKDIR /app

COPY package.json ./
COPY yarn.lock ./
COPY .yarnrc.yml ./
COPY .yarn ./.yarn
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN $(corepack enable)
RUN yarn install --immutable

# Rebuild the source code only when needed
FROM node:alpine AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules/
COPY --from=deps /app/.yarn ./.yarn/

RUN echo $(ls -a -1 ./)
RUN echo $(ls -a -1 ./.yarn)

RUN yarn workspaces foreach run build

RUN echo $(ls -a -1 ./)
RUN echo $(ls -a -1 ./.yarn)


# Production image, copy all the files and run next
FROM node:alpine AS runner
WORKDIR /app

ENV NODE_ENV production
# Production redis host 10.120.147.28
# Development redis host 10.44.207.180
# To set the redis host at build time:
#   docker build . -t here-web3-server --build-arg REDISHOST_ARG=10.44.207.180
ARG REDISHOST_ARG=10.120.147.28
ARG REDISPORT_ARG=6379
# Build arguments.
ARG _ANALYTICS_ID=

ENV ANALYTICS_ID=$_ANALYTICS_ID
ENV REDISHOST=$REDISHOST_ARG
ENV REDISPORT=$REDISPORT_ARG

RUN echo Substituted value for ANALYTICS_ID=${ANALYTICS_ID}

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copy the static client from next:export
COPY --from=builder /app/client/out ./out

# Copy the server code and node_modules
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/server/package.json ./
COPY --from=builder /app/server/dist ./dist

RUN echo $(ls -a -1 ./)

USER nextjs

EXPOSE 3000 8080

ENV PORT 3000

CMD ["node", "dist/server/src/main.js"]