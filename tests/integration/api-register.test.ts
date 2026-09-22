/**
 * POST /api/register, at the route-handler seam.
 *
 * AUTH-1, AUTH-2, AUTH-5. Covers what clicking cannot verify: the password
 * reaches the database only as a hash, the role cannot be escalated to admin,
 * and two simultaneous registrations of one email produce a single user
 * because the unique constraint decides it.
 */

import { compare } from "bcryptjs";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeUser, resetDb, testDb } from "../helpers/db";
import { postJson } from "../helpers/request";

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await testDb.$disconnect();
});

const { POST } = await import("@/app/api/register/route");

const VALID = {
  email: "new.buyer@example.com",
  phone: "+2348012345678",
  password: "correct horse battery",
  firstName: "Ada",
  role: "buyer",
} as const;

const register = (payload: unknown) => postJson(POST, "/api/register", payload);

describe("registering", () => {
  it("creates the account and returns who was created", async () => {
    const { status, body } = await register(VALID);

    expect(status).toBe(201);
    expect(body.user).toMatchObject({
      email: VALID.email,
      firstName: "Ada",
      role: "buyer",
      phoneVerified: false,
    });

    const user = await testDb.user.findUniqueOrThrow({ where: { email: VALID.email } });
    expect(user.role).toBe("buyer");
    expect(user.phone).toBe(VALID.phone);
  });

  it("registers a seller just as readily", async () => {
    const { status } = await register({ ...VALID, role: "seller" });

    expect(status).toBe(201);
    const user = await testDb.user.findUniqueOrThrow({ where: { email: VALID.email } });
    expect(user.role).toBe("seller");
  });

  it("starts every account with an unverified phone number, AUTH-3", async () => {
    await register(VALID);

    const user = await testDb.user.findUniqueOrThrow({ where: { email: VALID.email } });
    expect(user.phoneVerified).toBe(false);
  });

  it("collects no identity document fields, PRD §10.3", async () => {
    await register({ ...VALID, idNumber: "A1234567", passportUrl: "/uploads/passport.png" });

    const user = await testDb.user.findUniqueOrThrow({ where: { email: VALID.email } });
    expect(Object.keys(user)).toEqual(
      expect.not.arrayContaining(["idNumber", "passportUrl", "documentUrl"]),
    );
  });
});

describe("the password, AUTH-2", () => {
  it("is stored only as a hash that verifies against the plaintext", async () => {
    await register(VALID);

    const user = await testDb.user.findUniqueOrThrow({ where: { email: VALID.email } });
    expect(user.passwordHash).not.toBe(VALID.password);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(await compare(VALID.password, user.passwordHash)).toBe(true);
  });

  it("never appears in the response, hashed or otherwise", async () => {
    const { body } = await register(VALID);

    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain(VALID.password);
    expect(serialised).not.toContain("passwordHash");
    expect(serialised).not.toContain("$2");
  });

  it("is refused when too short, with a reason naming the field", async () => {
    const { status, body } = await register({ ...VALID, password: "short" });

    expect(status).toBe(400);
    expect(body.details.map((d: { field: string }) => d.field)).toContain("password");
    expect(await testDb.user.count()).toBe(0);
  });
});

describe("an email already registered", () => {
  it("is refused without creating a second account", async () => {
    await makeUser("buyer", { email: VALID.email });

    const { status, body } = await register(VALID);

    expect(status).toBe(409);
    expect(body.error).toMatch(/already/i);
    expect(await testDb.user.count({ where: { email: VALID.email } })).toBe(1);
  });

  it("lets exactly one of two simultaneous registrations win", async () => {
    const results = await Promise.all([register(VALID), register(VALID)]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await testDb.user.count({ where: { email: VALID.email } })).toBe(1);
  });

  it("does not reveal the other account's details", async () => {
    await makeUser("seller", { email: VALID.email, firstName: "Somebody" });

    const { body } = await register(VALID);

    expect(JSON.stringify(body)).not.toContain("Somebody");
  });
});

describe("the admin account is not self-registerable, AUTH-5", () => {
  it("refuses a request asking for the admin role", async () => {
    const { status, body } = await register({ ...VALID, role: "admin" });

    expect(status).toBe(400);
    expect(body.details.map((d: { field: string }) => d.field)).toContain("role");
    expect(await testDb.user.count()).toBe(0);
  });

  it("creates no admin whatever role is sent", async () => {
    for (const role of ["admin", "ADMIN", "Admin", ["buyer", "admin"], { role: "admin" }]) {
      await register({ ...VALID, role });
    }

    expect(await testDb.user.count({ where: { role: "admin" } })).toBe(0);
  });
});

describe("validation at the boundary", () => {
  it.each([
    ["a malformed email", { email: "not-an-email" }, "email"],
    ["a missing email", { email: undefined }, "email"],
    ["a phone number that is not one", { phone: "call me" }, "phone"],
    ["an empty first name", { firstName: "" }, "firstName"],
    ["a missing role", { role: undefined }, "role"],
  ])("refuses %s", async (_case, override, field) => {
    const { status, body } = await register({ ...VALID, ...override });

    expect(status).toBe(400);
    expect(body.details.map((d: { field: string }) => d.field)).toContain(field);
    expect(await testDb.user.count()).toBe(0);
  });

  it("rejects a body that is not JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/register", { method: "POST", body: "nonsense" }),
    );

    expect(response.status).toBe(400);
  });

  it("does not leak internals in the error body", async () => {
    const { body } = await register({ email: "not-an-email" });

    expect(JSON.stringify(body).toLowerCase()).not.toContain("prisma");
  });

  it("stores a hostile first name as text rather than interpreting it, T-XSS", async () => {
    const hostile = '<script>alert("xss")</script>';
    await register({ ...VALID, firstName: hostile });

    const user = await testDb.user.findUniqueOrThrow({ where: { email: VALID.email } });
    expect(user.firstName).toBe(hostile);
  });
});
