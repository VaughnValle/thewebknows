import type { CheckDeps } from '../../src/lib/checks/types';

export type Reply =
  | { status: number; body?: unknown; headers?: Record<string, string> }
  | { networkError: true }
  | { hang: true };

/**
 * A scripted fetch: each call consumes the next reply. Records requested URLs
 * and init so tests can assert what was (and wasn't) sent.
 */
export function scriptedFetch(replies: Reply[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const queue = [...replies];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const reply = queue.shift();
    if (!reply) throw new Error('Unexpected extra fetch');
    if ('networkError' in reply) throw new TypeError('Failed to fetch');
    if ('hang' in reply) {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    }
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status,
      headers: { 'content-type': 'application/json', ...(reply.headers ?? {}) },
    });
  }) as typeof fetch;
  return { fetch: fetchImpl, calls, remaining: () => queue.length };
}

export function deps(fetchImpl: typeof fetch, now = 1_760_000_000_000, timeoutMs = 50): CheckDeps {
  return { fetch: fetchImpl, now: () => now, sleep: async () => {}, timeoutMs };
}
