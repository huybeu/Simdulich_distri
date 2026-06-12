import { useCallback, useEffect, useState } from "react";
import type { AuthUser, PricingProfile } from "../lib/auth";
import { ROLE_LABELS } from "../lib/auth";
import { apiGet, apiPatch, apiPost } from "../lib/api";
import { Section } from "./Section";

type PublicUser = AuthUser;

type PricingConfig = {
  ntToVndRate: number;
  tierMarkupVnd: { tong_kho: number; dai_ly: number };
  tierRate: { tong_kho: number; dai_ly: number };
};

type Props = {
  onPricingUpdated: (pricing: PricingProfile) => void;
};

export function AdminPanel({ onPricingUpdated }: Props) {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    role: "dai_ly" as PublicUser["role"],
    displayName: "",
    markupVnd: 8,
    parentId: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [usersRes, cfg] = await Promise.all([
        apiGet<{ users: PublicUser[] }>("/admin/users"),
        apiGet<PricingConfig>("/admin/pricing-config"),
      ]);
      setUsers(usersRes.users);
      setConfig({
        ...cfg,
        tierRate: cfg.tierRate ?? { tong_kho: 0, dai_ly: 0 },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được dữ liệu quản trị.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveTierDefaults() {
    if (!config) return;
    const saved = await apiPatch<PricingConfig>("/admin/pricing-config", {
      ntToVndRate: config.ntToVndRate,
      tierMarkupVnd: config.tierMarkupVnd,
      tierRate: config.tierRate,
    });
    setConfig(saved);
    onPricingUpdated({
      ntToVndRate: saved.ntToVndRate,
      markupVnd: 0,
      role: "admin",
    });
  }

  async function createAccount() {
    await apiPost("/admin/users", {
      ...newUser,
      parentId: newUser.parentId || null,
    });
    setNewUser({
      username: "",
      password: "",
      role: "dai_ly",
      displayName: "",
      markupVnd: 8,
      parentId: "",
    });
    await load();
  }

  async function updateMarkup(userId: string, markupVnd: number) {
    await apiPatch(`/admin/users/${userId}`, { markupVnd });
    await load();
  }

  return (
    <div className="admin-panel">
      <Section
        title="Cấu hình giá hệ thống"
        subtitle="Hệ số giá VND (nội bộ) và markup mặc định theo cấp"
        actions={
          <button type="button" onClick={() => void saveTierDefaults()} disabled={!config || loading}>
            Lưu cấu hình chung
          </button>
        }
      >
        {config ? (
          <div className="pricing-config-grid">
            {/* Hàng tiêu đề */}
            <div className="pricing-col-header" />
            <div className="pricing-col-header">× Hệ số quy đổi</div>
            <div className="pricing-col-header">+ Markup (VND/SIM)</div>

            {/* Admin — hệ số gốc */}
            <div className="pricing-row-label">Admin (gốc)</div>
            <label className="pricing-cell">
              <input
                type="number"
                min={1}
                value={config.ntToVndRate}
                onChange={(e) =>
                  setConfig({ ...config, ntToVndRate: Number(e.target.value) || 850 })
                }
              />
            </label>
            <div className="pricing-cell pricing-muted">—</div>

            {/* Tổng kho */}
            <div className="pricing-row-label">Tổng kho</div>
            <label className="pricing-cell">
              <input
                type="number"
                min={0}
                value={config.tierRate.tong_kho}
                placeholder={String(config.ntToVndRate)}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    tierRate: { ...config.tierRate, tong_kho: Number(e.target.value) || 0 },
                  })
                }
              />
              <span className="pricing-hint">0 = dùng hệ số Admin</span>
            </label>
            <label className="pricing-cell">
              <input
                type="number"
                step={1000}
                value={config.tierMarkupVnd.tong_kho}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    tierMarkupVnd: { ...config.tierMarkupVnd, tong_kho: Number(e.target.value) || 0 },
                  })
                }
              />
            </label>

            {/* Đại lý */}
            <div className="pricing-row-label">Đại lý</div>
            <label className="pricing-cell">
              <input
                type="number"
                min={0}
                value={config.tierRate.dai_ly}
                placeholder={String(config.ntToVndRate)}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    tierRate: { ...config.tierRate, dai_ly: Number(e.target.value) || 0 },
                  })
                }
              />
              <span className="pricing-hint">0 = dùng hệ số Admin</span>
            </label>
            <label className="pricing-cell">
              <input
                type="number"
                step={1000}
                value={config.tierMarkupVnd.dai_ly}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    tierMarkupVnd: { ...config.tierMarkupVnd, dai_ly: Number(e.target.value) || 0 },
                  })
                }
              />
            </label>

            {/* Preview công thức */}
            <div className="pricing-row-label pricing-muted">Công thức</div>
            <div className="pricing-cell pricing-formula" style={{ gridColumn: "2 / 4" }}>
              Giá = NT × {config.tierRate.tong_kho || config.ntToVndRate} +{" "}
              {config.tierMarkupVnd.tong_kho.toLocaleString("vi-VN")} (tổng kho) &nbsp;|&nbsp;
              NT × {config.tierRate.dai_ly || config.ntToVndRate} +{" "}
              {config.tierMarkupVnd.dai_ly.toLocaleString("vi-VN")} (đại lý)
            </div>
          </div>
        ) : null}
      </Section>

      <Section title="Tài khoản" subtitle="Admin điều chỉnh markup VND cố định/SIM trên từng tài khoản">
        {error ? <p className="error-text">{error}</p> : null}
        <table className="data-table">
          <thead>
            <tr>
              <th>Tài khoản</th>
              <th>Tên</th>
              <th>Cấp</th>
              <th>Markup (VND/SIM)</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <code>{u.username}</code>
                </td>
                <td>{u.displayName}</td>
                <td>{ROLE_LABELS[u.role]}</td>
                <td>
                  {u.role === "admin" ? (
                    <span className="muted">Giá gốc</span>
                  ) : (
                    <input
                      type="number"
                      step={100}
                      className="markup-input"
                      defaultValue={u.markupVnd}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v) && v !== u.markupVnd) {
                          void updateMarkup(u.id, v);
                        }
                      }}
                    />
                  )}
                </td>
                <td>{u.active ? "Hoạt động" : "Khóa"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Tạo tài khoản mới" subtitle="Gán cấp và markup ban đầu">
        <div className="admin-grid">
          <label>
            Tên đăng nhập
            <input
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            />
          </label>
          <label>
            Mật khẩu
            <input
              type="password"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            />
          </label>
          <label>
            Tên hiển thị
            <input
              value={newUser.displayName}
              onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
            />
          </label>
          <label>
            Cấp
            <select
              value={newUser.role}
              onChange={(e) =>
                setNewUser({ ...newUser, role: e.target.value as PublicUser["role"] })
              }
            >
              <option value="tong_kho">Tổng kho</option>
              <option value="dai_ly">Đại lý</option>
              <option value="admin">Quản trị</option>
            </select>
          </label>
          <label>
            Markup (VND/SIM)
            <input
              type="number"
              step={100}
              value={newUser.markupVnd}
              onChange={(e) =>
                setNewUser({ ...newUser, markupVnd: Number(e.target.value) || 0 })
              }
            />
          </label>
          <label>
            ID cấp trên (tùy chọn)
            <input
              value={newUser.parentId}
              onChange={(e) => setNewUser({ ...newUser, parentId: e.target.value })}
              placeholder="UUID cha"
            />
          </label>
        </div>
        <button type="button" onClick={() => void createAccount()}>
          Tạo tài khoản
        </button>
      </Section>
    </div>
  );
}
