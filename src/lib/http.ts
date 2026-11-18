export class HttpError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** fetch JSON with timeout + a couple of retries on 429/5xx/network errors. */
export async function fetchJson<T>(
  url: string,
  opts: { timeoutMs?: number; retries?: number; headers?: Record<string, string>; method?: string; body?: string } = {},
): Promise<T> {
  const { timeoutMs = 8000, retries = 2, headers, method, body } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers, method, body, cache: "no-store" });
      if (res.status === 429 || res.status >= 500) {
        throw new HttpError(`HTTP ${res.status}`, res.status);
      }
      if (!res.ok) throw new HttpError(`HTTP ${res.status}`, res.status);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      const status = e instanceof HttpError ? e.status : undefined;
      const retryable = status === undefined || status === 429 || (status !== undefined && status >= 500);
      if (!retryable || attempt === retries) break;
      await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new HttpError(String(lastErr));
}
