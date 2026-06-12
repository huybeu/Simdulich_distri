/** API dùng cấu hình server (admin) — không gửi credential qua header trình duyệt. */
export function settingsHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
  };
}

export const SYSTEM_CONFIG_UPDATED_EVENT = "simdulich-system-config-updated";

export function notifySystemConfigUpdated(): void {
  window.dispatchEvent(new CustomEvent(SYSTEM_CONFIG_UPDATED_EVENT));
}
