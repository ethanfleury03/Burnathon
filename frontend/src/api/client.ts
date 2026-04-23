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
