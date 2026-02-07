export type FetchJsonResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
};

type FetchJsonOptions = RequestInit & {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchJson<T>(
  input: RequestInfo | URL,
  options: FetchJsonOptions = {}
): Promise<FetchJsonResult<T>> {
  const {
    timeoutMs = 8000,
    retries = 1,
    retryDelayMs = 400,
    ...fetchOptions
  } = options;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(input, { ...fetchOptions, signal: controller.signal });
      const data = (await res.json().catch(() => null)) as T | null;
      clearTimeout(timeout);

      if (res.ok) {
        return { ok: true, status: res.status, data };
      }

      if (res.status >= 500 && attempt < retries) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }

      return {
        ok: false,
        status: res.status,
        data,
        error: (data as { error?: string })?.error ?? "Request failed",
      };
    } catch (error) {
      clearTimeout(timeout);
      if (attempt < retries) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }
      return {
        ok: false,
        status: 0,
        data: null,
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  }

  return { ok: false, status: 0, data: null, error: "Request failed" };
}
