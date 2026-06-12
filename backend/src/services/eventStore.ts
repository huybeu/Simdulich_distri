export type WebhookKind =
  | "esim-order"
  | "esim-order-redeem"
  | "redeem"
  | "topup";

export type StoredWebhookEvent = {
  id: string;
  kind: WebhookKind;
  receivedAt: string;
  signatureValid: boolean;
  payload: unknown;
};

const MAX_EVENTS = 200;
const events: StoredWebhookEvent[] = [];

export function pushWebhookEvent(
  kind: WebhookKind,
  payload: unknown,
  signatureValid: boolean,
): StoredWebhookEvent {
  const entry: StoredWebhookEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    receivedAt: new Date().toISOString(),
    signatureValid,
    payload,
  };

  events.unshift(entry);
  if (events.length > MAX_EVENTS) {
    events.length = MAX_EVENTS;
  }

  return entry;
}

export function listWebhookEvents(limit = 50): StoredWebhookEvent[] {
  return events.slice(0, limit);
}
