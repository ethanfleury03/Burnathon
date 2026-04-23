const API_BASE = import.meta.env.VITE_API_URL || "";

let _getTokenFn: (() => Promise<string | null>) | null = null;

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export function setTokenGetter(fn: () => Promise<string | null>) {
  _getTokenFn = fn;
}

export function resolveApiUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  if (!API_BASE) return path;
  const base = API_BASE.endsWith("/") ? API_BASE : `${API_BASE}/`;
  return new URL(path, base).toString();
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "Something went wrong."
): string {
  if (error instanceof ApiError) return error.detail;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = _getTokenFn ? await _getTokenFn() : null;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(resolveApiUrl(path), {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail || `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  patch: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  delete: (path: string) => request<void>(path, { method: "DELETE" }),

  upload: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: "POST", body: formData }),
};

export interface StreamOptions {
  onToken?: (token: string) => void;
  onEvent?: (event: string, data: string) => void;
  onDone?: (payload?: unknown) => void;
  onError?: (error: Error) => void;
  signal?: AbortSignal;
}

/**
 * Minimal Server-Sent Events client for POST endpoints that stream tokens.
 *
 * Event format (server emits):
 *   event: token\ndata: <json-encoded string token>\n\n
 *   event: done\ndata: {"message": ...}\n\n
 *   event: error\ndata: <json-encoded error string>\n\n
 */
export async function streamPost(
  path: string,
  body: unknown,
  options: StreamOptions = {}
): Promise<void> {
  const token = _getTokenFn ? await _getTokenFn() : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(resolveApiUrl(path), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!res.ok || !res.body) {
    const errBody = await res.json().catch(() => ({ detail: res.statusText }));
    const err = new ApiError(res.status, errBody.detail || `Request failed: ${res.status}`);
    options.onError?.(err);
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sepIndex;
      while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, sepIndex);
        buffer = buffer.slice(sepIndex + 2);
        if (!rawEvent.trim()) continue;
        let eventName = "message";
        const dataLines: string[] = [];
        for (const line of rawEvent.split("\n")) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
        }
        const data = dataLines.join("\n");
        options.onEvent?.(eventName, data);
        if (eventName === "token") {
          let tokenText = data;
          try {
            tokenText = data ? JSON.parse(data) : "";
          } catch {
            /* plain-text fallback for older servers */
          }
          options.onToken?.(typeof tokenText === "string" ? tokenText : String(tokenText));
        }
        if (eventName === "done") {
          try {
            options.onDone?.(data ? JSON.parse(data) : undefined);
          } catch {
            options.onDone?.(data);
          }
          return;
        }
        if (eventName === "error") {
          let msg = data || "Stream error";
          try {
            if (data) msg = JSON.parse(data) as string;
          } catch {
            /* keep raw */
          }
          options.onError?.(new Error(String(msg)));
          return;
        }
      }
    }
    options.onDone?.();
  } catch (err) {
    if (err instanceof Error) options.onError?.(err);
    throw err;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* noop */
    }
  }
}
