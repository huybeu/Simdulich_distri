import { Router } from "express";
import { verifyPassword } from "../auth/password.js";
import { createSession, deleteSession } from "../auth/session.js";
import type { AuthedRequest } from "../auth/middleware.js";
import { attachAuth, requireAuth } from "../auth/middleware.js";
import {
  findUserById,
  findUserByUsername,
  getPricingConfig,
  resolveMarkupVnd,
  resolveRate,
  toPublic,
} from "../services/userStore.js";

export const authRouter = Router();

authRouter.use(attachAuth);

authRouter.post("/login", async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "");
    if (!username || !password) {
      res.status(400).json({ error: "INVALID_INPUT", message: "Nhập tài khoản và mật khẩu." });
      return;
    }
    const user = await findUserByUsername(username);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      res.status(401).json({ error: "INVALID_CREDENTIALS", message: "Sai tài khoản hoặc mật khẩu." });
      return;
    }
    const token = await createSession(user.id);
    const config = await getPricingConfig();
    res.json({
      token,
      user: toPublic(user),
      pricing: {
        ntToVndRate: resolveRate(user, config),
        markupVnd: resolveMarkupVnd(user, config),
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", requireAuth, async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (token) await deleteSession(token);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const user = await findUserById(req.authUser!.id);
    if (!user) {
      res.status(401).json({ error: "UNAUTHORIZED" });
      return;
    }
    const config = await getPricingConfig();
    res.json({
      user: toPublic(user),
      pricing: {
        ntToVndRate: resolveRate(user, config),
        markupVnd: resolveMarkupVnd(user, config),
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
});
