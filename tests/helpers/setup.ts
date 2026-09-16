/**
 * Test database lifecycle.
 *
 * Points Prisma at TEST_DATABASE_URL before anything imports the client, so a
 * test run can never touch the development database. The suite truncates
 * tables, so getting this wrong would eat the seeded catalogue.
 */

import { config } from "dotenv";

config();

const testUrl = process.env.TEST_DATABASE_URL;

if (!testUrl) {
  throw new Error(
    "TEST_DATABASE_URL is not set. Copy .env.example to .env and start Postgres with 'docker compose up -d'.",
  );
}

if (testUrl === process.env.DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL must differ from DATABASE_URL. The suite truncates tables.",
  );
}

process.env.DATABASE_URL = testUrl;
