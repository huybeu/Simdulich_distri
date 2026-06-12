import { useState } from "react";
import type { LoginResponse } from "../lib/auth";
import { setAuthToken } from "../lib/auth";
import { apiPost } from "../lib/api";

type Props = {
  onLoggedIn: (data: LoginResponse) => void;
};

export function LoginPage({ onLoggedIn }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiPost<LoginResponse>("/auth/login", { username, password });
      setAuthToken(data.token);
      onLoggedIn(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={(e) => void handleSubmit(e)}>
        <h1>Simdulich.vn</h1>
        <p className="muted">Đăng nhập — Admin / Tổng kho / Đại lý</p>
        <label>
          Tài khoản
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Mật khẩu
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit" disabled={loading}>
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
        <p className="muted login-hint">
          Mẫu: <code>admin</code>/<code>admin123</code> · <code>tongkho</code>/<code>tongkho123</code> ·{" "}
          <code>daily</code>/<code>daily123</code>
        </p>
      </form>
    </div>
  );
}
