import { authHeaders } from "./auth";
import { settingsHeaders } from "./settings";

function apiHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...settingsHeaders(),
    ...authHeaders(),
  };
}

async function parseError(response: Response, data: unknown): Promise<string> {
  const body = data as { msg?: string; message?: string };
  if (body.message) return body.message;
  if (body.msg) return body.msg;
  return `HTTP ${response.status}`;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as T & { msg?: string; message?: string };
  if (!response.ok) {
    throw new Error(await parseError(response, data));
  }
  return data;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`/api${path}`, { headers: apiHeaders() });
  const data = (await response.json()) as T & { msg?: string; message?: string };
  if (!response.ok) {
    throw new Error(await parseError(response, data));
  }
  return data;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: "PATCH",
    headers: apiHeaders(),
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { msg?: string; message?: string };
  if (!response.ok) {
    throw new Error(await parseError(response, data));
  }
  return data;
}
