// HTTP helpers shared by every route.

export class HttpError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

/** Throw an HttpError; the router turns it into a JSON error response. */
export const fail = (status, msg) => { throw new HttpError(status, msg); };

export const json = (obj, status = 200, headers = {}) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

export async function body(req) {
  try { return await req.json(); } catch { fail(400, '잘못된 요청'); }
}

export const now = () => Date.now();
export const uid = () => crypto.randomUUID().replace(/-/g, '');
