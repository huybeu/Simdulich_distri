import { useEffect, useState } from "react";
import { Section } from "./Section";
import { apiGet, apiPatch } from "../lib/api";
import { notifySystemConfigUpdated } from "../lib/settings";

type SystemConfigForm = {
  merchantId: string;
  deptId: string;
  token: string;
  baseUrl: string;
  ntToVndRate: number;
};

/** Admin lưu API hệ thống — mọi tài khoản con dùng chung. */
export function SettingsTab() {
  const [settings, setSettings] = useState<SystemConfigForm>({
    merchantId: "",
    deptId: "",
    token: "",
    baseUrl: "https://fmshippingsys.fastmove.com.tw",
    ntToVndRate: 850,
  });
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [tokenSet, setTokenSet] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiGet<SystemConfigForm & { tokenSet?: boolean }>(
          "/admin/system-config",
        );
        setSettings({
          merchantId: data.merchantId,
          deptId: data.deptId,
          token: "",
          baseUrl: data.baseUrl,
          ntToVndRate: data.ntToVndRate,
        });
        setTokenSet(Boolean(data.tokenSet));
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Không tải được cấu hình.");
      }
    })();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!settings.merchantId && !settings.deptId) return;
      void (async () => {
        try {
          const body: Record<string, unknown> = {
            merchantId: settings.merchantId,
            deptId: settings.deptId,
            baseUrl: settings.baseUrl,
            ntToVndRate: settings.ntToVndRate,
          };
          if (settings.token.trim()) body.token = settings.token;
          await apiPatch("/admin/system-config", body);
          notifySystemConfigUpdated();
          setSavedHint(`Đã lưu lúc ${new Date().toLocaleTimeString()} — toàn hệ thống dùng chung.`);
          if (settings.token.trim()) setTokenSet(true);
        } catch (err) {
          setSavedHint(err instanceof Error ? err.message : "Lưu thất bại.");
        }
      })();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [settings]);

  function update<K extends keyof SystemConfigForm>(key: K, value: SystemConfigForm[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Section
      title="Cấu hình hệ thống Simdulich.vn"
      subtitle="Admin thiết lập một lần — tổng kho và đại lý đặt SIM qua cấu hình này"
    >
      {loadError ? <p className="error-text">{loadError}</p> : null}
      <p className="muted">
        Merchant / Base / Token áp dụng cho <strong>mọi tài khoản</strong>. Đại lý không thấy
        giá NT hay tỷ giá — chỉ giá VND trên màn hình đặt hàng.
      </p>

      <div className="settings-form">
        <label>
          MerchantId <span className="required">*</span>
          <input
            value={settings.merchantId}
            onChange={(e) => update("merchantId", e.target.value.trim())}
            placeholder="b000204"
            autoComplete="off"
          />
        </label>

        <label>
          DeptId <span className="required">*</span>
          <input
            value={settings.deptId}
            onChange={(e) => update("deptId", e.target.value.trim())}
            placeholder="000xxx"
            autoComplete="off"
          />
        </label>

        <label>
          Token <span className="required">*</span>
          <input
            type="password"
            value={settings.token}
            onChange={(e) => update("token", e.target.value)}
            placeholder={tokenSet ? "(đã lưu — nhập mới để đổi)" : "Token API"}
            autoComplete="off"
          />
        </label>

        <label>
          Base URL
          <input
            value={settings.baseUrl}
            onChange={(e) => update("baseUrl", e.target.value.trim())}
            placeholder="https://fmshippingsys.fastmove.com.tw"
          />
        </label>

        <label>
          Hệ số quy đổi giá sang VND (nội bộ, không hiển thị cho đại lý)
          <input
            type="number"
            min={1}
            value={settings.ntToVndRate}
            onChange={(e) => update("ntToVndRate", Number(e.target.value) || 850)}
          />
        </label>
      </div>

      {savedHint ? <p className="save-hint">{savedHint}</p> : null}

      <p className="muted">
        Đang dùng: <code>{settings.merchantId || "(chưa nhập)"}</code> · Base:{" "}
        <code>{settings.baseUrl || "..."}</code>
      </p>
    </Section>
  );
}
