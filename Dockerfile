# The whole application in one image: `docker compose up --build` starts it
# beside its database, migrates, seeds an empty database, and serves on :3000.
#
# The full dependency set is kept rather than pruned to production, because the
# seed script runs through tsx, a development dependency. A smaller image is not
# worth a second build path for an application that only ever runs locally.
FROM node:22-bookworm-slim

# Prisma's query engine links against OpenSSL, which the slim image leaves out.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

EXPOSE 3000
ENTRYPOINT ["sh", "docker/entrypoint.sh"]
