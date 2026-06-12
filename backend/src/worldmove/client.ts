import type { WorldmoveCredentials } from "../credentials.js";

export class WorldmoveApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "WorldmoveApiError";
  }
}

/** POST JSON to Worldmove production/test base URL. */
export async function postWorldmove<TResponse>(
  path: string,
  body: Record<string, unknown>,
  creds: Pick<WorldmoveCredentials, "baseUrl">,
): Promise<TResponse> {
  const url = `${creds.baseUrl.replace(/\/$/, "")}${path}`;
  const bodyJson = JSON.stringify(body);
  console.log(`[Worldmove] POST ${url}`);
  console.log(`[Worldmove] REQUEST:`, bodyJson);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: bodyJson,
  });

  const text = await response.text();
  console.log(`[Worldmove] RESPONSE (${response.status}):`, text);
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Keep raw text when response is not JSON (e.g. webhook ack "1").
  }

  if (!response.ok) {
    throw new WorldmoveApiError(
      `Simdulich.vn HTTP ${response.status} for ${path}`,
      response.status,
      parsed,
    );
  }

  const business = parsed as { code?: number; msg?: string };
  if (business.code === 401) {
    throw new WorldmoveApiError(
      "encStr không khớp. Kiểm tra MerchantId, DeptId, Token (cấu hình Simdulich.vn, không thừa khoảng trắng).",
      401,
      parsed,
    );
  }

  return parsed as TResponse;
}
