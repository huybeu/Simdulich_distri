import crypto from "node:crypto";
import { readJson, writeJson } from "../store/jsonDb.js";
import { listPublicUsers } from "./userStore.js";

const ORDERS_FILE = "orders.json";
const BATCHES_FILE = "batches.json";

export type PaymentStatus = "unpaid" | "partial" | "paid";

export type OrderRecord = {
  id: string;
  userId: string;
  username: string;
  orderNumber: string;       // orderId từ Worldmove hoặc local
  company: string;
  email: string;
  receiverEcid: string;
  prodList: Array<{ wmproductId: string; qty: number }>;
  quantity: number;
  productType: "eSIM";
  status: "Success" | "Pending";
  ecommerceOrder: string;
  latestHistory: string;
  orderDate: string;         // giờ Taipei (UTC+8)
  worldmoveResponse: unknown;
  // Công nợ
  paymentStatus?: PaymentStatus;
  paymentNote?: string;
  totalAmount?: number;       // VND (tuỳ chọn, admin/tổng kho nhập)
  batchId?: string;
};

export type BatchRecord = {
  id: string;
  batchNumber: string;
  name: string;
  orderIds: string[];
  createdBy: string;
  createdByUsername: string;
  createdAt: string;
  note?: string;
  closed: boolean;
};

type OrderDb = { orders: OrderRecord[] };
type BatchDb = { batches: BatchRecord[] };

async function load(): Promise<OrderRecord[]> {
  const db = await readJson<OrderDb>(ORDERS_FILE, { orders: [] });
  return db.orders;
}

async function save(orders: OrderRecord[]): Promise<void> {
  await writeJson(ORDERS_FILE, { orders });
}

async function loadBatches(): Promise<BatchRecord[]> {
  const db = await readJson<BatchDb>(BATCHES_FILE, { batches: [] });
  return db.batches;
}

async function saveBatches(batches: BatchRecord[]): Promise<void> {
  await writeJson(BATCHES_FILE, { batches });
}

export async function saveOrder(order: Omit<OrderRecord, "id">): Promise<OrderRecord> {
  const orders = await load();
  const record: OrderRecord = {
    id: crypto.randomUUID(),
    paymentStatus: "unpaid",
    ...order,
  };
  orders.unshift(record);
  await save(orders);
  return record;
}

/** Trả về IDs của tất cả user cấp dưới (đệ quy) của một user. */
function collectDescendantIds(userId: string, allUsers: { id: string; parentId: string | null }[]): string[] {
  const children = allUsers.filter((u) => u.parentId === userId).map((u) => u.id);
  const deeper = children.flatMap((cid) => collectDescendantIds(cid, allUsers));
  return [...children, ...deeper];
}

/** Lấy đơn hàng theo quyền:
 *  - admin: tất cả
 *  - tong_kho: của mình + cấp dưới
 *  - dai_ly: chỉ của mình
 */
export async function getOrdersForUser(userId: string, role: string): Promise<OrderRecord[]> {
  const orders = await load();
  if (role === "admin") return orders;

  const allUsers = await listPublicUsers();
  const visibleIds = new Set([userId, ...collectDescendantIds(userId, allUsers)]);
  return orders.filter((o) => visibleIds.has(o.userId));
}

/** Cập nhật trạng thái thanh toán và số tiền. */
export async function updateOrderPayment(
  id: string,
  patch: { paymentStatus?: PaymentStatus; paymentNote?: string; totalAmount?: number },
): Promise<OrderRecord | null> {
  const orders = await load();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx < 0) return null;
  if (patch.paymentStatus !== undefined) orders[idx].paymentStatus = patch.paymentStatus;
  if (patch.paymentNote !== undefined) orders[idx].paymentNote = patch.paymentNote;
  if (patch.totalAmount !== undefined) orders[idx].totalAmount = patch.totalAmount;
  await save(orders);
  return orders[idx];
}

/** Tạo batch mới từ danh sách order IDs. */
export async function createBatch(input: {
  name: string;
  orderIds: string[];
  createdBy: string;
  createdByUsername: string;
  note?: string;
}): Promise<BatchRecord> {
  const batches = await loadBatches();
  const seq = String(batches.length + 1).padStart(4, "0");
  const now = new Date().toISOString();
  const batch: BatchRecord = {
    id: crypto.randomUUID(),
    batchNumber: `BATCH-${now.slice(0, 10).replace(/-/g, "")}-${seq}`,
    name: input.name,
    orderIds: input.orderIds,
    createdBy: input.createdBy,
    createdByUsername: input.createdByUsername,
    createdAt: now,
    note: input.note,
    closed: false,
  };
  // Gán batchId vào các order
  const orders = await load();
  for (const o of orders) {
    if (input.orderIds.includes(o.id)) o.batchId = batch.id;
  }
  await save(orders);
  batches.unshift(batch);
  await saveBatches(batches);
  return batch;
}

export async function getBatchesForUser(userId: string, role: string): Promise<BatchRecord[]> {
  const batches = await loadBatches();
  if (role === "admin") return batches;
  return batches.filter((b) => b.createdBy === userId);
}

export async function updateBatch(
  id: string,
  patch: { name?: string; note?: string; closed?: boolean },
): Promise<BatchRecord | null> {
  const batches = await loadBatches();
  const idx = batches.findIndex((b) => b.id === id);
  if (idx < 0) return null;
  if (patch.name !== undefined) batches[idx].name = patch.name;
  if (patch.note !== undefined) batches[idx].note = patch.note;
  if (patch.closed !== undefined) batches[idx].closed = patch.closed;
  await saveBatches(batches);
  return batches[idx];
}
