import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiGet, apiPatch, apiPost } from "../lib/api";
import type { AuthUser } from "../lib/auth";

type PaymentStatus = "unpaid" | "partial" | "paid";

type OrderRow = {
  id: string;
  userId: string;
  username: string;
  orderNumber: string;
  company: string;
  email: string;
  receiverEcid: string;
  prodList: Array<{ wmproductId: string; qty: number }>;
  quantity: number;
  productType: string;
  status: string;
  ecommerceOrder: string;
  latestHistory: string;
  orderDate: string;
  paymentStatus?: PaymentStatus;
  paymentNote?: string;
  totalAmount?: number;
  batchId?: string;
};

type BatchRecord = {
  id: string;
  batchNumber: string;
  name: string;
  orderIds: string[];
  createdByUsername: string;
  createdAt: string;
  note?: string;
  closed: boolean;
};

type Props = { authUser: AuthUser };

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid: "Chưa TT",
  partial: "Một phần",
  paid: "Đã TT",
};

const PAYMENT_COLOR: Record<PaymentStatus, { bg: string; text: string }> = {
  unpaid: { bg: "rgba(239,68,68,0.12)", text: "#dc2626" },
  partial: { bg: "rgba(234,179,8,0.15)", text: "#a16207" },
  paid: { bg: "rgba(34,197,94,0.15)", text: "#16a34a" },
};

const CHART_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899", "#14b8a6"];

// ─── CSV export ───────────────────────────────────────────────────────────────

function csvEscape(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

function exportCsv(rows: OrderRow[], filename: string) {
  const headers = [
    "Số đơn hàng", "Người tạo", "Company", "Email", "E-commerce Order",
    "Sản phẩm", "Số lượng", "Loại", "Trạng thái", "Thanh toán",
    "Ghi chú TT", "Số tiền (VND)", "Lịch sử", "Ngày đặt",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((r) => {
      const products = r.prodList.map((p) => p.wmproductId + "x" + p.qty).join("; ");
      return [
        r.orderNumber, r.username, r.company, r.email, r.ecommerceOrder,
        products, String(r.quantity), r.productType, r.status,
        PAYMENT_LABEL[r.paymentStatus ?? "unpaid"],
        r.paymentNote ?? "",
        r.totalAmount !== undefined ? String(r.totalAmount) : "",
        r.latestHistory, r.orderDate,
      ].map(csvEscape).join(",");
    }),
  ];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Payment badge ─────────────────────────────────────────────────────────────

function PaymentBadge({ status }: { status: PaymentStatus }) {
  const c = PAYMENT_COLOR[status];
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 4, fontSize: "0.78em",
      background: c.bg, color: c.text, fontWeight: 600, whiteSpace: "nowrap" as const,
    }}>
      {PAYMENT_LABEL[status]}
    </span>
  );
}

// ─── Công nợ ──────────────────────────────────────────────────────────────────

