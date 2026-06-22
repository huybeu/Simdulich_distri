import crypto from "node:crypto";
import type { PricingConfig, PublicUser, UserRecord, UserRole } from "../auth/types.js";
import { hashPassword } from "../auth/password.js";
import { readJson, writeJson } from "../store/jsonDb.js";
import { getPricingFromSystem, saveSystemConfig } from "./systemStore.js";

const USERS_FILE = "users.json";

type UserDb = { users: UserRecord[] };

function toPublic(user: UserRecord): PublicUser {
  const { passwordHash: _p, ...rest } = user;
  return rest;
}

export async function initializeStore(): Promise<void> {
  const db = await readJson<UserDb>(USERS_FILE, { users: [] });
  if (db.users.length === 0) {
    const adminHash = await hashPassword("admin123");
    const tongKhoHash = await hashPassword("tongkho123");
    const daiLyHash = await hashPassword("daily123");
    const adminId = crypto.randomUUID();
    const tongKhoId = crypto.randomUUID();
    const daiLyId = crypto.randomUUID();
    const now = new Date().toISOString();
    db.users = [
      {
        id: adminId,
        username: "admin",
        passwordHash: adminHash,
        role: "admin",
        displayName: "Quản trị viên",
        markupVnd: 0,
        parentId: null,
        active: true,
        createdAt: now,
      },
      {
        id: tongKhoId,
        username: "tongkho",
        passwordHash: tongKhoHash,
        role: "tong_kho",
        displayName: "Đại lý tổng kho",
        markupVnd: 0,
        parentId: adminId,
        active: true,
        createdAt: now,
      },
      {
        id: daiLyId,
        username: "daily",
        passwordHash: daiLyHash,
        role: "dai_ly",
        displayName: "Đại lý",
        markupVnd: 0,
        parentId: tongKhoId,
        active: true,
        createdAt: now,
      },
    ];
    await writeJson(USERS_FILE, db);
  }
}

async function loadUsers(): Promise<UserRecord[]> {
  const db = await readJson<UserDb>(USERS_FILE, { users: [] });
  return db.users;
}

async function saveUsers(users: UserRecord[]): Promise<void> {
  await writeJson(USERS_FILE, { users });
}

export async function findUserByUsername(
  username: string
): Promise<UserRecord | undefined> {
  const users = await loadUsers();
  return users.find(
    (u) => u.username.toLowerCase() === username.toLowerCase() && u.active
  );
}

export async function findUserById(
  id: string
): Promise<UserRecord | undefined> {
  const users = await loadUsers();
  return users.find((u) => u.id === id);
}

export async function listPublicUsers(): Promise<PublicUser[]> {
  const users = await loadUsers();
  return users.map(toPublic);
}

export async function getPricingConfig(): Promise<PricingConfig> {
  return getPricingFromSystem();
}

export async function savePricingConfig(
  pricing: PricingConfig,
): Promise<PricingConfig> {
  await saveSystemConfig({
    ntToVndRate: pricing.ntToVndRate,
    tierMarkupVnd: pricing.tierMarkupVnd,
    tierRate: pricing.tierRate,
    simTypeRate: pricing.simTypeRate,
    simTypeMarkupVnd: pricing.simTypeMarkupVnd,
  });
  return getPricingFromSystem();
}

/** Markup VND cố định/SIM áp dụng khi hiển thị giá (admin luôn 0 = giá gốc). */
export function resolveMarkupVnd(
  user: UserRecord,
  config: PricingConfig
): number {
  if (user.role === "admin") return 0;
  const vnd = user.markupVnd ?? 0;
  if (vnd !== 0) return vnd;
  return config.tierMarkupVnd[user.role as "tong_kho" | "dai_ly"] ?? 0;
}

/**
 * Hệ số × áp dụng cho cấp của user.
 * Ưu tiên: simTypeRate (theo loại SIM) > tierRate (theo cấp) > ntToVndRate chung.
 */
export function resolveRate(
  user: UserRecord,
  config: PricingConfig,
  leSIM?: boolean,
): number {
  if (user.role === "admin") {
    // Admin: simTypeRate > ntToVndRate
    if (leSIM === true) {
      const r = config.simTypeRate?.esim ?? 0;
      if (r > 0) return r;
    } else if (leSIM === false) {
      const r = config.simTypeRate?.sim_vat_ly ?? 0;
      if (r > 0) return r;
    }
    return config.ntToVndRate;
  }
  // Sub-accounts: simTypeRate > tierRate > ntToVndRate
  if (leSIM === true) {
    const r = config.simTypeRate?.esim ?? 0;
    if (r > 0) return r;
  } else if (leSIM === false) {
    const r = config.simTypeRate?.sim_vat_ly ?? 0;
    if (r > 0) return r;
  }
  const tier = config.tierRate?.[user.role as "tong_kho" | "dai_ly"] ?? 0;
  return tier > 0 ? tier : config.ntToVndRate;
}

/** @deprecated dùng resolveMarkupVnd */
export function resolveMarkupPercent(user: UserRecord, config: PricingConfig): number {
  return resolveMarkupVnd(user, config);
}

/** Markup VND cộng thêm riêng theo loại SIM (cộng thêm trên markupVnd của cấp). */
export function resolveSimTypeMarkup(config: PricingConfig, leSIM?: boolean): number {
  if (leSIM === true) return config.simTypeMarkupVnd?.esim ?? 0;
  if (leSIM === false) return config.simTypeMarkupVnd?.sim_vat_ly ?? 0;
  return 0;
}

export function applyDisplayMarkup(baseNt: number, rate: number, markupVnd: number): number {
  return Math.round(baseNt * rate) + markupVnd;
}

export async function createUser(input: {
  username: string;
  password: string;
  role: UserRole;
  displayName: string;
  markupVnd: number;
  parentId: string | null;
}): Promise<PublicUser> {
  const users = await loadUsers();
  if (users.some((u) => u.username.toLowerCase() === input.username.toLowerCase())) {
    throw new Error("USERNAME_EXISTS");
  }
  if (input.role !== "admin" && input.parentId) {
    const parent = users.find((u) => u.id === input.parentId);
    if (!parent) throw new Error("PARENT_NOT_FOUND");
  }
  const record: UserRecord = {
    id: crypto.randomUUID(),
    username: input.username.trim(),
    passwordHash: await hashPassword(input.password),
    role: input.role,
    displayName: input.displayName.trim() || input.username,
    markupVnd: input.markupVnd ?? 0,
    parentId: input.parentId,
    active: true,
    createdAt: new Date().toISOString(),
  };
  users.push(record);
  await saveUsers(users);
  return toPublic(record);
}

export async function updateUser(
  id: string,
  patch: Partial<{
    displayName: string;
    markupVnd: number;
    active: boolean;
    password: string;
    parentId: string | null;
  }>
): Promise<PublicUser | null> {
  const users = await loadUsers();
  const idx = users.findIndex((u) => u.id === id);
  if (idx < 0) return null;
  const user = users[idx];
  if (patch.displayName !== undefined) user.displayName = patch.displayName;
  if (patch.markupVnd !== undefined) user.markupVnd = patch.markupVnd;
  if (patch.active !== undefined) user.active = patch.active;
  if (patch.parentId !== undefined) user.parentId = patch.parentId;
  if (patch.password) user.passwordHash = await hashPassword(patch.password);
  users[idx] = user;
  await saveUsers(users);
  return toPublic(user);
}

export { toPublic };
