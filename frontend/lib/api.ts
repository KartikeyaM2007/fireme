export const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

let getSessionToken: (() => Promise<string | null>) | null = null;
let onSlowRequest: ((elapsedMs: number) => void) | null = null;
let onRequestSettled: ((elapsedMs: number, ok: boolean) => void) | null = null;

export function bindTokenGetter(getter: (() => Promise<string | null>) | null) {
  getSessionToken = getter;
}

export function bindRequestTiming(handlers: {
  onSlow?: ((elapsedMs: number) => void) | null;
  onSettled?: ((elapsedMs: number, ok: boolean) => void) | null;
}) {
  onSlowRequest = handlers.onSlow ?? null;
  onRequestSettled = handlers.onSettled ?? null;
}

export async function getAccessToken() {
  return (await getSessionToken?.()) || null;
}

/** Warm the Render free-tier API so the first real action is less likely to hang. */
export async function warmApi(timeoutMs = 45000): Promise<"ok" | "slow" | "down"> {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${API}/health`, { signal: ctrl.signal });
    const elapsed = Date.now() - started;
    if (!r.ok) return "down";
    return elapsed > 4000 ? "slow" : "ok";
  } catch {
    return "down";
  } finally {
    window.clearTimeout(timer);
  }
}

export async function request(path: string, options?: RequestInit) {
  const headers = new Headers(options?.headers);
  const token = await getSessionToken?.();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const started = Date.now();
  const slowTimer = window.setTimeout(() => {
    onSlowRequest?.(Date.now() - started);
  }, 2500);
  try {
    const r = await fetch(`${API}${path}`, { ...options, headers });
    const elapsed = Date.now() - started;
    onRequestSettled?.(elapsed, r.ok);
    if (!r.ok)
      throw new Error(
        (await r.json().catch(() => ({}))).detail || "Request failed",
      );
    return r;
  } catch (err) {
    onRequestSettled?.(Date.now() - started, false);
    throw err;
  } finally {
    window.clearTimeout(slowTimer);
  }
}
