import { getSystemConfigSync } from "./services/systemStore.js";

export type WorldmoveCredentials = {
  merchantId: string;
  deptId: string;
  token: string;
  baseUrl: string;
};

/** Toàn hệ thống dùng cấu hình API do admin lưu trên server. */
export function getCredentialsFromRequest(): WorldmoveCredentials {
  const sys = getSystemConfigSync();
  return {
    merchantId: sys.merchantId,
    deptId: sys.deptId,
    token: sys.token,
    baseUrl: sys.baseUrl,
  };
}

export function assertCredentials(creds: WorldmoveCredentials): void {
  if (!creds.merchantId) {
    throw new Error("Admin chưa cấu hình MerchantId (tab Cấu hình).");
  }
  if (!creds.deptId) {
    throw new Error("Admin chưa cấu hình DeptId (tab Cấu hình).");
  }
  if (!creds.token) {
    throw new Error("Admin chưa cấu hình Token (tab Cấu hình).");
  }
}
