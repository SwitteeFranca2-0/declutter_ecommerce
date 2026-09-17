/**
 * Which user the next request is issued as.
 *
 * The route-handler seam calls handlers directly, so there is no cookie jar and
 * no running NextAuth. `tests/helpers/setup.ts` replaces `getServerSession`
 * with a reader of this object, and `tests/helpers/request.ts` sets it from the
 * `as` option. Everything above it, including the guards themselves, is the
 * real code.
 */

export type ActingSession = { email: string } | null;

export const sessionState: { current: ActingSession } = { current: null };

export function actAs(email: string | null) {
  sessionState.current = email ? { email } : null;
}
