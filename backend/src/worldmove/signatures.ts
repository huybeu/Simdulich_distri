import { sha1Concat } from "./crypto.js";

type ProdQty = { wmproductId: string; qty: number };
type ProdIdNameQty = { productId: string; productName: string; qty: number };
type DepositLine = { wmproductId: string; day: number; simNum: string };

type EsimOrderItem = {
  iccid: string;
  productName: string;
  redemptionCode: string;
};

type EsimRedeemItem = {
  iccid: string;
  productName: string;
  rcode: string;
  qrcodeType: number;
  qrcode: string;
};

type TopupItem = {
  wmproductId: string;
  day: number;
  simNum: string;
};

function sumProdList<T>(items: T[], mapper: (item: T) => string): string {
  return items.map(mapper).join("");
}

export const signatures = {
  /** 1. Searching for My Quotations */
  myQueryAll(merchantId: string, token: string): string {
    return sha1Concat([merchantId, token]);
  },

  /** 2.1 eSIM Order */
  buyEsim(
    merchantId: string,
    deptId: string,
    email: string,
    prodList: ProdQty[],
    token: string,
  ): string {
    const products = sumProdList(prodList, (p) => `${p.wmproductId}${p.qty}`);
    return sha1Concat([merchantId, deptId, email, products, token]);
  },

  /** 2.2 eSIM Order Callback verify */
  esimOrderCallback(
    merchantId: string,
    orderId: string,
    orderSN: string,
    orderTime: string,
    itemList: EsimOrderItem[],
    token: string,
  ): string {
    const items = sumProdList(
      itemList,
      (i) => `${i.iccid}${i.productName}${i.redemptionCode}`,
    );
    return sha1Concat([merchantId, orderId, orderSN, orderTime, items, token]);
  },

  /** 2.3 Query eSIM Order */
  queryBuyEsim(merchantId: string, orderId: string, token: string): string {
    return sha1Concat([merchantId, orderId, token]);
  },

  /** 2.4 eSIM Order and Redeem */
  buyEsimRedemption(
    merchantId: string,
    deptId: string,
    qrcodeType: number,
    prodList: ProdQty[],
    token: string,
  ): string {
    const products = sumProdList(prodList, (p) => `${p.wmproductId}${p.qty}`);
    return sha1Concat([merchantId, deptId, qrcodeType, products, token]);
  },

  /** 2.5 eSIM Order and Redeem Callback verify */
  esimOrderRedeemCallback(
    merchantId: string,
    orderId: string,
    itemList: EsimRedeemItem[],
    token: string,
  ): string {
    const items = sumProdList(
      itemList,
      (i) =>
        `${i.iccid}${i.productName}${i.rcode}${i.qrcodeType}${i.qrcode}`,
    );
    return sha1Concat([merchantId, orderId, items, token]);
  },

  /** 3.1 Redeem Redemption Code */
  redeem(
    merchantId: string,
    rcode: string,
    qrcodeType: number,
    token: string,
  ): string {
    return sha1Concat([merchantId, rcode, qrcodeType, token]);
  },

  /** 3.2 Redeem Callback verify */
  redeemCallback(
    merchantId: string,
    qrcode: string,
    rcode: string,
    qrcodeType: number,
    token: string,
  ): string {
    return sha1Concat([merchantId, qrcode, rcode, qrcodeType, token]);
  },

  /** 4. Placing order for SIM card */
  buySim(
    merchantId: string,
    deptId: string,
    invoiceType: number,
    taxId: string,
    receivingName: string,
    receivingTel: string,
    receivingAdd: string,
    note: string,
    prodList: ProdIdNameQty[],
    token: string,
  ): string {
    const products = sumProdList(
      prodList,
      (p) => `${p.productId}${p.productName}${p.qty}`,
    );
    return sha1Concat([
      merchantId,
      deptId,
      invoiceType,
      taxId,
      receivingName,
      receivingTel,
      receivingAdd,
      note,
      products,
      token,
    ]);
  },

  /** 5.1 Top-up */
  deposit(
    merchantId: string,
    deptId: string,
    prodList: DepositLine[],
    token: string,
  ): string {
    const lines = sumProdList(
      prodList,
      (p) => `${p.wmproductId}${p.day}${p.simNum}`,
    );
    return sha1Concat([merchantId, deptId, lines, token]);
  },

  /** 5.2 Top-up callback verify */
  depositCallback(
    merchantId: string,
    orderId: string,
    itemList: TopupItem[],
    token: string,
  ): string {
    const items = sumProdList(
      itemList,
      (i) => `${i.wmproductId}${i.day}${i.simNum}`,
    );
    return sha1Concat([merchantId, orderId, items, token]);
  },

  /** 5.3 Remote Activation */
  remoteActiv(
    merchantId: string,
    simNum: string,
    orderId: string,
    mcc: string,
    token: string,
  ): string {
    return sha1Concat([merchantId, simNum, orderId, mcc, token]);
  },

  /** 5.4 Traffic Reset */
  trafficReset(
    merchantId: string,
    simNum: string,
    orderId: string,
    token: string,
  ): string {
    return sha1Concat([merchantId, simNum, orderId, token]);
  },

  /** 6.1 Usage - SIM path */
  queryUsageBySim(
    merchantId: string,
    simNum: string,
    orderId: string,
    token: string,
  ): string {
    return sha1Concat([merchantId, simNum, orderId, token]);
  },

  /** 6.1 / 6.2 / 6.3 - virtual path (rcode example in PDF) */
  queryByRcode(merchantId: string, rcode: string, token: string): string {
    return sha1Concat([merchantId, rcode, token]);
  },

  /** 6.4 Verify card number */
  simExists(merchantId: string, simNum: string, token: string): string {
    return sha1Concat([merchantId, simNum, token]);
  },
};
