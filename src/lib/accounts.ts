/**
 * Accounts.
 *
 * Registration collects an email address, a phone number, a password and a
 * first name. Nothing else, and in particular **no identity documents**: that
 * is a deliberate data minimisation decision under GDPR Art. 5(1)(c), recorded
 * in PRD §10.3. Do not add them.
 *
 * The password exists as plaintext only inside `registerUser`, long enough to
 * be hashed. It is never stored, never logged and never returned.
 */

import { Prisma, type User } from "@prisma/client";
import { compare, hash } from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

/** Cost factor for bcrypt. The library default, stated here so it is visible. */
const BCRYPT_ROUNDS = 10;

/**
 * Attacker-controlled: this arrives as a request body.
 *
 * `role` is a two-value enum, so `admin` is refused by the schema itself
 * rather than by a comparison a later edit could forget. The single admin
 * account is provisioned by the seed script and by nothing else (AUTH-5).
 */
export const registerSchema = z.object({
  email: z.string().email().max(254).transform((value) => value.trim().toLowerCase()),
  // Deliberately permissive: international formats vary and a wrong rejection
  // is worse than a loose one. Verification is what makes a number trustworthy.
  phone: z
    .string()
    .trim()
    .min(7)
    .max(20)
    .regex(/^\+?[0-9\s-]+$/, { error: "Enter a phone number" }),
  // 8 is the floor. The ceiling is bcrypt's: it silently ignores bytes past 72.
  password: z.string().min(8, { error: "Use at least 8 characters" }).max(72),
  firstName: z.string().trim().min(1).max(50),
  role: z.enum(["buyer", "seller"], { error: "Choose whether you are buying or selling" }),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/** A user as the interface may see them. Never carries the hash. */
export type PublicUser = {
  id: string;
  email: string;
  firstName: string;
  role: User["role"];
  phoneVerified: boolean;
};

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    role: user.role,
    phoneVerified: user.phoneVerified,
  };
}

export type RegisterResult =
  | { ok: true; user: PublicUser }
  | { ok: false; reason: "email_taken" };

/**
 * Create an account.
 *
 * The duplicate email case is decided by the unique constraint, not by reading
 * first and then inserting: two simultaneous registrations would both pass a
 * prior read and one would still have to lose here.
 */
export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const passwordHash = await hash(input.password, BCRYPT_ROUNDS);

  try {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        phone: input.phone,
        firstName: input.firstName,
        role: input.role,
        passwordHash,
        // AUTH-3: verification is a separate step, and until it happens this
        // account can neither list an item nor pay a deposit.
        phoneVerified: false,
      },
    });

    return { ok: true, user: toPublicUser(user) };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, reason: "email_taken" };
    }

    throw error;
  }
}

/**
 * Check an email and password pair.
 *
 * Returns null for an unknown email and for a wrong password alike, so a
 * caller cannot tell the two apart and use the form to discover who has an
 * account. AUTH-2.
 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  // Compared even when there is no user, so the response time does not reveal
  // whether the email exists.
  const hashToCompare = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid";
  const matches = await compare(password, hashToCompare);

  return user && matches ? user : null;
}

/**
 * Mark a phone number verified.
 *
 * Simulated: any code is accepted, because an SMS provider is a credential the
 * examiner does not have (PRD §12.1). The gate it opens is real. Idempotent, so
 * revisiting the page cannot undo the status.
 */
export async function markPhoneVerified(userId: string): Promise<PublicUser> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { phoneVerified: true },
  });

  return toPublicUser(user);
}

/** Change the number awaiting verification, for a typo caught at the last moment. */
export async function updatePhone(userId: string, phone: string): Promise<PublicUser> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { phone, phoneVerified: false },
  });

  return toPublicUser(user);
}
