import { Router } from "express";
import type { AuthedRequest } from "../auth/middleware.js";
import { createUser, listPublicUsers, updateUser } from "../services/userStore.js";

export const manageRouter = Router();

/** Tổng kho xem danh sách đại lý của mình. Admin xem tất cả. */
manageRouter.get("/users", async (req: AuthedRequest, res, next) => {
  try {
    const user = req.authUser!;
    const all = await listPublicUsers();
    if (user.role === "admin") {
      res.json({ users: all });
      return;
    }
    // tong_kho chỉ thấy đại lý trực tiếp của mình
    const children = all.filter((u) => u.parentId === user.id);
    res.json({ users: children });
  } catch (err) {
    next(err);
  }
});

/** Tổng kho tạo đại lý. Admin tạo tổng kho hoặc đại lý. */
manageRouter.post("/users", async (req: AuthedRequest, res, next) => {
  try {
    const user = req.authUser!;
    const { username, password, displayName, markupVnd } = req.body as {
      username: string;
      password: string;
      displayName?: string;
      markupVnd?: number;
    };

    if (!username?.trim() || !password) {
      res.status(400).json({ error: "INVALID_INPUT", message: "Thiếu username hoặc password." });
      return;
    }

    let role: "tong_kho" | "dai_ly";
    let parentId: string | null;

    if (user.role === "admin") {
      // Admin tạo tổng kho (parentId = admin id)
      role = "tong_kho";
      parentId = user.id;
    } else {
      // tong_kho tạo đại lý (parentId = tong_kho id)
      role = "dai_ly";
      parentId = user.id;
    }

    const created = await createUser({
      username: username.trim(),
      password,
      role,
      displayName: displayName?.trim() || username.trim(),
      markupVnd: Number.isFinite(Number(markupVnd)) ? Number(markupVnd) : 8,
      parentId,
    });
    res.status(201).json({ user: created });
  } catch (err) {
    if (err instanceof Error && err.message === "USERNAME_EXISTS") {
      res.status(409).json({ error: "USERNAME_EXISTS", message: "Tên đăng nhập đã tồn tại." });
      return;
    }
    next(err);
  }
});

/** Cập nhật markup đại lý cấp dưới. */
manageRouter.patch("/users/:id", async (req: AuthedRequest, res, next) => {
  try {
    const requester = req.authUser!;
    const all = await listPublicUsers();
    const target = all.find((u) => u.id === req.params.id);

    if (!target) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }

    // Chỉ được chỉnh tài khoản con trực tiếp của mình
    if (requester.role !== "admin" && target.parentId !== requester.id) {
      res.status(403).json({ error: "FORBIDDEN", message: "Không có quyền chỉnh tài khoản này." });
      return;
    }

    const patch: { markupVnd?: number; active?: boolean; password?: string } = {};
    if (req.body?.markupVnd !== undefined) patch.markupVnd = Number(req.body.markupVnd);
    if (req.body?.active !== undefined) patch.active = Boolean(req.body.active);
    if (req.body?.password) patch.password = String(req.body.password);

    const updated = await updateUser(String(req.params.id), patch);
    res.json({ user: updated });
  } catch (err) {
    next(err);
  }
});
