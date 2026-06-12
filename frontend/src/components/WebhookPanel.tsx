import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";

type WebhookEvent = {
  id: string;
  kind: string;
  receivedAt: string;
  signatureValid: boolean;
  payload: unknown;
};

export function WebhookPanel() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);

  async function refresh() {
    const data = await apiGet<{ events: WebhookEvent[] }>("/webhook-events");
    setEvents(data.events);
  }

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="webhook-panel">
      <div className="row between">
        <p className="muted">
          Cấu hình URL callback Simdulich.vn (local):
        </p>
        <button type="button" onClick={() => void refresh()}>
          Làm mới
        </button>
      </div>
      <ul className="mono-list">
        <li>POST /webhooks/worldmove/esim-order (API 2.2)</li>
        <li>POST /webhooks/worldmove/esim-order-redeem (API 2.5)</li>
        <li>POST /webhooks/worldmove/redeem (API 3.2)</li>
        <li>POST /webhooks/worldmove/topup (API 5.2)</li>
      </ul>
      <p className="muted">Backend phản hồi bắt buộc: chuỗi &quot;1&quot;</p>

      {events.length === 0 ? (
        <p>Chưa nhận webhook nào.</p>
      ) : (
        events.map((event) => (
          <details key={event.id} className="webhook-item">
            <summary>
              [{event.kind}] {event.receivedAt}{" "}
              {event.signatureValid ? "✓ encStr" : "✗ encStr"}
            </summary>
            <pre>{JSON.stringify(event.payload, null, 2)}</pre>
          </details>
        ))
      )}
    </div>
  );
}
