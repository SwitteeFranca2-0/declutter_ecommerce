#!/bin/sh
# Runs on every container start. Postgres is already healthy: compose waits
# for its healthcheck before starting this container.
set -e

npx prisma migrate deploy

# The seed deletes every row before inserting, so it runs only against an
# empty database. Running it on every start would wipe the orders placed
# since the last one. To start again from the seeded catalogue:
#   docker compose down -v && docker compose up
if node docker/has-items.mjs; then
  echo "Database already has items, not seeding."
else
  npx prisma db seed
fi

exec npx next start --hostname 0.0.0.0 --port 3000
