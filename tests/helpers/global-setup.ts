/**
 * Brings the test database's schema up to date once, before any test file runs.
 *
 * Without this, a clean clone fails most of the suite: the test database exists
 * but has no tables until somebody migrates it by hand. `migrate deploy` only
 * applies what is missing, so on an up-to-date database it does nothing.
 */

import { execSync } from "node:child_process";
import { config } from "dotenv";

export default function setup() {
  config();

  const testUrl = process.env.TEST_DATABASE_URL;
  // tests/helpers/setup.ts reports a missing or unsafe URL with a clearer message.
  if (!testUrl || testUrl === process.env.DATABASE_URL) return;

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testUrl },
    stdio: "pipe",
  });
}
