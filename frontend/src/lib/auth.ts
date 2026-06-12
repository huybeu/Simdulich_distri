const AUTH_TOKEN_KEY = "worldmove-auth-token-v1";

export type UserRole = "admin" | "tong_kho" | "dai_ly";

export type AuthUser = {
  id: string;
  username: string;
  role: UserRole;
  displayName: string;
  markupVnd: number;
  parentId: string | null;
  active: boolean;
  createdAt: string;
};

export type PricingProfile = {
  ntToVndRate: number;
  markupVnd: number;
  role: UserRole;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
  pricing: PricingProfile;
};

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/**
 * Giá VND hiển thị = giá gốc NT × tỷ giá + markup VND cố định.
 * (admin markupVnd = 0 → giá gốc quy VND)
 */
export function applyMarkupVnd(baseNt: number, rate: number, markupVnd: number): number {
  return Math.round(baseNt * rate) + markupVnd;
}

/** @deprecated dùng applyMarkupVnd */
export function applyMarkupNt(baseNt: number, _markupPercent: number): number {
  return baseNt;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Quản trị",
  tong_kho: "Tổng kho",
  dai_ly: "Đại lý",
};

/** Tổng kho / đại lý chỉ đặt SIM — giao diện rút gọn 2 tab. */
export function isOrderOnlyRole(role: UserRole): boolean {
  return role === "tong_kho" || role === "dai_ly";
}
