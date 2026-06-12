import type { NextFunction, Request, Response } from "express";
import type { AuthUser } from "./types.js";
import { getSessionUserId } from "./session.js";
import { findUserById, toPublic } from "../services/userStore.js";

export type AuthedRequest = Request & { authUser?: AuthUser };

function bearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7).trim();
  // SSE: EventSource không gửi được header, cho phép token qua query string
  const q = req.query?.token;
  if (typeof q === "string" && q) return q;
  return undefined;
}

export async function attachAuth(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = bearerToken(req);
    const userId = await getSessionUserId(token);
    if (!userId) {
      next();
      return;
    }
    const user = await findUserById(userId);
    if (!user || !user.active) {
      next();
      return;
    }
    req.authUser = toPublic(user);
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.authUser) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Vui lòng đăng nhập." });
    return;
  }
  next();
}

export function requireAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.authUser || req.authUser.role !== "admin") {
    res.status(403).json({ error: "FORBIDDEN", message: "Chỉ admin được phép." });
    return;
  }
  next();
}
