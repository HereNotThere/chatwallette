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

# Required build arguments.
ARG _GCP_PROJECT_ID
ARG _REDISHOST
# Optional arguments
ARG _ANALYTICS_ID=
ARG _REDISPORT=6379

ENV ANALYTICS_ID=$_ANALYTICS_ID
ENV GCP_PROJECT_ID=$_GCP_PROJECT_ID
ENV REDISHOST=$_REDISHOST
ENV REDISPORT=$_REDISPORT

RUN echo Substituted values for GCP_PROJECT_ID=${GCP_PROJECT_ID}, REDISHOST=${REDISHOST}, REDISPORT=${REDISPORT}, ANALYTICS_ID=${ANALYTICS_ID}

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