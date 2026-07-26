export const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

let getSessionToken: (() => Promise<string | null>) | null = null;

export function bindTokenGetter(getter: (() => Promise<string | null>) | null) {
  getSessionToken = getter;
}

export async function request(path: string, options?: RequestInit) {
  const headers = new Headers(options?.headers);
  const token = await getSessionToken?.();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const r = await fetch(`${API}${path}`, { ...options, headers });
  if (!r.ok)
    throw new Error(
      (await r.json().catch(() => ({}))).detail || "Request failed",
    );
  return r;
}
