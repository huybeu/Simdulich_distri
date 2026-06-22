import { Router } from "express";
import type { UserRole } from "../auth/types.js";
import type { AuthedRequest } from "../auth/middleware.js";
import { requireAdmin, requireAuth } from "../auth/middleware.js";
import {
  saveSystemConfig,
  toAdminSystemConfig,
} from "../services/systemStore.js";
import {
  createUser,
  getPricingConfig,
  listPublicUsers,
  savePricingConfig,
  updateUser,
} from "../services/userStore.js";
import { broadcastEvent } from "../services/eventBus.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

const ROLES: UserRole[] = ["admin", "tong_kho", "dai_ly"];

adminRouter.get("/users", async (_req, res, next) => {
  try {
    const users = await listPublicUsers();
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

adminRouter.post("/users", async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "");
    const role = req.body?.role as UserRole;
    const displayName = String(req.body?.displayName ?? "").trim();
    const markupVnd = Number(req.body?.markupVnd ?? 0);
    const parentId =
      req.body?.parentId === null || req.body?.parentId === ""
        ? null
        : String(req.body?.parentId);

    if (!username || !password || !ROLES.includes(role)) {
      res.status(400).json({ error: "INVALID_INPUT", message: "Thiếu thông tin tài khoản." });
      return;
    }
    if (role === "admin" && (await listPublicUsers()).some((u) => u.role === "admin")) {
      // Cho phép nhiều admin nếu cần — bỏ giới hạn
    }

    const user = await createUser({
      username,
      password,
      role,
      displayName: displayName || username,
      markupVnd: Number.isFinite(markupVnd) ? markupVnd : 0,
      parentId: role === "admin" ? null : parentId,
    });
    res.status(201).json({ user });
  } catch (err) {
    if (err instanceof Error && err.message === "USERNAME_EXISTS") {
      res.status(409).json({ error: "USERNAME_EXISTS", message: "Tên đăng nhập đã tồn tại." });
      return;
    }
    next(err);
  }
});

adminRouter.patch("/users/:id", async (req, res, next) => {
  try {
    const patch: Parameters<typeof updateUser>[1] = {};
    if (req.body?.displayName !== undefined) {
      patch.displayName = String(req.body.displayName);
    }
    if (req.body?.markupVnd !== undefined) {
      patch.markupVnd = Number(req.body.markupVnd);
    }
    if (req.body?.active !== undefined) {
      patch.active = Boolean(req.body.active);
    }
    if (req.body?.password) {
      patch.password = String(req.body.password);
    }
    if (req.body?.parentId !== undefined) {
      patch.parentId =
        req.body.parentId === null || req.body.parentId === ""
          ? null
          : String(req.body.parentId);
    }

    const user = await updateUser(req.params.id, patch);
    if (!user) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    if (patch.markupVnd !== undefined) {
      broadcastEvent("pricing-updated", { userId: req.params.id });
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/system-config", async (_req, res, next) => {
  try {
    res.json(toAdminSystemConfig());
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/system-config", async (req, res, next) => {
  try {
    const current = toAdminSystemConfig();
    const patch: Parameters<typeof saveSystemConfig>[0] = {};
    if (req.body?.merchantId !== undefined) patch.merchantId = String(req.body.merchantId);
    if (req.body?.deptId !== undefined) patch.deptId = String(req.body.deptId);
    if (req.body?.token !== undefined && String(req.body.token).trim()) {
      patch.token = String(req.body.token);
    }
    if (req.body?.baseUrl !== undefined) patch.baseUrl = String(req.body.baseUrl);
    if (req.body?.ntToVndRate !== undefined) {
      patch.ntToVndRate = Number(req.body.ntToVndRate);
    }
    if (req.body?.tierMarkupVnd) {
      patch.tierMarkupVnd = { ...current.tierMarkupVnd };
      if (req.body.tierMarkupVnd.tong_kho !== undefined) {
        patch.tierMarkupVnd.tong_kho = Number(req.body.tierMarkupVnd.tong_kho);
      }
      if (req.body.tierMarkupVnd.dai_ly !== undefined) {
        patch.tierMarkupVnd.dai_ly = Number(req.body.tierMarkupVnd.dai_ly);
      }
    }
    await saveSystemConfig(patch);
    res.json(toAdminSystemConfig());
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/pricing-config", async (_req, res, next) => {
  try {
    const config = await getPricingConfig();
    res.json(config);
  } catch (err) {
    next(err);
  }
});

adminRouter.patch("/pricing-config", async (req: AuthedRequest, res, next) => {
  try {
    const current = await getPricingConfig();
    const ntToVndRate =
      req.body?.ntToVndRate !== undefined
        ? Number(req.body.ntToVndRate)
        : current.ntToVndRate;
    const tierMarkupVnd = { ...current.tierMarkupVnd };
    if (req.body?.tierMarkupVnd) {
      if (req.body.tierMarkupVnd.tong_kho !== undefined)
        tierMarkupVnd.tong_kho = Number(req.body.tierMarkupVnd.tong_kho);
      if (req.body.tierMarkupVnd.dai_ly !== undefined)
        tierMarkupVnd.dai_ly = Number(req.body.tierMarkupVnd.dai_ly);
    }
    const tierRate = { ...(current.tierRate ?? { tong_kho: 0, dai_ly: 0 }) };
    if (req.body?.tierRate) {
      if (req.body.tierRate.tong_kho !== undefined)
        tierRate.tong_kho = Number(req.body.tierRate.tong_kho);
      if (req.body.tierRate.dai_ly !== undefined)
        tierRate.dai_ly = Number(req.body.tierRate.dai_ly);
    }
    const simTypeRate = { ...(current.simTypeRate ?? { esim: 0, sim_vat_ly: 0 }) };
    if (req.body?.simTypeRate) {
      if (req.body.simTypeRate.esim !== undefined)
        simTypeRate.esim = Number(req.body.simTypeRate.esim);
      if (req.body.simTypeRate.sim_vat_ly !== undefined)
        simTypeRate.sim_vat_ly = Number(req.body.simTypeRate.sim_vat_ly);
    }
    const simTypeMarkupVnd = { ...(current.simTypeMarkupVnd ?? { esim: 0, sim_vat_ly: 0 }) };
    if (req.body?.simTypeMarkupVnd) {
      if (req.body.simTypeMarkupVnd.esim !== undefined)
        simTypeMarkupVnd.esim = Number(req.body.simTypeMarkupVnd.esim);
      if (req.body.simTypeMarkupVnd.sim_vat_ly !== undefined)
        simTypeMarkupVnd.sim_vat_ly = Number(req.body.simTypeMarkupVnd.sim_vat_ly);
    }
    const saved = await savePricingConfig({
      ntToVndRate: Number.isFinite(ntToVndRate) ? ntToVndRate : current.ntToVndRate,
      tierMarkupVnd,
      tierRate,
      simTypeRate,
      simTypeMarkupVnd,
    });
    broadcastEvent("pricing-updated", { ntToVndRate: saved.ntToVndRate });
    res.json(saved);
  } catch (err) {
    next(err);
  }
});
