import { Router } from "express";
import type { AuthedRequest } from "../auth/middleware.js";
import {
  createBatch,
  getBatchesForUser,
  getOrdersForUser,
  saveOrder,
  updateBatch,
  updateOrderPayment,
} from "../services/orderStore.js";

export const ordersRouter = Router();

ordersRouter.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const user = req.authUser!;
    const orders = await getOrdersForUser(user.id, user.role);
    res.json({ orders });
  } catch (err) {
    next(err);
  }
});

ordersRouter.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const user = req.authUser!;
    const body = req.body as {
      orderNumber: string;
      company: string;
      email: string;
      receiverEcid: string;
      prodList: Array<{ wmproductId: string; qty: number }>;
      quantity: number;
      ecommerceOrder: string;
      latestHistory: string;
      orderDate: string;
      worldmoveResponse: unknown;
    };

    const record = await saveOrder({
      userId: user.id,
      username: user.username,
      productType: "eSIM",
      status: "Success",
      ...body,
    });
    res.json(record);
  } catch (err) {
    next(err);
  }
});

/** Cập nhật trạng thái thanh toán — chỉ admin và tong_kho */
ordersRouter.patch("/:id/payment", async (req: AuthedRequest, res, next) => {
  try {
    const user = req.authUser!;
    if (user.role === "dai_ly") {
      res.status(403).json({ error: "FORBIDDEN" });
      return;
    }
    const { paymentStatus, paymentNote, totalAmount } = req.body as {
      paymentStatus?: string;
      paymentNote?: string;
      totalAmount?: number;
    };
    const updated = await updateOrderPayment(String(req.params.id), {
      paymentStatus: paymentStatus as "unpaid" | "partial" | "paid" | undefined,
      paymentNote,
      totalAmount: totalAmount !== undefined ? Number(totalAmount) : undefined,
    });
    if (!updated) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    res.json({ order: updated });
  } catch (err) {
    next(err);
  }
});

/** Lấy danh sách batch */
ordersRouter.get("/batches", async (req: AuthedRequest, res, next) => {
  try {
    const user = req.authUser!;
    if (user.role === "dai_ly") {
      res.status(403).json({ error: "FORBIDDEN" });
      return;
    }
    const batches = await getBatchesForUser(user.id, user.role);
    res.json({ batches });
  } catch (err) {
    next(err);
  }
});

/** Tạo batch mới */
ordersRouter.post("/batches", async (req: AuthedRequest, res, next) => {
  try {
    const user = req.authUser!;
    if (user.role === "dai_ly") {
      res.status(403).json({ error: "FORBIDDEN" });
      return;
    }
    const { name, orderIds, note } = req.body as {
      name: string;
      orderIds: string[];
      note?: string;
    };
    if (!name?.trim() || !Array.isArray(orderIds) || orderIds.length === 0) {
      res.status(400).json({ error: "INVALID_INPUT", message: "Cần tên batch và ít nhất 1 đơn hàng." });
      return;
    }
    const batch = await createBatch({
      name: name.trim(),
      orderIds,
      createdBy: user.id,
      createdByUsername: user.username,
      note,
    });
    res.status(201).json({ batch });
  } catch (err) {
    next(err);
  }
});

/** Cập nhật batch */
ordersRouter.patch("/batches/:id", async (req: AuthedRequest, res, next) => {
  try {
    const user = req.authUser!;
    if (user.role === "dai_ly") {
      res.status(403).json({ error: "FORBIDDEN" });
      return;
    }
    const { name, note, closed } = req.body as {
      name?: string;
      note?: string;
      closed?: boolean;
    };
    const updated = await updateBatch(String(req.params.id), { name, note, closed });
    if (!updated) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    res.json({ batch: updated });
  } catch (err) {
    next(err);
  }
});
