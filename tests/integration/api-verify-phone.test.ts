/**
 * POST /api/verify-phone, at the route-handler seam.
 *
 * AUTH-3, AUTH-4, AUTH-6. Verification itself is simulated, so the value here
 * is in the guard around it: only a signed-in user can verify, and only ever
 * their own number.
 */

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeUser, resetDb, testDb } from "../helpers/db";
import { postJson } from "../helpers/request";

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await testDb.$disconnect();
});

const { POST } = await import("@/app/api/verify-phone/route");

const verify = (payload: unknown, as: { email: string } | null) =>
  postJson(POST, "/api/verify-phone", payload, { as });

describe("verifying a phone number", () => {
  it("marks the signed-in user's number verified, whatever the code", async () => {
    const user = await makeUser("seller", { phoneVerified: false });

    const { status, body } = await verify({ code: "000000" }, { email: user.email });

    expect(status).toBe(200);
    expect(body.user.phoneVerified).toBe(true);
    const after = await testDb.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.phoneVerified).toBe(true);
  });

  it("is idempotent, so revisiting cannot undo it", async () => {
    const user = await makeUser("buyer", { phoneVerified: true });

    const { status } = await verify({ code: "123456" }, { email: user.email });

    expect(status).toBe(200);
    const after = await testDb.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.phoneVerified).toBe(true);
  });

  it("verifies nobody but the caller, even when another id is supplied", async () => {
    const caller = await makeUser("buyer", { phoneVerified: false });
    const someoneElse = await makeUser("seller", { phoneVerified: false });

    await verify(
      { code: "000000", userId: someoneElse.id, email: someoneElse.email },
      { email: caller.email },
    );

    const them = await testDb.user.findUniqueOrThrow({ where: { id: someoneElse.id } });
    expect(them.phoneVerified).toBe(false);
    const me = await testDb.user.findUniqueOrThrow({ where: { id: caller.id } });
    expect(me.phoneVerified).toBe(true);
  });

  it("refuses a signed-out request with 401 and changes nothing", async () => {
    const user = await makeUser("buyer", { phoneVerified: false });

    const { status } = await verify({ code: "000000" }, null);

    expect(status).toBe(401);
    const after = await testDb.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.phoneVerified).toBe(false);
  });

  it("refuses a session whose user no longer exists", async () => {
    const { status } = await verify({ code: "000000" }, { email: "ghost@example.com" });

    expect(status).toBe(401);
  });

  it("refuses a malformed code at the boundary", async () => {
    const user = await makeUser("buyer", { phoneVerified: false });

    const { status } = await verify({ code: 123456 }, { email: user.email });

    expect(status).toBe(400);
    const after = await testDb.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.phoneVerified).toBe(false);
  });
});

describe("correcting the number first", () => {
  it("replaces the phone number and leaves it unverified", async () => {
    const user = await makeUser("seller", { phoneVerified: false });

    const { status, body } = await postJson(
      POST,
      "/api/verify-phone",
      { phone: "+2349099999999" },
      { as: { email: user.email } },
    );

    expect(status).toBe(200);
    expect(body.user.phoneVerified).toBe(false);
    const after = await testDb.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.phone).toBe("+2349099999999");
    expect(after.phoneVerified).toBe(false);
  });

  it("refuses a phone number that is not one", async () => {
    const user = await makeUser("seller", { phoneVerified: false });

    const { status } = await postJson(
      POST,
      "/api/verify-phone",
      { phone: "call me" },
      { as: { email: user.email } },
    );

    expect(status).toBe(400);
    const after = await testDb.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.phone).toBe("+2348000000000");
  });
});
