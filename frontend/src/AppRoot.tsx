import { useCallback, useEffect, useRef, useState } from "react";
import App from "./App";
import "./App.css";
import { LoginPage } from "./components/LoginPage";
import type { AuthUser, LoginResponse, PricingProfile } from "./lib/auth";
import { clearAuthToken, getAuthToken, isOrderOnlyRole, ROLE_LABELS } from "./lib/auth";
import { apiGet, apiPost } from "./lib/api";

export function AppRoot() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [pricing, setPricing] = useState<PricingProfile | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  const refreshSession = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setPricing(null);
      return;
    }
    const data = await apiGet<{ user: AuthUser; pricing: PricingProfile }>("/auth/me");
    setUser(data.user);
    setPricing(data.pricing);
  }, []);

  // Kết nối SSE khi đã đăng nhập để nhận cập nhật giá từ admin
  function connectSse() {
    if (sseRef.current) return;
    const token = getAuthToken();
    if (!token) return;
    const es = new EventSource(
      `/api/events?token=${encodeURIComponent(token)}`,
    );
    es.addEventListener("pricing-updated", () => {
      void refreshSession();
    });
    es.onerror = () => {
      // reconnect tự động sau 5s nếu mất kết nối
      es.close();
      sseRef.current = null;
      setTimeout(connectSse, 5_000);
    };
    sseRef.current = es;
  }

  function disconnectSse() {
    sseRef.current?.close();
    sseRef.current = null;
  }

  useEffect(() => {
    const fallback = window.setTimeout(() => {
      setBooting(false);
    }, 3000);

    void (async () => {
      try {
        if (getAuthToken()) {
          await refreshSession();
          connectSse();
        }
      } catch {
        clearAuthToken();
      } finally {
        window.clearTimeout(fallback);
        setBooting(false);
      }
    })();

    return () => {
      window.clearTimeout(fallback);
      disconnectSse();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSession]);

  function handleLoggedIn(data: LoginResponse) {
    setUser(data.user);
    setPricing(data.pricing);
    connectSse();
  }

  async function handleLogout() {
    disconnectSse();
    try {
      await apiPost("/auth/logout", {});
    } catch {
      // ignore
    }
    clearAuthToken();
    setUser(null);
    setPricing(null);
  }

  if (booting) {
    return (
      <div className="login-page">
        <p>Đang tải...</p>
      </div>
    );
  }

  if (!user || !pricing) {
    return <LoginPage onLoggedIn={handleLoggedIn} />;
  }

  return (
    <>
      <div className="auth-bar">
        <span>
          {user.displayName} · <strong>{ROLE_LABELS[user.role]}</strong>
          {isOrderOnlyRole(user.role) ? (
            <span className="muted"> · Đặt eSIM / SIM vật lý</span>
          ) : (
            <span className="muted"> · Quản trị hệ thống</span>
          )}
        </span>
        <button type="button" className="link-btn" onClick={() => void handleLogout()}>
          Đăng xuất
        </button>
      </div>
      <App authUser={user} pricing={pricing} onPricingUpdated={setPricing} />
    </>
  );
}
