export type UserRole = "admin" | "tong_kho" | "dai_ly";

export type UserRecord = {
  id: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  displayName: string;
  /** Markup cố định VND thêm vào mỗi SIM (admin chỉnh theo tài khoản). */
  markupVnd: number;
  /** @deprecated dùng markupVnd thay thế */
  markupPercent?: number;
  parentId: string | null;
  active: boolean;
  createdAt: string;
};

export type PricingConfig = {
  ntToVndRate: number;
  /** Markup mặc định theo cấp (VND/SIM) nếu tài khoản chưa có markup riêng. */
  tierMarkupVnd: Record<Exclude<UserRole, "admin">, number>;
  /** Hệ số × riêng theo cấp — 0 nghĩa là dùng ntToVndRate chung. */
  tierRate: Record<Exclude<UserRole, "admin">, number>;
};

export type SessionRecord = {
  token: string;
  userId: string;
  expiresAt: number;
};

export type PublicUser = Omit<UserRecord, "passwordHash">;

export type AuthUser = PublicUser;
