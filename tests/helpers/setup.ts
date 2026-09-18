/**
 * Test database lifecycle.
 *
 * Points Prisma at TEST_DATABASE_URL before anything imports the client, so a
 * test run can never touch the development database. The suite truncates
 * tables, so getting this wrong would eat the seeded catalogue.
 */

import { tmpdir } from "node:os";
import { join } from "node:path";
import { vi } from "vitest";
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

// Uploads land in a temporary directory during tests, so a run can never
// litter public/uploads. Each suite empties it the way resetDb empties tables.
process.env.UPLOADS_DIR =
  process.env.UPLOADS_DIR ?? join(tmpdir(), "declutter-test-uploads");

/**
 * Stand in for NextAuth's session lookup.
 *
 * Handlers are invoked directly at the route seam, so there is no cookie to
 * carry a session. `getServerSession` is the single framework call the guards
 * make, so replacing just that keeps every guard, role check and phone check
 * under test. The acting user comes from `tests/helpers/session-state.ts`.
 */
vi.mock("next-auth", async () => {
  const { sessionState } = await import("./session-state");

  return {
    getServerSession: async () =>
      sessionState.current ? { user: { email: sessionState.current.email } } : null,
  };
});
