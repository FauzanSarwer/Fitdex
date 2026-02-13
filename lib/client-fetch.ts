import QuickLRU from "quick-lru";

type CacheEntry = {
  value: FetchJsonResult<unknown>;
  expiresAt: number;
};

const cache = new QuickLRU<string, CacheEntry>({ maxSize: 200 });
const inFlight = new Map<string, Promise<FetchJsonResult<unknown>>>();

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
  cacheKey?: string;
  useCache?: boolean;
  cacheTtlMs?: number;
  dedupe?: boolean;
};

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRIES = 1;
const DEFAULT_RETRY_DELAY_MS = 400;
const DEFAULT_CACHE_TTL_MS = 15000;
const DEFAULT_DEDUPE = true;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getRequestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return String(input);
};

const getRequestMethod = (input: RequestInfo | URL, method?: string): string => {
  if (method) return method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
  return "GET";
};

const getErrorFromData = (data: unknown): string | undefined => {
  if (!data || typeof data !== "object") return undefined;
  const maybeError = (data as { error?: unknown }).error;
  return typeof maybeError === "string" ? maybeError : undefined;
};

export async function fetchJson<T>(
  input: RequestInfo | URL,
  options: FetchJsonOptions = {}
): Promise<FetchJsonResult<T>> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    cacheKey,
    useCache = false,
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    dedupe = DEFAULT_DEDUPE,
    ...fetchOptions
  } = options;

  const method = getRequestMethod(input, fetchOptions.method);
  const requestUrl = getRequestUrl(input);
  const resolvedKey = cacheKey ?? (method === "GET" ? `${method}:${requestUrl}` : undefined);

  if (useCache && resolvedKey) {
    const entry = cache.get(resolvedKey);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.value as FetchJsonResult<T>;
    }
    if (entry) {
      cache.delete(resolvedKey);
    }
  }

  const inFlightKey = dedupe && method === "GET" ? resolvedKey ?? `${method}:${requestUrl}` : null;
  if (inFlightKey && inFlight.has(inFlightKey)) {
    return inFlight.get(inFlightKey) as Promise<FetchJsonResult<T>>;
  }

  const requestPromise = (async (): Promise<FetchJsonResult<T>> => {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(input, { ...fetchOptions, signal: controller.signal });
        const contentType = res.headers.get("content-type") ?? "";
        const rawText = await res.text().catch(() => "");
        let data: T | null = null;
        let rawError: string | undefined;

        if (rawText) {
          if (contentType.includes("application/json")) {
            try {
              data = JSON.parse(rawText) as T;
            } catch {
              rawError = rawText;
            }
          } else {
            rawError = rawText;
          }
        }

        const result: FetchJsonResult<T> = res.ok
          ? { ok: true, status: res.status, data }
          : {
              ok: false,
              status: res.status,
              data,
              error:
                getErrorFromData(data) ??
                rawError?.slice(0, 300) ??
                (res.statusText || "Request failed"),
            };

        if (useCache && resolvedKey && cacheTtlMs > 0) {
          cache.set(resolvedKey, {
            value: result as FetchJsonResult<unknown>,
            expiresAt: Date.now() + cacheTtlMs,
          });
        }

        return result;
      } catch (error) {
        if (attempt < retries) {
          await sleep(retryDelayMs * (attempt + 1));
          continue;
        }
        if (error instanceof DOMException && error.name === "AbortError") {
          return { ok: false, status: 0, data: null, error: "Request timed out" };
        }
        return {
          ok: false,
          status: 0,
          data: null,
          error: error instanceof Error ? error.message : "Network error",
        };
      } finally {
        clearTimeout(timeout);
      }
    }

    return { ok: false, status: 0, data: null, error: "Request failed" };
  })();

  if (inFlightKey) {
    inFlight.set(inFlightKey, requestPromise as Promise<FetchJsonResult<unknown>>);
  }

  try {
    return await requestPromise;
  } finally {
    if (inFlightKey) {
      inFlight.delete(inFlightKey);
    }
  }
}
