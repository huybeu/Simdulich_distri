import { Router, type Request } from "express";
import {
  assertCredentials,
  getCredentialsFromRequest,
  type WorldmoveCredentials,
} from "../credentials.js";
import { extractCatalogProducts } from "../worldmove/catalog.js";
import { postWorldmove } from "../worldmove/client.js";
import { signatures } from "../worldmove/signatures.js";
import { listWebhookEvents } from "../services/eventStore.js";
import {
  assertDepositRules,
  assertEsimQtyLimit,
  assertRequired,
  assertSimNumFormat,
} from "../validators.js";

export const apiRouter = Router();

function credsOf(_req: Request): WorldmoveCredentials {
  const creds = getCredentialsFromRequest();
  assertCredentials(creds);
  return creds;
}

function withMerchant<T extends Record<string, unknown>>(
  creds: WorldmoveCredentials,
  payload: T,
): T & { merchantId: string } {
  return { ...payload, merchantId: creds.merchantId };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractRcodes(input: unknown): string[] {
  const out: string[] = [];
  function walk(node: unknown): void {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    const redemptionCode = obj.redemptionCode;
    if (typeof redemptionCode === "string" && redemptionCode.trim()) {
      out.push(redemptionCode.trim());
    }
    const rcode = obj.rcode;
    if (typeof rcode === "string" && rcode.trim()) {
      out.push(rcode.trim());
    }
    Object.values(obj).forEach(walk);
  }
  walk(input);
  return Array.from(new Set(out));
}

apiRouter.get("/health", (_req, res) => {
  const creds = getCredentialsFromRequest();
  res.json({
    ok: true,
    merchantId: creds.merchantId || null,
    deptId: creds.deptId || null,
    configured: Boolean(creds.merchantId && creds.deptId && creds.token),
    baseUrl: creds.baseUrl,
  });
});

apiRouter.get("/webhook-events", (_req, res) => {
  res.json({ events: listWebhookEvents() });
});

async function fetchQuoteCatalog(creds: WorldmoveCredentials) {
  const body = withMerchant(creds, {
    encStr: signatures.myQueryAll(creds.merchantId, creds.token),
  });
  const data = await postWorldmove("/Api/QuoteMg/myQueryAll", body, creds);
  const prodList = extractCatalogProducts(data);
  return { raw: data, prodList, esimProducts: prodList.filter((p) => p.leSIM) };
}

apiRouter.get("/catalog", async (req, res, next) => {
  try {
    const creds = credsOf(req);
    const { prodList, esimProducts, raw } = await fetchQuoteCatalog(creds);
    res.json({
      prodList,
      esimProducts,
      count: prodList.length,
      esimCount: esimProducts.length,
      code: (raw as { code?: number })?.code,
      msg: (raw as { msg?: string })?.msg,
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/quotes", async (req, res, next) => {
  try {
    const creds = credsOf(req);
    const { raw, prodList } = await fetchQuoteCatalog(creds);
    res.json({ ...(raw as object), prodList });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/esim/order", async (req, res, next) => {
  try {
    const creds = credsOf(req);
    const { email, prodList, systemMail, receiverEcid } = req.body as {
      email: string;
      prodList: Array<{ wmproductId: string; qty: number }>;
      systemMail?: boolean;
      receiverEcid?: string; // Mã E-commerce Order (tên đơn hàng sàn TMĐT)
    };

    assertRequired(email, "Email");
    assertEsimQtyLimit(prodList);

    const body = withMerchant(creds, {
      deptId: creds.deptId,
      email,
      prodList,
      ...(systemMail === undefined ? {} : { systemMail }),
      ...(receiverEcid !== undefined ? { receiverEcid } : {}),
      encStr: signatures.buyEsim(
        creds.merchantId,
        creds.deptId,
        email,
        prodList,
        creds.token,
      ),
    });

    const data = await postWorldmove("/Api/SOrder/mybuyesim", body, creds);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/esim/order-with-qr", async (req, res, next) => {
  try {
    const creds = credsOf(req);
    const { email, prodList, systemMail, qrcodeType, receiverEcid } = req.body as {
      email: string;
      prodList: Array<{ wmproductId: string; qty: number }>;
      systemMail?: boolean;
      qrcodeType?: number;
      receiverEcid?: string; // Mã E-commerce Order (tên đơn hàng sàn TMĐT)
    };

    assertRequired(email, "Email");
    assertEsimQtyLimit(prodList);
    const qrType = Number.isFinite(Number(qrcodeType)) ? Number(qrcodeType) : 2;

    const orderBody = withMerchant(creds, {
      deptId: creds.deptId,
      email,
      prodList,
      ...(systemMail === undefined ? {} : { systemMail }),
      ...(receiverEcid !== undefined ? { receiverEcid } : {}),
      encStr: signatures.buyEsim(
        creds.merchantId,
        creds.deptId,
        email,
        prodList,
        creds.token,
      ),
    });

    const orderData = await postWorldmove("/Api/SOrder/mybuyesim", orderBody, creds);
    const orderBase =
      orderData && typeof orderData === "object"
        ? (orderData as Record<string, unknown>)
        : {};
    const orderId = (orderData as { orderId?: string }).orderId ?? "";

    if (!orderId) {
      res.json({ ...orderBase, qrReady: false, qrMessage: "Đơn tạo thành công, chưa có orderId để lấy QR." });
      return;
    }

    let rcodes: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      const queryBody = withMerchant(creds, {
        orderId,
        encStr: signatures.queryBuyEsim(creds.merchantId, orderId, creds.token),
      });
      const queryData = await postWorldmove("/Api/SOrder/querybuyesim", queryBody, creds);
      rcodes = extractRcodes(queryData);
      if (rcodes.length > 0) break;
      await sleep(1200);
    }

    if (rcodes.length === 0) {
      res.json({
        ...orderBase,
        orderId,
        qrReady: false,
        qrMessage: "Đơn đã tạo, chưa có redemption code ngay. Vui lòng thử Redeem sau vài giây.",
      });
      return;
    }

    const redeemResults: unknown[] = [];
    for (const rcode of rcodes.slice(0, 5)) {
      const redeemBody = withMerchant(creds, {
        rcode,
        qrcodeType: qrType,
        encStr: signatures.redeem(creds.merchantId, rcode, qrType, creds.token),
      });
      const redeemData = await postWorldmove("/Api/OrderRedemption/redemption", redeemBody, creds);
      redeemResults.push(redeemData);
    }

    res.json({
      ...orderBase,
      orderId,
      qrReady: true,
      rcodes,
      redeemResults,
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/esim/query", async (req, res, next) => {
  try {
    const creds = credsOf(req);
    const { orderId } = req.body as { orderId: string };
    assertRequired(orderId, "orderId");

    const body = withMerchant(creds, {
      orderId,
      encStr: signatures.queryBuyEsim(creds.merchantId, orderId, creds.token),
    });

    const data = await postWorldmove("/Api/SOrder/querybuyesim", body, creds);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/esim/order-redeem", async (req, res, next) => {
  try {
    const creds = credsOf(req);
    const { qrcodeType, prodList } = req.body as {
      qrcodeType: number;
      prodList: Array<{ wmproductId: string; qty: number }>;
    };

    assertEsimQtyLimit(prodList);

    const body = withMerchant(creds, {
      deptId: creds.deptId,
      qrcodeType,
      prodList,
      encStr: signatures.buyEsimRedemption(
        creds.merchantId,
        creds.deptId,
        qrcodeType,
        prodList,
        creds.token,
      ),
    });

    const data = await postWorldmove(
      "/Api/SOrder/mybuyesimRedemption",
      body,
      creds,
    );
    res.json(data);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/redeem", async (req, res, next) => {
  try {
    const creds = credsOf(req);
    const { rcode, qrcodeType } = req.body as {
      rcode: string;
      qrcodeType: number;
    };
    assertRequired(rcode, "rcode");

    const body = withMerchant(creds, {
      rcode,
      qrcodeType,
      encStr: signatures.redeem(
        creds.merchantId,
        rcode,
        qrcodeType,
        creds.token,
      ),
    });

    const data = await postWorldmove("/Api/OrderRedemption/redemption", body, creds);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/sim/buy", async (req, res, next) => {
  try {
    const creds = credsOf(req);
    const payload = req.body as {
      invoiceType: number;
      taxId: string;
      receivingName: string;
      receivingTel: string;
      receivingAdd: string;
      note: string;
      prodList: Array<{
        productId: string;
        productName: string;
        qty: number;
      }>;
    };

    if (payload.taxId === undefined || payload.note === undefined) {
      throw new Error("taxId và note là bắt buộc (có thể để chuỗi rỗng).");
    }

    const body = withMerchant(creds, {
      deptId: creds.deptId,
      ...payload,
      encStr: signatures.buySim(
        creds.merchantId,
        creds.deptId,
        payload.invoiceType,
        payload.taxId,
        payload.receivingName,
        payload.receivingTel,
        payload.receivingAdd,
        payload.note,
        payload.prodList,
        creds.token,
      ),
    });

    const data = await postWorldmove("/Api/SOrder/mybuysim", body, creds);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/deposit", async (req, res, next) => {
  try {
    const creds = credsOf(req);
    const { prodList } = req.body as {
      prodList: Array<{ wmproductId: string; day: number; simNum: string }>;
    };

    assertDepositRules(prodList);

    const body = withMerchant(creds, {
      deptId: creds.deptId,
      prodList,
      encStr: signatures.deposit(
        creds.merchantId,
        creds.deptId,
        prodList,
        creds.token,
      ),
    });

    const data = await postWorldmove("/Api/SOrder/mydeposit", body, creds);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/sim/remote-activate", async (req, res, next) => {
  try {
    const creds = credsOf(req);
    const { simNum, orderId, mcc } = req.body as {
      simNum: string;
      orderId: string;
      mcc: string;
    };

    assertRequired(simNum, "simNum");
    assertRequired(orderId, "orderId");
    assertRequired(mcc, "mcc");

    const body = withMerchant(creds, {
      simNum,
      orderId,
      mcc,
      encStr: signatures.remoteActiv(
        creds.merchantId,
        simNum,
        orderId,
        mcc,
        creds.token,
      ),
    });

    const data = await postWorldmove("/Api/SimOperate/simRemoteActiv", body, creds);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/sim/traffic-reset", async (req, res, next) => {
  try {
    const creds = credsOf(req);
    const { simNum, orderId } = req.body as { simNum: string; orderId: string };
    assertRequired(simNum, "simNum");
    assertRequired(orderId, "orderId");

    const body = withMerchant(creds, {
      simNum,
      orderId,
      encStr: signatures.trafficReset(
        creds.merchantId,
        simNum,
        orderId,
        creds.token,
      ),
    });

    const data = await postWorldmove("/Api/SimOperate/simTrafficReset", body, creds);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/query/usage", async (req, res, next) => {
  try {
    const creds = credsOf(req);
    const payload = req.body as {
      simNum?: string;
      rcode?: string;
      orderId?: string;
      iccid?: string;
      cid?: string;
    };

    let encStr: string;
    if (payload.simNum) {
      assertRequired(payload.orderId ?? "", "orderId");
      encStr = signatures.queryUsageBySim(
        creds.merchantId,
        payload.simNum,
        payload.orderId ?? "",
        creds.token,
      );
    } else if (payload.rcode) {
      encStr = signatures.queryByRcode(
        creds.merchantId,
        payload.rcode,
        creds.token,
      );
    } else {
      throw new Error("Cần simNum (kèm orderId) hoặc rcode để tra cứu.");
    }

    const body = withMerchant(creds, { ...payload, encStr });
    const data = await postWorldmove("/Api/UseageDetail/queryUsage", body, creds);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/query/basic-info", async (req, res, next) => {
  try {
    const creds = credsOf(req);
    const { rcode, iccid, cid } = req.body as {
      rcode?: string;
      iccid?: string;
      cid?: string;
    };

    const key = rcode ?? iccid ?? cid;
    if (!key) {
      throw new Error("Cần một trong: rcode, iccid, cid.");
    }

    const body = withMerchant(creds, {
      rcode,
      iccid,
      cid,
      encStr: signatures.queryByRcode(creds.merchantId, key, creds.token),
    });

    const data = await postWorldmove("/Api/UseageDetail/queryBasicInfo", body, creds);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/query/esim-progress", async (req, res, next) => {
  try {
    const creds = credsOf(req);
    const { rcode, iccid, cid } = req.body as {
      rcode?: string;
      iccid?: string;
      cid?: string;
    };

    const key = rcode ?? iccid ?? cid;
    if (!key) {
      throw new Error("Cần một trong: rcode, iccid, cid.");
    }

    const body = withMerchant(creds, {
      rcode,
      iccid,
      cid,
      encStr: signatures.queryByRcode(creds.merchantId, key, creds.token),
    });

    const data = await postWorldmove(
      "/Api/UseageDetail/queryEsimProgresses",
      body,
      creds,
    );
    res.json(data);
  } catch (error) {
    next(error);
  }
});

apiRouter.post("/sim/exists", async (req, res, next) => {
  try {
    const creds = credsOf(req);
    const { simNum } = req.body as { simNum: string };
    assertSimNumFormat(simNum);

    const body = withMerchant(creds, {
      simNum,
      encStr: signatures.simExists(creds.merchantId, simNum, creds.token),
    });

    const data = await postWorldmove("/Api/SimQuery/simExists", body, creds);
    res.json(data);
  } catch (error) {
    next(error);
  }
});
