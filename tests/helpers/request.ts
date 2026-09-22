/**
 * Calling route handlers in tests.
 *
 * The route-handler boundary is this project's primary test seam: issue a
 * request, assert on the response and on the rows it left behind. Written once
 * here and reused by every later slice.
 *
 * Handlers are imported and invoked directly rather than through a running
 * server, so there is no port to manage and no server to start.
 */

import { actAs } from "./session-state";

/**
 * A route handler. Dynamic segments arrive in a second argument, and Next 16
 * hands `params` over as a promise, so the helper wraps whatever a test passes.
 */
type Handler<P extends Record<string, string> = Record<string, string>> = (
  request: Request,
  context: { params: Promise<P> },
) => Promise<Response> | Response;

/**
 * Who the request comes from.
 *
 * `as` takes the acting user's email, or nothing for a signed-out request.
 * This is the session injection the primary seam was designed around: the
 * handler, its guards and its queries are all the real thing.
 */
export type RequestOptions = {
  as?: { email: string } | null;
  /** Dynamic route segments, as the folder names spell them. */
  params?: Record<string, string>;
};

function context<P extends Record<string, string>>(options: RequestOptions) {
  return { params: Promise.resolve((options.params ?? {}) as P) };
}

/** GET a route handler with an optional query string. */
export async function get<P extends Record<string, string>>(
  handler: Handler<P>,
  path: string,
  query: Record<string, string> = {},
  options: RequestOptions = {},
) {
  actAs(options.as?.email ?? null);
  const url = new URL(path, "http://localhost:3000");
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  const response = await handler(new Request(url, { method: "GET" }), context<P>(options));
  const body = await response.json().catch(() => null);

  return { status: response.status, body };
}

/**
 * POST multipart form data to a route handler.
 *
 * A submission carries files, so it is not JSON. Values are appended in the
 * order given, which is what decides an image's sortOrder.
 */
export async function postForm<P extends Record<string, string>>(
  handler: Handler<P>,
  path: string,
  form: FormData,
  options: RequestOptions = {},
) {
  actAs(options.as?.email ?? null);
  const url = new URL(path, "http://localhost:3000");
  const response = await handler(
    new Request(url, { method: "POST", body: form }),
    context<P>(options),
  );
  const body = await response.json().catch(() => null);

  return { status: response.status, body };
}

/** POST JSON to a route handler. */
export async function postJson<P extends Record<string, string>>(
  handler: Handler<P>,
  path: string,
  payload: unknown,
  options: RequestOptions = {},
) {
  actAs(options.as?.email ?? null);
  const url = new URL(path, "http://localhost:3000");
  const response = await handler(
    new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
    context<P>(options),
  );
  const body = await response.json().catch(() => null);

  return { status: response.status, body };
}
