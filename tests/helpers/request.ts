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

type Handler = (request: Request) => Promise<Response> | Response;

/** GET a route handler with an optional query string. */
export async function get(
  handler: Handler,
  path: string,
  query: Record<string, string> = {},
) {
  const url = new URL(path, "http://localhost:3000");
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  const response = await handler(new Request(url, { method: "GET" }));
  const body = await response.json().catch(() => null);

  return { status: response.status, body };
}

/** POST JSON to a route handler. */
export async function postJson(
  handler: Handler,
  path: string,
  payload: unknown,
) {
  const url = new URL(path, "http://localhost:3000");
  const response = await handler(
    new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
  const body = await response.json().catch(() => null);

  return { status: response.status, body };
}
