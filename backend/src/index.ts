import cors from "cors";
import express from "express";
import { attachAuth } from "./auth/middleware.js";
import { config } from "./config.js";
import { adminRouter } from "./routes/admin.js";
import { apiRouter } from "./routes/api.js";
import { authRouter } from "./routes/auth.js";
import { initializeSystemStore } from "./services/systemStore.js";
import { initializeStore } from "./services/userStore.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { ordersRouter } from "./routes/orders.js";
import { manageRouter } from "./routes/manage.js";
import { WorldmoveApiError } from "./worldmove/client.js";
import { requireAuth } from "./auth/middleware.js";
import { addSseClient } from "./services/eventBus.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(attachAuth);

// SSE: tất cả client đã đăng nhập subscribe để nhận cập nhật giá real-time
app.get("/api/events", requireAuth, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  // keepalive ping mỗi 25s để không bị proxy/browser timeout
  const ping = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { clearInterval(ping); }
  }, 25_000);
  res.on("close", () => clearInterval(ping));
  addSseClient(res);
});

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/orders", requireAuth, ordersRouter);
app.use("/api/manage", requireAuth, manageRouter);
app.use("/api", requireAuth, apiRouter);
app.use("/webhooks/worldmove", webhooksRouter);

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (error instanceof WorldmoveApiError) {
      res.status(error.status).json({
        code: 999,
        msg: error.message,
        details: error.body,
      });
      return;
    }

    const message =
      error instanceof Error ? error.message : "Unknown server error";
    res.status(400).json({ code: 400, msg: message });
  },
);

await initializeSystemStore();
await initializeStore();

app.listen(config.port, () => {
  console.log(`Simdulich.vn backend listening on http://localhost:${config.port}`);
  console.log("Tài khoản mẫu: admin/admin123, tongkho/tongkho123, daily/daily123");
  console.log("Webhook endpoints:");
  console.log(`  POST http://localhost:${config.port}/webhooks/worldmove/esim-order`);
  console.log(
    `  POST http://localhost:${config.port}/webhooks/worldmove/esim-order-redeem`,
  );
  console.log(`  POST http://localhost:${config.port}/webhooks/worldmove/redeem`);
  console.log(`  POST http://localhost:${config.port}/webhooks/worldmove/topup`);
});
