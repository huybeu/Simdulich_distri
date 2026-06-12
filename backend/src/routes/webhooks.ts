import { Router } from "express";
import { config } from "../config.js";
import { encStrMatches } from "../worldmove/crypto.js";
import { signatures } from "../worldmove/signatures.js";
import { pushWebhookEvent } from "../services/eventStore.js";

export const webhooksRouter = Router();

/** Worldmove requires literal response body "1". */
function ackWorldmove(res: import("express").Response): void {
  res.type("text/plain").send("1");
}

webhooksRouter.post("/esim-order", (req, res) => {
  const body = req.body as {
    orderId?: string;
    orderSN?: string;
    orderTime?: string;
    itemList?: Array<{
      iccid: string;
      productName: string;
      redemptionCode: string;
    }>;
    encStr?: string;
  };

  const expected = signatures.esimOrderCallback(
    config.merchantId,
    body.orderId ?? "",
    body.orderSN ?? "",
    body.orderTime ?? "",
    body.itemList ?? [],
    config.token,
  );

  const signatureValid = encStrMatches(expected, body.encStr ?? "");
  pushWebhookEvent("esim-order", req.body, signatureValid);
  ackWorldmove(res);
});

webhooksRouter.post("/esim-order-redeem", (req, res) => {
  const body = req.body as {
    orderId?: string;
    itemList?: Array<{
      iccid: string;
      productName: string;
      rcode: string;
      qrcodeType: number;
      qrcode: string;
    }>;
    encStr?: string;
  };

  const expected = signatures.esimOrderRedeemCallback(
    config.merchantId,
    body.orderId ?? "",
    body.itemList ?? [],
    config.token,
  );

  const signatureValid = encStrMatches(expected, body.encStr ?? "");
  pushWebhookEvent("esim-order-redeem", req.body, signatureValid);
  ackWorldmove(res);
});

webhooksRouter.post("/redeem", (req, res) => {
  const body = req.body as {
    qrcode?: string;
    rcode?: string;
    qrcodeType?: number;
    encStr?: string;
  };

  const expected = signatures.redeemCallback(
    config.merchantId,
    body.qrcode ?? "",
    body.rcode ?? "",
    body.qrcodeType ?? 0,
    config.token,
  );

  const signatureValid = encStrMatches(expected, body.encStr ?? "");
  pushWebhookEvent("redeem", req.body, signatureValid);
  ackWorldmove(res);
});

webhooksRouter.post("/topup", (req, res) => {
  const body = req.body as {
    orderId?: string;
    itemList?: Array<{
      wmproductId: string;
      day: number;
      simNum: string;
    }>;
    encStr?: string;
  };

  const expected = signatures.depositCallback(
    config.merchantId,
    body.orderId ?? "",
    body.itemList ?? [],
    config.token,
  );

  const signatureValid = encStrMatches(expected, body.encStr ?? "");
  pushWebhookEvent("topup", req.body, signatureValid);
  ackWorldmove(res);
});
