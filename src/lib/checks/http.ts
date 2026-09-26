import type { CheckDeps } from './types';

export type HttpOutcome =
  | { kind: 'response'; response: Response }
  | { kind: 'timeout' }
  | { kind: 'network'; error: unknown };

/**
 * One GET with a timeout, no cookies, no referrer. Retries at most once, and
 * only for network errors and 5xx responses — never for 4xx (a rate limit or
 * "not found" won't change by asking again).
 */
export async function getWithRetry(url: string, headers: Record<string, string>, deps: CheckDeps): Promise<HttpOutcome> {
  let last: HttpOutcome = { kind: 'network', error: new Error('not attempted') };
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await deps.sleep(700);
    last = await getOnce(url, headers, deps);
    const retryable = last.kind !== 'response' || last.response.status >= 500;
    if (!retryable) return last;
  }
  return last;
}

async function getOnce(url: string, headers: Record<string, string>, deps: CheckDeps): Promise<HttpOutcome> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, deps.timeoutMs);
  try {
    const response = await deps.fetch(url, {
      method: 'GET',
      headers,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      signal: controller.signal,
    });
    return { kind: 'response', response };
  } catch (error) {
    return timedOut ? { kind: 'timeout' } : { kind: 'network', error };
  } finally {
    clearTimeout(timer);
  }
}

export async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
