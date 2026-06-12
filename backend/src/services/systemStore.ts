import type { PricingConfig, UserRole } from "../auth/types.js";
import { config } from "../config.js";
import { readJson, writeJson } from "../store/jsonDb.js";

const SYSTEM_FILE = "system.json";
const LEGACY_PRICING_FILE = "pricing.json";

export type SystemConfig = {
  merchantId: string;
  deptId: string;
  token: string;
  baseUrl: string;
  ntToVndRate: number;
  tierMarkupVnd: PricingConfig["tierMarkupVnd"];
  tierRate: PricingConfig["tierRate"];
  /** @deprecated dùng tierMarkupVnd */
  tierMarkupPercent?: { tong_kho: number; dai_ly: number };
};

const DEFAULT_SYSTEM: SystemConfig = {
  merchantId: config.merchantId,
  deptId: config.deptId,
  token: config.token,
  baseUrl: config.worldmoveBaseUrl,
  ntToVndRate: 850,
  tierMarkupVnd: { tong_kho: 0, dai_ly: 0 },
  tierRate: { tong_kho: 0, dai_ly: 0 },
};

let cache: SystemConfig = { ...DEFAULT_SYSTEM };

function normalize(input: Partial<SystemConfig>): SystemConfig {
  const rate = Number(input.ntToVndRate);
  // Migration: n\u1EBFu ch\u1EC9 c\u00F3 tierMarkupPercent (d\u1EEF li\u1EC7u c\u0169) th\u00EC d\u00F9ng 0 cho VND
  const legacyVnd = { tong_kho: 0, dai_ly: 0 };
  return {
    merchantId: (input.merchantId ?? cache.merchantId).trim().replace(/^\uFEFF/, ""),
    deptId: (input.deptId ?? cache.deptId).trim().replace(/^\uFEFF/, ""),
    token: (input.token ?? cache.token).trim().replace(/^\uFEFF/, ""),
    baseUrl:
      (input.baseUrl ?? cache.baseUrl).trim() || DEFAULT_SYSTEM.baseUrl,
    ntToVndRate:
      Number.isFinite(rate) && rate > 0 ? rate : cache.ntToVndRate || DEFAULT_SYSTEM.ntToVndRate,
    tierMarkupVnd: {
      tong_kho:
        input.tierMarkupVnd?.tong_kho ?? cache.tierMarkupVnd?.tong_kho ?? legacyVnd.tong_kho,
      dai_ly:
        input.tierMarkupVnd?.dai_ly ?? cache.tierMarkupVnd?.dai_ly ?? legacyVnd.dai_ly,
    },
    tierRate: {
      tong_kho: Number(input.tierRate?.tong_kho ?? cache.tierRate?.tong_kho ?? 0),
      dai_ly:   Number(input.tierRate?.dai_ly   ?? cache.tierRate?.dai_ly   ?? 0),
    },
  };
}

export function getSystemConfigSync(): SystemConfig {
  return cache;
}

export async function reloadSystemConfig(): Promise<SystemConfig> {
  const stored = await readJson<Partial<SystemConfig> | null>(SYSTEM_FILE, null);
  if (stored) {
    cache = normalize({ ...DEFAULT_SYSTEM, ...stored });
    return cache;
  }
  const legacy = await readJson<Partial<PricingConfig> | null>(LEGACY_PRICING_FILE, null);
  if (legacy) {
    cache = normalize({
      ...DEFAULT_SYSTEM,
      ntToVndRate: legacy.ntToVndRate,
    });
    await writeJson(SYSTEM_FILE, cache);
    return cache;
  }
  cache = { ...DEFAULT_SYSTEM };
  await writeJson(SYSTEM_FILE, cache);
  return cache;
}

export async function saveSystemConfig(
  patch: Partial<SystemConfig>,
): Promise<SystemConfig> {
  const next = normalize({ ...cache, ...patch });
  if (patch.token === "" || patch.token === undefined) {
    next.token = cache.token;
  }
  cache = next;
  await writeJson(SYSTEM_FILE, cache);
  return cache;
}

export async function initializeSystemStore(): Promise<void> {
  await reloadSystemConfig();
}

export function getPricingFromSystem(): PricingConfig {
  return {
    ntToVndRate: cache.ntToVndRate,
    tierMarkupVnd: cache.tierMarkupVnd,
    tierRate: cache.tierRate ?? { tong_kho: 0, dai_ly: 0 },
  };
}

export type SystemConfigPublic = {
  merchantId: string;
  deptId: string;
  baseUrl: string;
  ntToVndRate: number;
  tierMarkupVnd: PricingConfig["tierMarkupVnd"];
  tierRate: PricingConfig["tierRate"];
  configured: boolean;
  tokenSet: boolean;
};

export function toPublicSystemConfig(): SystemConfigPublic {
  return {
    merchantId: cache.merchantId,
    deptId: cache.deptId,
    baseUrl: cache.baseUrl,
    ntToVndRate: cache.ntToVndRate,
    tierMarkupVnd: cache.tierMarkupVnd,
    tierRate: cache.tierRate ?? { tong_kho: 0, dai_ly: 0 },
    configured: Boolean(cache.merchantId && cache.deptId && cache.token),
    tokenSet: Boolean(cache.token),
  };
}

export type SystemConfigAdmin = SystemConfigPublic & {
  token: string;
};

export function toAdminSystemConfig(): SystemConfigAdmin {
  return {
    ...toPublicSystemConfig(),
    token: cache.token,
  };
}