function DebtSummary({ orders, showUser }: { orders: OrderRow[]; showUser: boolean }) {
  const debtByUser = useMemo(() => {
    const map = new Map<string, { username: string; simCount: number; amount: number; hasAmount: boolean }>();
    for (const o of orders) {
      if ((o.paymentStatus ?? "unpaid") === "paid") continue;
      const entry = map.get(o.username) ?? { username: o.username, simCount: 0, amount: 0, hasAmount: false };
      entry.simCount += o.quantity;
      if (o.totalAmount) { entry.amount += o.totalAmount; entry.hasAmount = true; }
      map.set(o.username, entry);
    }
    return [...map.values()].sort((a, b) => b.simCount - a.simCount);
  }, [orders]);

  if (debtByUser.length === 0) {
    return (
      <div style={{ padding: "0.75rem 1rem", background: "rgba(34,197,94,0.08)", borderRadius: 8, marginBottom: "1.25rem", fontSize: "0.875em", color: "#16a34a" }}>
        ✓ Không có công nợ chưa thanh toán.
      </div>
    );
  }

  const totalSim = debtByUser.reduce((s, d) => s + d.simCount, 0);
  const totalAmount = debtByUser.reduce((s, d) => s + d.amount, 0);

  return (
    <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "rgba(239,68,68,0.04)", borderRadius: 10, border: "1px solid rgba(239,68,68,0.15)" }}>
      <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95em", fontWeight: 700, color: "#dc2626" }}>
        Công nợ chưa thanh toán
      </h3>
      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "0.6rem", marginBottom: showUser ? "0.75rem" : 0 }}>
        <div style={{ padding: "0.4rem 0.9rem", background: "rgba(239,68,68,0.1)", borderRadius: 6, fontSize: "0.85em" }}>
          Tổng SIM nợ: <strong>{totalSim.toLocaleString("vi-VN")}</strong>
        </div>
        {totalAmount > 0 && (
          <div style={{ padding: "0.4rem 0.9rem", background: "rgba(239,68,68,0.1)", borderRadius: 6, fontSize: "0.85em" }}>
            Tổng tiền nợ: <strong style={{ color: "#dc2626" }}>{totalAmount.toLocaleString("vi-VN")} VND</strong>
          </div>
        )}
      </div>
      {showUser && (
        <table style={{ fontSize: "0.82em", borderCollapse: "collapse" as const, minWidth: 360 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(239,68,68,0.2)" }}>
              <th style={{ textAlign: "left" as const, padding: "4px 12px 4px 0" }}>Đại lý</th>
              <th style={{ textAlign: "right" as const, padding: "4px 12px" }}>SIM chưa TT</th>
              <th style={{ textAlign: "right" as const, padding: "4px 0" }}>Tiền nợ (VND)</th>
            </tr>
          </thead>
          <tbody>
            {debtByUser.map((d) => (
              <tr key={d.username} style={{ borderBottom: "1px solid rgba(239,68,68,0.1)" }}>
                <td style={{ padding: "4px 12px 4px 0", fontWeight: 600 }}>{d.username}</td>
                <td style={{ padding: "4px 12px", textAlign: "right" as const }}>{d.simCount.toLocaleString("vi-VN")}</td>
                <td style={{ padding: "4px 0", textAlign: "right" as const, color: d.hasAmount ? "#dc2626" : "#94a3b8" }}>
                  {d.hasAmount ? d.amount.toLocaleString("vi-VN") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Biểu đồ ──────────────────────────────────────────────────────────────────

function OrdersChart({ orders }: { orders: OrderRow[] }) {
  const data = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) map.set(o.username, (map.get(o.username) ?? 0) + o.quantity);
    const total = [...map.values()].reduce((s, v) => s + v, 0);
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, qty]) => ({ name, qty, pct: total > 0 ? Math.round((qty / total) * 100) : 0 }));
  }, [orders]);

  if (data.length === 0) {
    return <p style={{ color: "#94a3b8", fontSize: "0.9em" }}>Không có dữ liệu để hiển thị.</p>;
  }

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95em", fontWeight: 700 }}>
        Phân bổ SIM theo đại lý (%)
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v: number) => v + "%"} tick={{ fontSize: 11 }} domain={[0, 100]} />
          <Tooltip
            formatter={(value: number, _name: string, entry: { payload?: { qty: number } }) => [
              value + "% (" + (entry.payload?.qty ?? 0) + " SIM)",
              "Tỷ lệ",
            ]}
          />
          <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
            {data.map((_e, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Gộp đơn ──────────────────────────────────────────────────────────────────

function BatchPanel({
  batches, orders, selectedIds, onCreated,
}: {
  batches: BatchRecord[];
  orders: OrderRow[];
  selectedIds: Set<string>;
  onCreated: (b: BatchRecord) => void;
}) {
  const [batchName, setBatchName] = useState("");
  const [batchNote, setBatchNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const orderMap = useMemo(() => {
    const m = new Map<string, OrderRow>();
    for (const o of orders) m.set(o.id, o);
    return m;
  }, [orders]);

  async function handleCreate() {
    if (!batchName.trim() || selectedIds.size === 0) return;
    setSaving(true);
    setErr("");
    try {
      const res = await apiPost<{ batch: BatchRecord }>("/orders/batches", {
        name: batchName.trim(),
        orderIds: [...selectedIds],
        note: batchNote.trim() || undefined,
      });
      onCreated(res.batch);
      setBatchName("");
      setBatchNote("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lỗi tạo batch.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95em", fontWeight: 700 }}>Gộp đơn hàng</h3>

      {selectedIds.size > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "0.5rem", alignItems: "flex-end", marginBottom: "0.75rem", padding: "0.75rem", background: "rgba(99,102,241,0.06)", borderRadius: 8, border: "1px solid rgba(99,102,241,0.2)" }}>
          <span style={{ fontSize: "0.85em" }}>Đã chọn <strong>{selectedIds.size}</strong> đơn →</span>
          <input
            style={{ padding: "0.3rem 0.6rem", fontSize: "0.85em", minWidth: 160 }}
            placeholder="Tên batch *"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
          />
          <input
            style={{ padding: "0.3rem 0.6rem", fontSize: "0.85em", minWidth: 180 }}
            placeholder="Ghi chú (tuỳ chọn)"
            value={batchNote}
            onChange={(e) => setBatchNote(e.target.value)}
          />
          <button type="button" className="btn btn--primary" style={{ fontSize: "0.85em", padding: "0.3rem 0.9rem" }} onClick={() => void handleCreate()} disabled={saving || !batchName.trim()}>
            {saving ? "Đang lưu…" : "Tạo batch"}
          </button>
          {err && <span style={{ color: "#dc2626", fontSize: "0.8em" }}>{err}</span>}
        </div>
      ) : (
        <p style={{ fontSize: "0.85em", color: "#94a3b8", margin: "0 0 0.75rem" }}>
          Tích chọn đơn hàng ở tab <strong>Danh sách</strong> rồi quay lại đây để gộp.
        </p>
      )}

      {batches.length === 0 ? (
        <p style={{ fontSize: "0.85em", color: "#94a3b8" }}>Chưa có batch nào.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.5rem" }}>
          {batches.map((b) => (
            <div key={b.id} style={{ border: "1px solid var(--border, #e2e8f0)", borderRadius: 8, overflow: "hidden" }}>
              <div
                style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.6rem 0.9rem", cursor: "pointer" }}
                onClick={() => setExpanded(expanded === b.id ? null : b.id)}
              >
                <span style={{ fontFamily: "monospace", fontSize: "0.78em", color: "#6366f1" }}>{b.batchNumber}</span>
                <span style={{ fontWeight: 600, fontSize: "0.88em", flex: 1 }}>{b.name}</span>
                <span style={{ fontSize: "0.78em", color: "#64748b" }}>{b.orderIds.length} đơn</span>
                <span style={{ fontSize: "0.75em", padding: "2px 7px", borderRadius: 4, background: b.closed ? "rgba(0,0,0,0.06)" : "rgba(99,102,241,0.1)", color: b.closed ? "#64748b" : "#6366f1" }}>
                  {b.closed ? "Đóng" : "Đang mở"}
                </span>
                <span style={{ fontSize: "0.75em", color: "#94a3b8" }}>{expanded === b.id ? "▲" : "▼"}</span>
              </div>
              {expanded === b.id && (
                <div style={{ padding: "0 0.9rem 0.75rem", fontSize: "0.82em", borderTop: "1px solid var(--border, #f1f5f9)" }}>
                  {b.note && <p style={{ margin: "0.4rem 0", color: "#475569" }}>📝 {b.note}</p>}
                  <p style={{ margin: "0 0 0.5rem", color: "#94a3b8" }}>
                    Tạo bởi {b.createdByUsername} · {b.createdAt.slice(0, 10)}
                  </p>
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: "0.3rem" }}>
                    {b.orderIds.map((oid) => {
                      const o = orderMap.get(oid);
                      if (!o) return <span key={oid} style={{ color: "#94a3b8" }}>{oid}</span>;
                      return (
                        <div key={oid} style={{ display: "flex", gap: "0.5rem", alignItems: "center", padding: "2px 0" }}>
                          <span style={{ fontFamily: "monospace", color: "#6366f1", fontSize: "0.9em" }}>{o.orderNumber}</span>
                          <span style={{ color: "#475569" }}>{o.username}</span>
                          <span style={{ color: "#64748b" }}>{o.quantity} SIM</span>
                          <PaymentBadge status={o.paymentStatus ?? "unpaid"} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function OrdersReport({ authUser }: Props) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [section, setSection] = useState<"table" | "chart" | "batch">("table");
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [paymentDraft, setPaymentDraft] = useState<{ status: PaymentStatus; note: string; amount: string }>({
    status: "unpaid", note: "", amount: "",
  });

  const canManage = authUser.role !== "dai_ly";

  const fetchData = useCallback(() => {
    setLoading(true);
    const p1 = apiGet<{ orders: OrderRow[] }>("/orders").then(({ orders: data }) => setOrders(data));
    const p2 = canManage
      ? apiGet<{ batches: BatchRecord[] }>("/orders/batches").then(({ batches: data }) => setBatches(data))
      : Promise.resolve();
    Promise.all([p1, p2])
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Lỗi tải dữ liệu."))
      .finally(() => setLoading(false));
  }, [canManage]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const usernames = useMemo(() => Array.from(new Set(orders.map((o) => o.username))).sort(), [orders]);

  const filtered = useMemo(() => orders.filter((o) => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!o.orderNumber.toLowerCase().includes(q) && !o.ecommerceOrder.toLowerCase().includes(q) && !o.company.toLowerCase().includes(q)) return false;
    }
    if (userFilter && o.username !== userFilter) return false;
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (paymentFilter !== "all" && (o.paymentStatus ?? "unpaid") !== paymentFilter) return false;
    if (dateFrom && o.orderDate.slice(0, 10) < dateFrom) return false;
    if (dateTo && o.orderDate.slice(0, 10) > dateTo) return false;
    return true;
  }), [orders, search, userFilter, statusFilter, paymentFilter, dateFrom, dateTo]);

  const totalQty = useMemo(() => filtered.reduce((s, o) => s + o.quantity, 0), [filtered]);
  const showUser = authUser.role !== "dai_ly";

  function handleExport() {
    const now = new Date().toLocaleDateString("sv-SE").replace(/-/g, "");
    const prefix = authUser.role === "admin" ? "tat-ca"
      : authUser.role === "tong_kho" ? "tong-kho-" + authUser.username
      : "dai-ly-" + authUser.username;
    exportCsv(filtered, "don-hang-" + prefix + "-" + now + ".csv");
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleSelectAll() {
    setSelectedIds(selectedIds.size === filtered.length ? new Set() : new Set(filtered.map((o) => o.id)));
  }
  function startEditPayment(o: OrderRow) {
    setEditingPayment(o.id);
    setPaymentDraft({ status: o.paymentStatus ?? "unpaid", note: o.paymentNote ?? "", amount: o.totalAmount !== undefined ? String(o.totalAmount) : "" });
  }
  async function savePayment(orderId: string) {
    try {
      const res = await apiPatch<{ order: OrderRow }>("/orders/" + orderId + "/payment", {
        paymentStatus: paymentDraft.status,
        paymentNote: paymentDraft.note || undefined,
        totalAmount: paymentDraft.amount ? Number(paymentDraft.amount) : undefined,
      });
      setOrders((prev) => prev.map((o) => o.id === orderId ? res.order : o));
      setEditingPayment(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Lỗi lưu.");
    }
  }

  const colCount = canManage ? (showUser ? 10 : 9) : (showUser ? 7 : 6);

  const SECTIONS = [
    { id: "table" as const, label: "📋 Danh sách" },
    { id: "chart" as const, label: "📊 Biểu đồ" },
    { id: "batch" as const, label: "📦 Gộp đơn" },
  ];

  return (
    <div style={{ padding: "1.5rem" }}>
      {/* Tiêu đề */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap" as const, gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>Tổng hợp đơn hàng</h2>
        <button type="button" className="btn btn--primary" onClick={handleExport} disabled={filtered.length === 0}>
          Xuất CSV ({filtered.length} đơn)
        </button>
      </div>

      {/* Công nợ — chỉ admin và tổng kho */}
      {canManage && !loading && <DebtSummary orders={orders} showUser={showUser} />}

      {/* Tab chuyển section */}
      {canManage && (
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              style={{
                padding: "0.4rem 1.1rem", borderRadius: 6, fontSize: "0.85em", fontWeight: 600,
                cursor: "pointer",
                background: section === s.id ? "#6366f1" : "transparent",
                color: section === s.id ? "#fff" : "inherit",
                border: "1px solid " + (section === s.id ? "#6366f1" : "var(--border, #e2e8f0)"),
              }}
              onClick={() => setSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Biểu đồ */}
      {section === "chart" && !loading && <OrdersChart orders={filtered} />}

      {/* Gộp đơn */}
      {section === "batch" && canManage && !loading && (
        <BatchPanel
          batches={batches}
          orders={orders}
          selectedIds={selectedIds}
          onCreated={(b) => { setBatches((prev) => [b, ...prev]); setSelectedIds(new Set()); fetchData(); }}
        />
      )}

      {/* Bộ lọc */}
      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "0.75rem", marginBottom: "1rem", alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column" as const, gap: 4, fontSize: "0.85em" }}>
          Tìm kiếm
          <input
            style={{ padding: "0.35rem 0.6rem", minWidth: 200 }}
            placeholder="Số đơn, mã ecom, công ty…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        {showUser && (
          <label style={{ display: "flex", flexDirection: "column" as const, gap: 4, fontSize: "0.85em" }}>
            Người tạo
            <select style={{ padding: "0.35rem 0.6rem" }} value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
              <option value="">Tất cả</option>
              {usernames.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
        )}

        <label style={{ display: "flex", flexDirection: "column" as const, gap: 4, fontSize: "0.85em" }}>
          Trạng thái đơn
          <select style={{ padding: "0.35rem 0.6rem" }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Tất cả</option>
            <option value="Success">Thành công</option>
            <option value="Pending">Chờ xử lý</option>
          </select>
        </label>

        {canManage && (
          <label style={{ display: "flex", flexDirection: "column" as const, gap: 4, fontSize: "0.85em" }}>
            Thanh toán
            <select style={{ padding: "0.35rem 0.6rem" }} value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
              <option value="all">Tất cả</option>
              <option value="unpaid">Chưa thanh toán</option>
              <option value="partial">Thanh toán một phần</option>
              <option value="paid">Đã thanh toán</option>
            </select>
          </label>
        )}

        <label style={{ display: "flex", flexDirection: "column" as const, gap: 4, fontSize: "0.85em" }}>
          Từ ngày
          <input type="date" style={{ padding: "0.35rem 0.6rem" }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>

        <label style={{ display: "flex", flexDirection: "column" as const, gap: 4, fontSize: "0.85em" }}>
          Đến ngày
          <input type="date" style={{ padding: "0.35rem 0.6rem" }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>

        {(search || userFilter || statusFilter !== "all" || paymentFilter !== "all" || dateFrom || dateTo) && (
          <button
            type="button"
            style={{ alignSelf: "flex-end", padding: "0.35rem 0.8rem" }}
            onClick={() => { setSearch(""); setUserFilter(""); setStatusFilter("all"); setPaymentFilter("all"); setDateFrom(""); setDateTo(""); }}
          >
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Tóm tắt */}
      <div style={{ fontSize: "0.85em", marginBottom: "0.75rem", color: "var(--text-muted, #64748b)" }}>
        Hiển thị <strong>{filtered.length}</strong> đơn · Tổng số SIM: <strong>{totalQty}</strong>
        {canManage && section === "table" && selectedIds.size > 0 && (
          <span style={{ marginLeft: "1rem", color: "#6366f1" }}>
            · Đã chọn <strong>{selectedIds.size}</strong> đơn để gộp
          </span>
        )}
      </div>

      {loading && <p>Đang tải dữ liệu…</p>}
      {error && <p style={{ color: "#dc2626" }}>{error}</p>}

      {/* Bảng danh sách */}
      {!loading && !error && section !== "chart" && (
        <div style={{ overflowX: "auto" as const }}>
          <table className="esim-order-table" style={{ width: "100%", fontSize: "0.875rem" }}>
            <thead>
              <tr>
                {canManage && (
                  <th style={{ width: 32, textAlign: "center" as const }}>
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onChange={toggleSelectAll}
                      title="Chọn tất cả"
                    />
                  </th>
                )}
                <th>Số đơn hàng</th>
                {showUser && <th>Người tạo</th>}
                <th>Công ty</th>
                <th>Mã E-commerce</th>
                <th style={{ textAlign: "center" as const }}>SL</th>
                <th>Trạng thái</th>
                {canManage && <th>Thanh toán</th>}
                {canManage && <th style={{ textAlign: "right" as const }}>Số tiền (VND)</th>}
                <th>Ngày đặt</th>
              </tr>
            </thead>
            <tbody>
              {filtered.flatMap((row) => {
                const rowEls = [
                  <tr
                    key={row.id}
                    style={{ background: selectedIds.has(row.id) ? "rgba(99,102,241,0.06)" : undefined }}
                  >
                    {canManage && (
                      <td style={{ textAlign: "center" as const }}>
                        <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelect(row.id)} />
                      </td>
                    )}
                    <td style={{ fontFamily: "monospace", fontSize: "0.8em" }}>
                      {row.orderNumber}
                      {row.batchId && (
                        <span title="Thuộc batch" style={{ marginLeft: 4, color: "#6366f1", fontSize: "0.85em", fontFamily: "sans-serif" }}>[B]</span>
                      )}
                    </td>
                    {showUser && <td>{row.username}</td>}
                    <td>{row.company}</td>
                    <td>{row.ecommerceOrder}</td>
                    <td style={{ textAlign: "center" as const }}>{row.quantity}</td>
                    <td>
                      <span style={{
                        padding: "2px 8px", borderRadius: 4, fontSize: "0.8em",
                        background: row.status === "Success" ? "rgba(34,197,94,0.15)" : "rgba(234,179,8,0.15)",
                        color: row.status === "Success" ? "#16a34a" : "#a16207",
                      }}>
                        {row.status === "Success" ? "Thành công" : "Chờ xử lý"}
                      </span>
                    </td>
                    {canManage && (
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <PaymentBadge status={row.paymentStatus ?? "unpaid"} />
                          <button
                            type="button"
                            style={{ fontSize: "0.72em", padding: "1px 6px", cursor: "pointer", borderRadius: 4, border: "1px solid var(--border, #e2e8f0)" }}
                            onClick={() => editingPayment === row.id ? setEditingPayment(null) : startEditPayment(row)}
                          >
                            Sửa
                          </button>
                        </div>
                        {row.paymentNote && (
                          <div style={{ fontSize: "0.75em", color: "#64748b", marginTop: 2 }}>{row.paymentNote}</div>
                        )}
                      </td>
                    )}
                    {canManage && (
                      <td style={{ textAlign: "right" as const, fontSize: "0.85em", color: row.totalAmount ? "inherit" : "#94a3b8" }}>
                        {row.totalAmount !== undefined ? row.totalAmount.toLocaleString("vi-VN") : "—"}
                      </td>
                    )}
                    <td style={{ whiteSpace: "nowrap" as const, fontSize: "0.8em" }}>
                      {row.orderDate.slice(0, 10)}
                    </td>
                  </tr>,
                ];

                if (canManage && editingPayment === row.id) {
                  rowEls.push(
                    <tr key={"edit-" + row.id} style={{ background: "rgba(99,102,241,0.04)" }}>
                      <td colSpan={colCount} style={{ padding: "0.5rem 0.75rem" }}>
                        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "0.5rem", alignItems: "center", fontSize: "0.85em" }}>
                          <select
                            value={paymentDraft.status}
                            onChange={(e) => setPaymentDraft({ ...paymentDraft, status: e.target.value as PaymentStatus })}
                            style={{ padding: "0.25rem 0.5rem" }}
                          >
                            <option value="unpaid">Chưa thanh toán</option>
                            <option value="partial">Thanh toán một phần</option>
                            <option value="paid">Đã thanh toán đủ</option>
                          </select>
                          <input
                            placeholder="Số tiền (VND)"
                            type="number"
                            style={{ padding: "0.25rem 0.5rem", width: 150 }}
                            value={paymentDraft.amount}
                            onChange={(e) => setPaymentDraft({ ...paymentDraft, amount: e.target.value })}
                          />
                          <input
                            placeholder="Ghi chú thanh toán…"
                            style={{ padding: "0.25rem 0.5rem", minWidth: 200 }}
                            value={paymentDraft.note}
                            onChange={(e) => setPaymentDraft({ ...paymentDraft, note: e.target.value })}
                          />
                          <button type="button" className="btn btn--primary" style={{ padding: "0.25rem 0.75rem" }} onClick={() => void savePayment(row.id)}>
                            Lưu
                          </button>
                          <button type="button" style={{ padding: "0.25rem 0.75rem" }} onClick={() => setEditingPayment(null)}>
                            Hủy
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return rowEls;
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="empty-cell">Không có đơn hàng nào phù hợp.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
