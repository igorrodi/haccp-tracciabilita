FROM alpine:3.19 AS base

ARG PB_VERSION=0.36.6
ARG TARGETARCH=arm64

RUN apk add --no-cache curl unzip ca-certificates

# Download PocketBase
RUN curl -sL "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" \
    -o /tmp/pb.zip && \
    unzip /tmp/pb.zip -d /usr/local/bin/ && \
    rm /tmp/pb.zip && \
    chmod +x /usr/local/bin/pocketbase

# Frontend build stage
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Final image
FROM alpine:3.19
RUN apk add --no-cache ca-certificates

COPY --from=base /usr/local/bin/pocketbase /usr/local/bin/pocketbase
COPY --from=frontend /app/dist /pb/pb_public
COPY scripts/pocketbase/pb_schema.json /pb/pb_schema.json
COPY scripts/pocketbase/pb_migrations /pb/pb_migrations
COPY scripts/docker-entrypoint.sh /pb/entrypoint.sh
RUN chmod +x /pb/entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/pb/entrypoint.sh"]
