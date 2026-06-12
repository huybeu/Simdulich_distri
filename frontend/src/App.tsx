import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import "./App.css";
import { AdminPanel } from "./components/AdminPanel";
import { OrdersReport } from "./components/OrdersReport";
import { CatalogBanner } from "./components/CatalogBanner";
import { Section } from "./components/Section";
import { ResultBox } from "./components/ResultBox";
import { WebhookPanel } from "./components/WebhookPanel";
import { SettingsTab } from "./components/SettingsTab";
import { useApiAction } from "./hooks/useApiAction";
import { apiGet, apiPost } from "./lib/api";
import type { CatalogResponse } from "./lib/catalog";
import type { AuthUser, PricingProfile, UserRole } from "./lib/auth";
import { applyMarkupVnd, authHeaders, isOrderOnlyRole } from "./lib/auth";
import { formatVnd } from "./lib/displayPrice";
import {
  QUOTE_CACHE_TTL_MS,
  readQuoteCache,
  writeQuoteCache,
  type QuoteProduct,
} from "./lib/quoteTypes";
import { SYSTEM_CONFIG_UPDATED_EVENT } from "./lib/settings";
import {
  parseJsonLines,
  validateDepositLines,
  validateEsimProdList,
  validateSimNum20,
} from "./lib/validators";

type TabId =
  | "settings"
  | "admin"
  | "quotes"
  | "esim"
  | "redeem"
  | "physical"
  | "topup"
  | "query"
  | "webhooks"
  | "manage"
  | "report";

type AppProps = {
  authUser: AuthUser;
  pricing: PricingProfile;
  onPricingUpdated: (p: PricingProfile) => void;
};

type EsimPlan = {
  id: string;
  wmproductId: string;
  country: string;
  planName: string;
  price: number;
};

type EsimCartLine = {
  plan: EsimPlan;
  qty: number;
};

type EsimOrderRow = {
  orderNumber: string;
  company: string;
  ecommerceOrder: string;
  orderDate: string;
  quantity: number;
  productType: "eSIM";
  status: "Success" | "Pending";
  latestHistory: string;
};

type PhysicalTopupLine = {
  plan: EsimPlan;
  day: number;
  sn: string;
};

type PhysicalOrderRow = {
  orderNumber: string;
  sn: string;
  orderDate: string;
  quantity: number;
  note: string;
  status: "Success" | "Pending";
  latestHistory: string;
};

function buildTabs(role: UserRole): { id: TabId; label: string }[] {
  if (role === "tong_kho") {
    return [
      { id: "esim", label: "Đặt eSIM" },
      { id: "physical", label: "Đặt SIM vật lý" },
      { id: "manage", label: "Quản lý đại lý" },
      { id: "report", label: "Tổng hợp" },
    ];
  }
  if (isOrderOnlyRole(role)) {
    return [
      { id: "esim", label: "Đặt eSIM" },
      { id: "physical", label: "Đặt SIM vật lý" },
      { id: "report", label: "Tổng hợp" },
    ];
  }
  return [
    { id: "settings", label: "Cấu hình" },
    { id: "admin", label: "Quản trị" },
    { id: "quotes", label: "Báo giá" },
    { id: "esim", label: "eSIM" },
    { id: "redeem", label: "Redeem" },
    { id: "physical", label: "SIM vật lý" },
    { id: "topup", label: "Nạp tiền / Vận hành" },
    { id: "query", label: "Tra cứu" },
    { id: "webhooks", label: "Webhook" },
    { id: "report", label: "Tổng hợp" },
  ];
}

function defaultTabForRole(role: UserRole): TabId {
  return isOrderOnlyRole(role) ? "esim" : "settings";
}

const FALLBACK_ESIM_PLANS: EsimPlan[] = [
  {
    id: "WM_DEMO_CN_1",
    wmproductId: "WM_DEMO_CN_1",
    country: "China",
    planName: "Mainland China, 4 Days, 2GB/day",
    price: 90,
  },
  {
    id: "WM_DEMO_CN_2",
    wmproductId: "WM_DEMO_CN_2",
    country: "China",
    planName: "Mainland China, 5 Days, 3GB/day",
    price: 120,
  },
  {
    id: "WM_DEMO_KR_1",
    wmproductId: "WM_DEMO_KR_1",
    country: "Korea",
    planName: "Korea, 5 Days, 1GB/day",
    price: 95,
  },
];

function parseCountry(productName: unknown): string {
  const cleaned = String(productName ?? "").trim();
  if (!cleaned) return "Other";
  return cleaned.split(/[,(\-]/)[0]?.trim() || "Other";
}

function nowText(): string {
  // Dùng UTC+8 (giờ Đài Loan) để khớp với timestamp Worldmove
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Taipei" }).replace("T", " ");
}

function makeLocalOrderNumber(): string {
  const t = Date.now().toString();
  return `b${t.slice(-14)}`;
}

function CountryCombobox({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = input.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [input, options]);

  // Label hiển thị trong ô input
  const displayValue = value === "all" ? "" : value;

  function select(country: string) {
    onChange(country);
    setInput(country === "all" ? "" : country);
    setOpen(false);
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(e.target.value);
    onChange("all"); // reset filter khi gõ mới
    setOpen(true);
  }

  function handleFocus() {
    setInput(displayValue);
    setOpen(true);
  }

  function handleBlur() {
    // delay để click option kịp xử lý
    setTimeout(() => setOpen(false), 150);
  }

  return (
    <div className="combobox-wrap">
      <input
        value={open ? input : displayValue}
        onChange={handleInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="Tất cả quốc gia"
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="combobox-list">
          <li onMouseDown={() => select("all")} className={value === "all" ? "combobox-active" : ""}>
            Tất cả quốc gia
          </li>
          {filtered.map((c) => (
            <li
              key={c}
              onMouseDown={() => select(c)}
              className={value === c ? "combobox-active" : ""}
            >
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function mapProductsToPlans(
  products: QuoteProduct[],
  rate: number,
  markupVnd: number,
): EsimPlan[] {
  return products.map((p) => ({
    id: p.wmproductId,
    wmproductId: p.wmproductId,
    country: parseCountry(p.productName),
    planName: String(p.productName ?? p.wmproductId),
    // Giá plan lưu sẵn theo VND = NT × tỷ giá + markup VND
    price: applyMarkupVnd(p.productPrice ?? 0, rate, markupVnd),
  }));
}

function App({ authUser, pricing, onPricingUpdated }: AppProps) {
  const orderOnly = isOrderOnlyRole(authUser.role);
  const tabs = useMemo(() => buildTabs(authUser.role), [authUser.role]);
  const displayRate = pricing.ntToVndRate;
  const markupVnd = pricing.markupVnd;

  const [activeTab, setActiveTab] = useState<TabId>(() => defaultTabForRole(authUser.role));
  const api = useApiAction();
  const [health, setHealth] = useState<{
    merchantId?: string | null;
    baseUrl?: string;
    configured?: boolean;
  }>({});
  const [quotes, setQuotes] = useState<QuoteProduct[]>([]);
  const [esimProducts, setEsimProducts] = useState<QuoteProduct[]>([]);
  const [quoteHint, setQuoteHint] = useState("");
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quotesError, setQuotesError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [systemMail, setSystemMail] = useState(false);
  const [esimWmId, setEsimWmId] = useState("");
  const [autoIssueQr, setAutoIssueQr] = useState(true);

  const [qrcodeType, setQrcodeType] = useState(2);

  const [rcode, setRcode] = useState("");

  const [depositCsv, setDepositCsv] = useState(
    "wmproductId,day,simNum\nWM_000006,1,12345678901234567890",
  );

  const [simNum, setSimNum] = useState("");
  const [opOrderId, setOpOrderId] = useState("");
  const [mcc, setMcc] = useState("");

  const [queryRcode, setQueryRcode] = useState("");
  const [querySimNum, setQuerySimNum] = useState("");
  const [queryOrderId, setQueryOrderId] = useState("");

  const [esimView, setEsimView] = useState<"list" | "create">("list");
  const [selectedEsimOrder, setSelectedEsimOrder] = useState<EsimOrderRow | null>(null);
  const [lastOrderPayload, setLastOrderPayload] = useState<Record<string, unknown> | null>(null);
  const [ecomOrderName, setEcomOrderName] = useState("");
  const ecomPrefix = authUser.username ? `${authUser.username}_` : "";
  const [countryFilter, setCountryFilter] = useState("all");
  const [planKeyword, setPlanKeyword] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [ecomSearch, setEcomSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [esimCart, setEsimCart] = useState<EsimCartLine[]>([]);
  const [createdEsimOrders, setCreatedEsimOrders] = useState<EsimOrderRow[]>([]);

  const [physicalView, setPhysicalView] = useState<"list" | "create">("list");
  const [physicalOrderSearch, setPhysicalOrderSearch] = useState("");
  const [physicalSnSearch, setPhysicalSnSearch] = useState("");
  const [physicalStatusFilter, setPhysicalStatusFilter] = useState("all");
  const [physicalCountryFilter, setPhysicalCountryFilter] = useState("all");
  const [physicalPlanKeyword, setPhysicalPlanKeyword] = useState("");
  const [physicalCart, setPhysicalCart] = useState<PhysicalTopupLine[]>([]);
  const [createdPhysicalOrders, setCreatedPhysicalOrders] = useState<PhysicalOrderRow[]>([]);
  const [esimCompany, setEsimCompany] = useState(authUser.username);
  const [physicalCompany, setPhysicalCompany] = useState(authUser.username);
  const [physicalTaxId, setPhysicalTaxId] = useState(authUser.username);
  const [physicalNote, setPhysicalNote] = useState("");

  useEffect(() => {
    const refreshHealth = () => {
      void apiGet<{ merchantId: string | null; baseUrl: string; configured?: boolean }>(
        "/health",
      ).then(setHealth);
    };
    refreshHealth();
    window.addEventListener(SYSTEM_CONFIG_UPDATED_EVENT, refreshHealth);
    return () => window.removeEventListener(SYSTEM_CONFIG_UPDATED_EVENT, refreshHealth);
  }, []);

  // Load đơn hàng từ backend (bao gồm đơn của cấp dưới)
  useEffect(() => {
    void apiGet<{ orders: Array<EsimOrderRow & { userId?: string; username?: string }> }>("/orders")
      .then(({ orders }) => {
        setCreatedEsimOrders(orders.map((o) => ({
          orderNumber: o.orderNumber,
          company: o.company,
          ecommerceOrder: o.ecommerceOrder,
          orderDate: o.orderDate,
          quantity: o.quantity,
          productType: "eSIM" as const,
          status: o.status,
          latestHistory: o.latestHistory,
        })));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!tabs.some((t) => t.id === activeTab)) {
      setActiveTab(defaultTabForRole(authUser.role));
    }
  }, [tabs, activeTab, authUser.role]);

  const applyCatalog = useCallback((data: CatalogResponse, fromCache: boolean) => {
    setQuotes(data.prodList);
    const esim =
      data.esimProducts.length > 0
        ? data.esimProducts
        : data.prodList.filter((p) => p.leSIM === true);
    setEsimProducts(esim);
    const pick = esim[0] ?? data.prodList[0];
    if (pick) setEsimWmId(pick.wmproductId);
    if (fromCache) {
      setQuoteHint(`Dùng cache (${data.count} sản phẩm, ${data.esimCount} eSIM).`);
    } else {
      setQuoteHint(`Đã tải ${data.count} sản phẩm từ API (${data.esimCount} eSIM).`);
    }
    setQuotesError(null);
  }, []);

  const fetchCatalog = useCallback(
    async (forceApi = false) => {
      setQuotesLoading(true);
      setQuotesError(null);
      try {
        if (!forceApi) {
          const cached = readQuoteCache();
          if (cached && cached.prodList.length > 0) {
            const isFresh = Date.now() - cached.savedAt < QUOTE_CACHE_TTL_MS;
            if (isFresh) {
              const esimCached = cached.prodList.filter((p) => p.leSIM === true);
              applyCatalog(
                {
                  prodList: cached.prodList,
                  esimProducts: esimCached,
                  count: cached.prodList.length,
                  esimCount: esimCached.length,
                },
                true,
              );
              return;
            }
          }
        }

        const data = await apiGet<CatalogResponse>("/catalog");
        if (data.prodList.length === 0) {
          setQuotesError(
            data.msg ||
              "API không trả về sản phẩm. Admin kiểm tra Merchant / Token (tab Cấu hình).",
          );
          setQuotes([]);
          setEsimProducts([]);
          return;
        }
        writeQuoteCache(data.prodList);
        applyCatalog(data, false);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Không tải được sản phẩm.";
        setQuotesError(message);
        if (!orderOnly) {
          const cached = readQuoteCache();
          if (cached?.prodList.length) {
            const esimCached = cached.prodList.filter((p) => p.leSIM === true);
            applyCatalog(
              {
                prodList: cached.prodList,
                esimProducts: esimCached,
                count: cached.prodList.length,
                esimCount: esimCached.length,
              },
              true,
            );
            setQuoteHint("API lỗi — đang dùng cache cũ.");
          }
        }
      } finally {
        setQuotesLoading(false);
      }
    },
    [applyCatalog, orderOnly],
  );

  useEffect(() => {
    void fetchCatalog();
  }, [fetchCatalog]);

  useEffect(() => {
    const onConfigUpdated = () => void fetchCatalog(true);
    window.addEventListener(SYSTEM_CONFIG_UPDATED_EVENT, onConfigUpdated);
    return () => window.removeEventListener(SYSTEM_CONFIG_UPDATED_EVENT, onConfigUpdated);
  }, [fetchCatalog]);

  async function loadQuotes() {
    await api.run(async () => {
      const data = await apiGet<CatalogResponse>("/catalog");
      if (data.prodList.length === 0) {
        throw new Error(data.msg || "API không trả về sản phẩm.");
      }
      writeQuoteCache(data.prodList);
      applyCatalog(data, false);
      return data;
    });
  }

  const leSimOnlyProducts = esimProducts;

  const esimPlans = useMemo<EsimPlan[]>(() => {
    if (esimProducts.length > 0) {
      return mapProductsToPlans(esimProducts, displayRate, markupVnd);
    }
    if (orderOnly) return [];
    return mapProductsToPlans(FALLBACK_ESIM_PLANS as unknown as QuoteProduct[], displayRate, markupVnd);
  }, [esimProducts, displayRate, markupVnd, orderOnly]);

  const physicalProducts = useMemo(() => {
    const nonEsim = quotes.filter((p) => !p.leSIM);
    return nonEsim.length > 0 ? nonEsim : quotes;
  }, [quotes]);

  const physicalPlans = useMemo(
    () => mapProductsToPlans(physicalProducts, displayRate, markupVnd),
    [physicalProducts, displayRate, markupVnd],
  );

  const countryOptions = useMemo(
    () => Array.from(new Set(esimPlans.map((p) => p.country))).sort(),
    [esimPlans],
  );

  const physicalCountryOptions = useMemo(
    () => Array.from(new Set(physicalPlans.map((p) => p.country))).sort(),
    [physicalPlans],
  );

  const catalogBanner = (
    <CatalogBanner
      loading={quotesLoading}
      error={quotesError}
      hint={quoteHint}
      productCount={esimProducts.length}
      onRetry={() => void fetchCatalog(true)}
    />
  );

  const filteredPlans = useMemo(() => {
    return esimPlans.filter((plan) => {
      const byCountry = countryFilter === "all" || plan.country === countryFilter;
      const byKeyword =
        planKeyword.trim() === "" ||
        plan.planName.toLowerCase().includes(planKeyword.trim().toLowerCase());
      return byCountry && byKeyword;
    });
  }, [esimPlans, countryFilter, planKeyword]);

  const filteredOrders = useMemo(() => {
    return createdEsimOrders.filter((row) => {
      const byOrder =
        orderSearch.trim() === "" ||
        row.orderNumber.toLowerCase().includes(orderSearch.trim().toLowerCase());
      const byEcom =
        ecomSearch.trim() === "" ||
        row.ecommerceOrder.toLowerCase().includes(ecomSearch.trim().toLowerCase());
      const byStatus = statusFilter === "all" || row.status === statusFilter;
      return byOrder && byEcom && byStatus;
    });
  }, [createdEsimOrders, orderSearch, ecomSearch, statusFilter]);

  const filteredPhysicalOrders = useMemo(() => {
    return createdPhysicalOrders.filter((row) => {
      const byOrder =
        physicalOrderSearch.trim() === "" ||
        row.orderNumber.toLowerCase().includes(physicalOrderSearch.trim().toLowerCase());
      const bySn =
        physicalSnSearch.trim() === "" ||
        row.sn.toLowerCase().includes(physicalSnSearch.trim().toLowerCase());
      const byStatus = physicalStatusFilter === "all" || row.status === physicalStatusFilter;
      return byOrder && bySn && byStatus;
    });
  }, [createdPhysicalOrders, physicalOrderSearch, physicalSnSearch, physicalStatusFilter]);

  const filteredPhysicalPlans = useMemo(() => {
    return physicalPlans.filter((plan) => {
      const byCountry = physicalCountryFilter === "all" || plan.country === physicalCountryFilter;
      const byKeyword =
        physicalPlanKeyword.trim() === "" ||
        plan.planName.toLowerCase().includes(physicalPlanKeyword.trim().toLowerCase());
      return byCountry && byKeyword;
    });
  }, [physicalPlans, physicalCountryFilter, physicalPlanKeyword]);

  const cartTotalQty = useMemo(
    () => esimCart.reduce((sum, line) => sum + line.qty, 0),
    [esimCart],
  );
  const esimTotalAmount = useMemo(
    () => esimCart.reduce((sum, line) => sum + line.plan.price * line.qty, 0),
    [esimCart],
  );

  const physicalTotalAmount = useMemo(
    () => physicalCart.reduce((sum, line) => sum + line.plan.price * line.day, 0),
    [physicalCart],
  );

  function exportPriceListXlsx() {
    const header = ["STT", "Mã sản phẩm", "Quốc gia", "Tên gói", "Giá (VND)"];

    function makePlansRows(plans: EsimPlan[]) {
      return plans.map((p, i) => [
        i + 1,
        p.wmproductId,
        p.country,
        p.planName,
        Math.round(p.price),
      ]);
    }

    const esimRows = makePlansRows(esimPlans);
    const physRows = makePlansRows(physicalPlans);

    function buildSheet(rows: (string | number)[][]) {
      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
      // Độ rộng cột
      ws["!cols"] = [
        { wch: 5 },   // STT
        { wch: 14 },  // Mã SP
        { wch: 22 },  // Quốc gia
        { wch: 40 },  // Tên gói
        { wch: 16 },  // Giá VND
      ];
      return ws;
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, buildSheet(esimRows), "eSIM");
    XLSX.utils.book_append_sheet(wb, buildSheet(physRows), "SIM Vật Lý");

    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `bang-bao-gia-${date}.xlsx`);
  }

  function addPlanToCart(plan: EsimPlan) {
    setEsimCart((prev) => {
      const hit = prev.find((line) => line.plan.id === plan.id);
      if (hit) {
        return prev.map((line) =>
          line.plan.id === plan.id ? { ...line, qty: line.qty + 1 } : line,
        );
      }
      return [...prev, { plan, qty: 1 }];
    });
  }

  function updateCartQty(planId: string, qty: number) {
    setEsimCart((prev) =>
      prev
        .map((line) => (line.plan.id === planId ? { ...line, qty: Math.max(1, qty) } : line))
        .filter((line) => line.qty > 0),
    );
  }

  function removeCartLine(planId: string) {
    setEsimCart((prev) => prev.filter((line) => line.plan.id !== planId));
  }

  function addPhysicalPlan(plan: EsimPlan) {
    setPhysicalCart((prev) => {
      const hit = prev.find((line) => line.plan.id === plan.id);
      if (hit) {
        return prev;
      }
      return [...prev, { plan, day: 1, sn: "" }];
    });
  }

  function updatePhysicalLine(planId: string, patch: Partial<PhysicalTopupLine>) {
    setPhysicalCart((prev) =>
      prev.map((line) => (line.plan.id === planId ? { ...line, ...patch } : line)),
    );
  }

  function removePhysicalLine(planId: string) {
    setPhysicalCart((prev) => prev.filter((line) => line.plan.id !== planId));
  }

  async function submitNewEsimOrder() {
    if (esimCart.length === 0) {
      alert("Bạn cần chọn ít nhất 1 gói eSIM.");
      return;
    }
    if (!email.trim()) {
      alert("Bạn cần nhập Email nhận đơn.");
      return;
    }

    const prodList = esimCart.map((line) => ({
      wmproductId: line.plan.wmproductId,
      qty: line.qty,
      leSIM: true,
    }));

    const err = validateEsimProdList(prodList);
    if (err) {
      alert(err);
      return;
    }

    const compactProdList = prodList.map((line) => ({
      wmproductId: line.wmproductId,
      qty: line.qty,
    }));

    // receiverEcid = "username_[ecomOrderName]" nếu có nội dung, không thì chỉ "username"
    const ecidSuffix = ecomOrderName.trim();
    const receiverEcid = ecidSuffix ? `${ecomPrefix}${ecidSuffix}` : authUser.username;

    const payload: Record<string, unknown> = {
      company: esimCompany || authUser.username,
      email,
      systemMail,
      receiverEcid,
      autoIssueQr,
      qrcodeType: autoIssueQr ? qrcodeType : undefined,
      prodList: compactProdList,
      submittedAt: new Date().toLocaleString("sv-SE", { timeZone: "Asia/Taipei" }).replace("T", " "),
    };
    setLastOrderPayload(payload);

    const response = await api.run(async () => {
      if (autoIssueQr) {
        try {
          // Luồng: đặt đơn theo email -> backend query + redeem để trả QR ngay.
          return await apiPost<{
            code?: number;
            orderId?: string;
            qrReady?: boolean;
            qrMessage?: string;
            redeemResults?: unknown[];
          }>(
            "/esim/order-with-qr",
            {
              email,
              systemMail,
              qrcodeType,
              prodList: compactProdList,
              receiverEcid,
            },
          );
        } catch {
          // Nếu tài khoản không hỗ trợ order-redeem thì fallback về order thường.
        }
      }

      return apiPost<{ code?: number; orderId?: string }>("/esim/order", {
        email,
        systemMail,
        prodList: compactProdList,
        receiverEcid,
      });
    });

    const remoteOrderId = (response as { orderId?: string })?.orderId;
    const orderNumber = remoteOrderId || makeLocalOrderNumber();
    const time = nowText();
    const fullEcomOrder = receiverEcid;
    const company = esimCompany || authUser.username;

    const newRow: EsimOrderRow = {
      orderNumber,
      company,
      ecommerceOrder: fullEcomOrder || "(Không có)",
      orderDate: time,
      quantity: cartTotalQty,
      productType: "eSIM",
      status: "Success",
      latestHistory: `Shipped ${time}`,
    };

    // Lưu đơn lên backend để cấp trên có thể xem
    void apiPost("/orders", {
      orderNumber,
      company,
      email,
      receiverEcid: fullEcomOrder,
      prodList: compactProdList,
      quantity: cartTotalQty,
      ecommerceOrder: fullEcomOrder || "(Không có)",
      latestHistory: `Shipped ${time}`,
      orderDate: time,
      worldmoveResponse: response,
    }).catch(() => {});

    setCreatedEsimOrders((prev) => [newRow, ...prev]);
    setEsimCart([]);
    setEcomOrderName("");
    setEsimCompany(authUser.username);
    setEsimView("list");
  }

  async function submitPhysicalOrder() {
    if (physicalCart.length === 0) {
      alert("Bạn cần thêm ít nhất 1 dòng SIM.");
      return;
    }
    if (physicalCart.some((line) => !line.sn.trim())) {
      alert("Bạn cần nhập SN cho tất cả dòng.");
      return;
    }
    if (physicalCart.some((line) => line.day < 1 || line.day > 30)) {
      alert("Days chỉ hợp lệ từ 1 đến 30.");
      return;
    }
    if (!physicalCompany.trim()) {
      alert("Bạn cần nhập company.");
      return;
    }

    const prodList = physicalCart.map((line) => ({
      wmproductId: line.plan.wmproductId,
      day: line.day,
      simNum: line.sn.trim(),
    }));
    const depositErr = validateDepositLines(prodList);
    if (depositErr) {
      alert(depositErr);
      return;
    }

    const response = await api.run(() => apiPost<{ orderId?: string }>("/deposit", { prodList }));
    const remoteOrderId = (response as { orderId?: string }).orderId;
    const orderNumber = remoteOrderId || makeLocalOrderNumber();
    const time = nowText();
    const firstSn = physicalCart[0]?.sn ?? "";

    setCreatedPhysicalOrders((prev) => [
      {
        orderNumber,
        sn: firstSn,
        orderDate: time,
        quantity: physicalCart.length,
        note: physicalNote,
        status: "Success",
        latestHistory: `top-up success ${time} (${physicalCompany})`,
      },
      ...prev,
    ]);

    setPhysicalCart([]);
    setPhysicalCompany(authUser.username);
    setPhysicalTaxId(authUser.username);
    setPhysicalNote("");
    setPhysicalView("list");
  }

  return (
    <div className="app">
      <header className="hero">
        <h1>Simdulich.vn</h1>
        {orderOnly ? (
          <p className="muted">
            Đặt eSIM và SIM vật lý qua hệ thống — giá đã bao gồm markup cấp tài khoản của bạn.
          </p>
        ) : (
          <p className="muted">
            Merchant: <code>{health.merchantId || "(chưa cấu hình)"}</code> · Base:{" "}
            <code>{health.baseUrl || "..."}</code>
          </p>
        )}
        <nav className="tabs" role="tablist" aria-label="Chức năng Simdulich.vn">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={activeTab === item.id}
              aria-controls={`panel-${item.id}`}
              tabIndex={activeTab === item.id ? 0 : -1}
              className={`tab ${activeTab === item.id ? "tab--active" : ""}`}
              onClick={() => setActiveTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="tab-panels" role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
        {activeTab === "settings" && !orderOnly && <SettingsTab />}

        {activeTab === "admin" && authUser.role === "admin" && (
          <AdminPanel onPricingUpdated={onPricingUpdated} />
        )}

        {activeTab === "quotes" && !orderOnly && (
          <Section
            title="1. Báo giá sản phẩm"
            subtitle="API QuoteMg/myQueryAll — khuyến nghị query ~1 tuần/lần"
            actions={
              <div className="row">
                <button type="button" onClick={() => void loadQuotes()} disabled={api.loading}>
                  Tải báo giá
                </button>
                <button
                  type="button"
                  className="btn--secondary"
                  onClick={exportPriceListXlsx}
                  disabled={esimPlans.length === 0 && physicalPlans.length === 0}
                >
                  Xuất báo giá Excel
                </button>
              </div>
            }
          >
            <p>Số sản phẩm: {quotes.length}</p>
            {quoteHint ? <p className="muted">{quoteHint}</p> : null}
            <label>
              Chọn sản phẩm eSIM (leSIM=true)
              <select value={esimWmId} onChange={(e) => setEsimWmId(e.target.value)}>
                <option value="">-- chọn --</option>
                {leSimOnlyProducts.map((p) => (
                  <option key={p.wmproductId} value={p.wmproductId}>
                    {p.wmproductId} — {p.productName}
                  </option>
                ))}
              </select>
            </label>
            <ResultBox {...api} />
          </Section>
        )}

        {activeTab === "esim" && (
          <Section
            title={orderOnly ? "Đặt eSIM" : "2. eSIM"}
            subtitle={
              esimView === "list"
                ? "Hiển thị toàn bộ đơn hàng eSIM đã tạo"
                : orderOnly
                  ? "Chọn gói, thêm vào giỏ và gửi đơn"
                  : "Tạo đơn mới: trái lọc, giữa danh sách SIM, phải bảng SIM mua"
            }
            actions={
              esimView === "list" ? (
                <button type="button" onClick={() => setEsimView("create")}>Add</button>
              ) : (
                <button type="button" onClick={() => setEsimView("list")}>Back to list</button>
              )
            }
          >
            {esimView === "list" ? (
              <>
                <div className="esim-order-filters">
                  <input
                    placeholder="Order number"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                  />
                  <input
                    placeholder="E-commerce Order"
                    value={ecomSearch}
                    onChange={(e) => setEcomSearch(e.target.value)}
                  />
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="all">History</option>
                    <option value="Success">Success</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
                <div className="esim-order-table-wrap">
                  <table className="esim-order-table">
                    <thead>
                      <tr>
                        <th>Order number</th>
                        <th>Company</th>
                        <th>E-commerce Order</th>
                        <th>Order Date</th>
                        <th>Quantity</th>
                        <th>Product Type</th>
                        <th>Status</th>
                        <th>Latest History</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((row) => (
                        <tr key={row.orderNumber}>
                          <td>
                            <button
                              type="button"
                              className="link-btn"
                              onClick={() => setSelectedEsimOrder(row)}
                            >
                              {row.orderNumber}
                            </button>
                          </td>
                          <td>{row.company ?? ""}</td>
                          <td>{row.ecommerceOrder}</td>
                          <td>{row.orderDate}</td>
                          <td>{row.quantity}</td>
                          <td>{row.productType}</td>
                          <td>{row.status}</td>
                          <td>{row.latestHistory}</td>
                        </tr>
                      ))}
                      {filteredOrders.length === 0 && (
                        <tr>
                          <td colSpan={7} className="empty-cell">
                            Chua có don eSIM nào.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                {catalogBanner}
                <div className="esim-builder-layout">
                <aside className="esim-filter-panel">
                  <h3>Applicable Region</h3>
                  <label>
                    Region
                    <CountryCombobox
                      options={countryOptions}
                      value={countryFilter}
                      onChange={setCountryFilter}
                    />
                  </label>
                  <label>
                    Plan keyword
                    <input
                      value={planKeyword}
                      onChange={(e) => setPlanKeyword(e.target.value)}
                      placeholder="Lọc theo ký tự gói"
                    />
                  </label>
                  <div className="row">
                    <button type="button" onClick={() => void 0}>Filter</button>
                    <button
                      type="button"
                      onClick={() => {
                        setCountryFilter("all");
                        setPlanKeyword("");
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </aside>

                <div className="esim-plan-list">
                  <h3>Eligible Plans</h3>
                  <div className="esim-plan-items">
                    {filteredPlans.map((plan) => (
                      <div key={plan.id} className="esim-plan-item">
                        <div>
                          <strong>{plan.country}</strong>
                          <p>{plan.planName}</p>
                          <p className="plan-price">{formatVnd(plan.price)}</p>
                        </div>
                        <button type="button" onClick={() => addPlanToCart(plan)}>
                          +
                        </button>
                      </div>
                    ))}
                    {filteredPlans.length === 0 && <p className="muted">Không có gói phù hợp.</p>}
                  </div>
                </div>

                <aside className="esim-cart-panel">
                  <h3>SIM order</h3>
                  <table className="esim-cart-table">
                    <thead>
                      <tr>
                        <th>Product Name</th>
                        <th>Price</th>
                        <th>Quantity</th>
                        <th>Amount</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {esimCart.map((line) => (
                        <tr key={line.plan.id}>
                          <td>{line.plan.planName}</td>
                          <td>
                            <div>{formatVnd(line.plan.price)}</div>
                          </td>
                          <td>
                            <input
                              type="number"
                              min={1}
                              max={20}
                              value={line.qty}
                              onChange={(e) => updateCartQty(line.plan.id, Number(e.target.value))}
                            />
                          </td>
                          <td>
                            <div>{formatVnd(line.plan.price * line.qty)}</div>
                          </td>
                          <td>
                            <button type="button" onClick={() => removeCartLine(line.plan.id)}>
                              x
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p>Total quantity: {cartTotalQty}</p>
                  <p>
                    Total amount:{" "}
                    <strong>{formatVnd(esimTotalAmount)}</strong>
                  </p>
                  <hr />
                  <h3>Receiving Info</h3>
                  <label>
                    Company
                    {authUser.role === "admin" ? (
                      <input
                        value={esimCompany}
                        onChange={(e) => setEsimCompany(e.target.value)}
                        placeholder="Company"
                      />
                    ) : (
                      <input value={esimCompany} readOnly style={{ opacity: 0.7, cursor: "not-allowed" }} />
                    )}
                  </label>
                  <label>
                    Email
                    <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
                  </label>
                  <label>
                    E-commerce Order
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {ecomPrefix && (
                        <span style={{ padding: "4px 8px", background: "var(--color-surface, #333)", borderRadius: 4, whiteSpace: "nowrap", fontSize: "0.9em", opacity: 0.8 }}>
                          {ecomPrefix}
                        </span>
                      )}
                      <input
                        value={ecomOrderName}
                        onChange={(e) => setEcomOrderName(e.target.value)}
                        placeholder="E-commerce Order"
                        style={{ flex: 1 }}
                      />
                    </div>
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={systemMail}
                      onChange={(e) => setSystemMail(e.target.checked)}
                    />
                    systemMail=true (Simdulich.vn gửi mail)
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={autoIssueQr}
                      onChange={(e) => setAutoIssueQr(e.target.checked)}
                    />
                    Xuất QR ngay sau khi đặt eSIM
                  </label>
                  {autoIssueQr ? (
                    <label>
                      Kiểu QR
                      <select
                        value={qrcodeType}
                        onChange={(e) => setQrcodeType(Number(e.target.value))}
                      >
                        <option value={0}>0 — image URL</option>
                        <option value={1}>1 — LPA text</option>
                        <option value={2}>2 — image + LPA</option>
                      </select>
                    </label>
                  ) : null}
                  <button type="button" onClick={() => void submitNewEsimOrder()}>
                    Add
                  </button>
                </aside>
              </div>
              </>
            )}
            <ResultBox {...api} />
            {(lastOrderPayload || api.result) && (
              <div className="order-log-panel">
                <h4>📋 Log đơn hàng</h4>
                {lastOrderPayload && (
                  <div className="order-log-section">
                    <div className="order-log-title">Dữ liệu gửi đi</div>
                    <table className="order-log-table">
                      <tbody>
                        {Object.entries(lastOrderPayload).map(([key, val]) => (
                          <tr key={key}>
                            <td className="log-key">{key}</td>
                            <td className="log-val">
                              {typeof val === "object"
                                ? <pre>{JSON.stringify(val, null, 2)}</pre>
                                : String(val ?? "")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {api.result && (
                  <div className="order-log-section">
                    <div className="order-log-title">Response từ Worldmove</div>
                    <table className="order-log-table">
                      <tbody>
                        {Object.entries(api.result as Record<string, unknown>).map(([key, val]) => (
                          <tr key={key}>
                            <td className="log-key">{key}</td>
                            <td className="log-val">
                              {typeof val === "object"
                                ? <pre>{JSON.stringify(val, null, 2)}</pre>
                                : String(val ?? "")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </Section>
        )}

        {selectedEsimOrder && (
          <div className="modal-overlay" onClick={() => setSelectedEsimOrder(null)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Chi tiết đơn hàng</h3>
                <button type="button" className="modal-close" onClick={() => setSelectedEsimOrder(null)}>✕</button>
              </div>
              <div className="modal-grid">
                <div className="modal-field">
                  <span className="modal-label">Order number</span>
                  <span className="modal-value">{selectedEsimOrder.orderNumber}</span>
                </div>
                <div className="modal-field">
                  <span className="modal-label">Order Status</span>
                  <span className="modal-value">{selectedEsimOrder.latestHistory}</span>
                </div>
                <div className="modal-field">
                  <span className="modal-label">Company</span>
                  <span className="modal-value">{selectedEsimOrder.company}</span>
                </div>
                <div className="modal-field">
                  <span className="modal-label">Order Date</span>
                  <span className="modal-value">{selectedEsimOrder.orderDate}</span>
                </div>
                <div className="modal-field">
                  <span className="modal-label">Product Type</span>
                  <span className="modal-value">{selectedEsimOrder.productType}</span>
                </div>
                <div className="modal-field">
                  <span className="modal-label">Quantity</span>
                  <span className="modal-value">{selectedEsimOrder.quantity}</span>
                </div>
                <div className="modal-field">
                  <span className="modal-label">E-commerce Order</span>
                  <span className="modal-value">{selectedEsimOrder.ecommerceOrder}</span>
                </div>
                <div className="modal-field">
                  <span className="modal-label">Status</span>
                  <span className="modal-value">{selectedEsimOrder.status}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "redeem" && !orderOnly && (
          <Section
            title="3. Redeem mã"
            subtitle="API 3.1 — kết quả qua webhook 3.2 (kích hoạt trong 30 ngày)"
          >
            <label>
              rcode
              <input value={rcode} onChange={(e) => setRcode(e.target.value)} />
            </label>
            <label>
              qrcodeType
              <select value={qrcodeType} onChange={(e) => setQrcodeType(Number(e.target.value))}>
                <option value={0}>0 — image URL</option>
                <option value={1}>1 — LPA text</option>
                <option value={2}>2 — image + LPA</option>
              </select>
            </label>
            <button type="button" onClick={() => void api.run(() => apiPost("/redeem", { rcode, qrcodeType }))}>
              Redeem
            </button>
            <ResultBox {...api} />
          </Section>
        )}

        {activeTab === "physical" && (
          <Section
            title={orderOnly ? "Đặt SIM vật lý" : "4. SIM vật lý"}
            subtitle={
              physicalView === "list"
                ? "Hiển thị danh sách đơn SIM đã tạo"
                : orderOnly
                  ? "Chọn gói, nhập SN và số ngày, gửi đơn nạp"
                  : "Add SIM: trái lọc, giữa danh sách, phải bảng SN và Days (1-30)"
            }
            actions={
              physicalView === "list" ? (
                <button type="button" onClick={() => setPhysicalView("create")}>
                  Add
                </button>
              ) : (
                <button type="button" onClick={() => setPhysicalView("list")}>
                  Back to list
                </button>
              )
            }
          >
            {physicalView === "list" ? (
              <>
                <div className="esim-order-filters">
                  <input
                    placeholder="Order number"
                    value={physicalOrderSearch}
                    onChange={(e) => setPhysicalOrderSearch(e.target.value)}
                  />
                  <input
                    placeholder="SN"
                    value={physicalSnSearch}
                    onChange={(e) => setPhysicalSnSearch(e.target.value)}
                  />
                  <select
                    value={physicalStatusFilter}
                    onChange={(e) => setPhysicalStatusFilter(e.target.value)}
                  >
                    <option value="all">History</option>
                    <option value="Success">Success</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
                <div className="esim-order-table-wrap">
                  <table className="esim-order-table">
                    <thead>
                      <tr>
                        <th>Order number</th>
                        <th>Order Date</th>
                        <th>Quantity</th>
                        <th>Note</th>
                        <th>Status</th>
                        <th>Latest History</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPhysicalOrders.map((row) => (
                        <tr key={row.orderNumber}>
                          <td>{row.orderNumber}</td>
                          <td>{row.orderDate}</td>
                          <td>{row.quantity}</td>
                          <td>{row.note ?? ""}</td>
                          <td>{row.status}</td>
                          <td>{row.latestHistory}</td>
                        </tr>
                      ))}
                      {filteredPhysicalOrders.length === 0 && (
                        <tr>
                          <td colSpan={6} className="empty-cell">
                            Chưa có đơn SIM vật lý nào.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                {catalogBanner}
                <div className="esim-builder-layout">
                <aside className="esim-filter-panel">
                  <h3>Applicable Region</h3>
                  <label>
                    Region
                    <CountryCombobox
                      options={physicalCountryOptions}
                      value={physicalCountryFilter}
                      onChange={setPhysicalCountryFilter}
                    />
                  </label>
                  <label>
                    Plan keyword
                    <input
                      value={physicalPlanKeyword}
                      onChange={(e) => setPhysicalPlanKeyword(e.target.value)}
                      placeholder="Lọc theo ký tự gói"
                    />
                  </label>
                  <div className="row">
                    <button type="button" onClick={() => void 0}>
                      Filter
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPhysicalCountryFilter("all");
                        setPhysicalPlanKeyword("");
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </aside>

                <div className="esim-plan-list">
                  <h3>Eligible Plans</h3>
                  <div className="esim-plan-items">
                    {filteredPhysicalPlans.map((plan) => (
                      <div key={plan.id} className="esim-plan-item">
                        <div>
                          <strong>{plan.country}</strong>
                          <p>{plan.planName}</p>
                          <p className="plan-price">{formatVnd(plan.price)}</p>
                        </div>
                        <button type="button" onClick={() => addPhysicalPlan(plan)}>
                          +
                        </button>
                      </div>
                    ))}
                    {filteredPhysicalPlans.length === 0 && <p className="muted">Không có gói phù hợp.</p>}
                  </div>
                </div>

                <aside className="esim-cart-panel">
                  <h3>SIM Top-up</h3>
                  <table className="esim-cart-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Price</th>
                        <th>Days</th>
                        <th>SN</th>
                        <th>Amount</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {physicalCart.map((line) => (
                        <tr key={line.plan.id}>
                          <td>{line.plan.planName}</td>
                          <td>
                            <div>{formatVnd(line.plan.price)}</div>
                          </td>
                          <td>
                            <select
                              value={line.day}
                              onChange={(e) =>
                                updatePhysicalLine(line.plan.id, { day: Number(e.target.value) })
                              }
                            >
                              {Array.from({ length: 30 }).map((_, i) => (
                                <option key={i + 1} value={i + 1}>
                                  {i + 1}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              placeholder="SN serial"
                              value={line.sn}
                              onChange={(e) => updatePhysicalLine(line.plan.id, { sn: e.target.value })}
                            />
                          </td>
                          <td>
                            <div>{formatVnd(line.plan.price * line.day)}</div>
                          </td>
                          <td>
                            <button type="button" onClick={() => removePhysicalLine(line.plan.id)}>
                              x
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p>Total line: {physicalCart.length}</p>
                  <p>
                    Total amount:{" "}
                    <strong>{formatVnd(physicalTotalAmount)}</strong>
                  </p>
                  <div className="receiving-info-box">
                    <h3>Receiving Info.</h3>
                    <label>
                      Company
                      {authUser.role === "admin" ? (
                        <input
                          value={physicalCompany}
                          onChange={(e) => setPhysicalCompany(e.target.value)}
                          placeholder="Company"
                        />
                      ) : (
                        <input value={physicalCompany} readOnly style={{ opacity: 0.7, cursor: "not-allowed" }} />
                      )}
                    </label>
                    <label>
                      Company Tax ID
                      {authUser.role === "admin" ? (
                        <input
                          value={physicalTaxId}
                          onChange={(e) => setPhysicalTaxId(e.target.value)}
                          placeholder="Tax ID"
                        />
                      ) : (
                        <input value={physicalTaxId} readOnly style={{ opacity: 0.7, cursor: "not-allowed" }} />
                      )}
                    </label>
                    <label>
                      Note
                      <input
                        value={physicalNote}
                        maxLength={100}
                        onChange={(e) => setPhysicalNote(e.target.value)}
                        placeholder="up to 100 words"
                      />
                    </label>
                  </div>
                  <button type="button" onClick={() => void submitPhysicalOrder()}>
                    Add
                  </button>
                </aside>
              </div>
              </>
            )}
            <ResultBox {...api} />
          </Section>
        )}

        {activeTab === "topup" && !orderOnly && (
          <Section title="5. Nạp tiền & vận hành" subtitle="API 5.1 / 5.3 / 5.4">
            <label>
              CSV nạp tiền (wmproductId,day,simNum) — max 500 dòng, day ≤ 30
              <textarea rows={6} value={depositCsv} onChange={(e) => setDepositCsv(e.target.value)} />
            </label>
            <button
              type="button"
              onClick={() => {
                const rawLines = depositCsv
                  .split(/\r?\n/)
                  .map((line) => line.trim())
                  .filter(Boolean);
                const dataLines = rawLines[0]?.toLowerCase().includes("wmproductid")
                  ? rawLines.slice(1)
                  : rawLines;
                const lines = parseJsonLines(dataLines.join("\n"), (line) => {
                  const [wmproductId, day, simNumRaw] = line.split(",");
                  return {
                    wmproductId: wmproductId.trim(),
                    day: Number(day),
                    simNum: simNumRaw.trim(),
                  };
                });
                const err = validateDepositLines(lines);
                if (err) return alert(err);
                void api.run(() => apiPost("/deposit", { prodList: lines }));
              }}
            >
              Nạp tiền (mydeposit)
            </button>

            <div className="grid-2 top-gap">
              <label>
                simNum (remote/reset)
                <input value={simNum} onChange={(e) => setSimNum(e.target.value)} />
              </label>
              <label>
                orderId
                <input value={opOrderId} onChange={(e) => setOpOrderId(e.target.value)} />
              </label>
              <label>
                mcc (remote activation)
                <input value={mcc} onChange={(e) => setMcc(e.target.value)} />
              </label>
            </div>
            <div className="row">
              <button
                type="button"
                onClick={() =>
                  void api.run(() => apiPost("/sim/remote-activate", { simNum, orderId: opOrderId, mcc }))
                }
              >
                Remote Activation (5.3)
              </button>
              <button
                type="button"
                onClick={() => void api.run(() => apiPost("/sim/traffic-reset", { simNum, orderId: opOrderId }))}
              >
                Traffic Reset (5.4)
              </button>
            </div>
            <p className="muted">Nếu depositMap=1 sau reset: cần báo thủ công cho Simdulich.vn.</p>
            <ResultBox {...api} />
          </Section>
        )}

        {activeTab === "query" && !orderOnly && (
          <Section title="6. Tra cứu" subtitle="Usage / Basic Info / Progress / simExists">
            <div className="grid-2">
              <label>
                rcode
                <input value={queryRcode} onChange={(e) => setQueryRcode(e.target.value)} />
              </label>
              <label>
                simNum + orderId
                <input
                  placeholder="simNum"
                  value={querySimNum}
                  onChange={(e) => setQuerySimNum(e.target.value)}
                />
                <input
                  placeholder="orderId"
                  value={queryOrderId}
                  onChange={(e) => setQueryOrderId(e.target.value)}
                />
              </label>
            </div>
            <div className="row">
              <button
                type="button"
                onClick={() =>
                  void api.run(() =>
                    apiPost("/query/usage", {
                      ...(queryRcode ? { rcode: queryRcode } : { simNum: querySimNum, orderId: queryOrderId }),
                    }),
                  )
                }
              >
                Usage (6.1)
              </button>
              <button type="button" onClick={() => void api.run(() => apiPost("/query/basic-info", { rcode: queryRcode }))}>
                Basic Info (6.2)
              </button>
              <button
                type="button"
                onClick={() => void api.run(() => apiPost("/query/esim-progress", { rcode: queryRcode }))}
              >
                eSIM Progress (6.3)
              </button>
              <button
                type="button"
                onClick={() => {
                  const err = validateSimNum20(querySimNum);
                  if (err) return alert(err);
                  void api.run(() => apiPost("/sim/exists", { simNum: querySimNum }));
                }}
              >
                simExists (6.4)
              </button>
            </div>
            <ResultBox {...api} />
          </Section>
        )}

        {activeTab === "webhooks" && !orderOnly && (
          <Section title="Webhook nhận từ Simdulich.vn" subtitle="Phản hồi bắt buộc: &quot;1&quot;">
            <WebhookPanel />
          </Section>
        )}
        {activeTab === "manage" && (authUser.role === "tong_kho" || authUser.role === "admin") && (
          <Section title="Quản lý đại lý" subtitle="Tạo và chỉnh sửa tài khoản đại lý cấp dưới">
            <ManagePanel authUser={authUser} />
          </Section>
        )}

        {activeTab === "report" && (
          <OrdersReport authUser={authUser} />
        )}
      </main>
    </div>
  );
}

export default App;

// ─── ManagePanel ──────────────────────────────────────────────────────────────

type ManagedUser = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  markupVnd: number;
  active: boolean;
  parentId: string | null;
};

async function manageApiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(opts?.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) {
    const msg = (json as { message?: string; error?: string })?.message
      || (json as { message?: string; error?: string })?.error
      || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

function ManagePanel({ authUser }: { authUser: AuthUser }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newMarkup, setNewMarkup] = useState("8");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await manageApiFetch<{ users: ManagedUser[] }>("/api/manage/users");
      setUsers(data.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tải danh sách.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const handleCreate = async () => {
    if (!newUsername.trim() || !newPassword.trim()) {
      setCreateMsg("Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.");
      return;
    }
    setCreating(true);
    setCreateMsg(null);
    try {
      await manageApiFetch("/api/manage/users", {
        method: "POST",
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword.trim(),
          displayName: newDisplayName.trim() || newUsername.trim(),
          markupVnd: Number(newMarkup) || 8,
        }),
      });
      setNewUsername("");
      setNewPassword("");
      setNewDisplayName("");
      setNewMarkup("8");
      setCreateMsg("Tạo tài khoản thành công.");
      await loadUsers();
    } catch (e) {
      setCreateMsg(e instanceof Error ? e.message : "Lỗi tạo tài khoản.");
    } finally {
      setCreating(false);
    }
  };

  const handleMarkupChange = async (userId: string, value: number) => {
    try {
      await manageApiFetch(`/api/manage/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ markupVnd: value }),
      });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, markupVnd: value } : u));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Lỗi cập nhật markup.");
    }
  };

  const handleToggleActive = async (userId: string, current: boolean) => {
    try {
      await manageApiFetch(`/api/manage/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !current }),
      });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, active: !current } : u));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Lỗi cập nhật trạng thái.");
    }
  };

  const roleLabel = authUser.role === "admin" ? "Tổng kho" : "Đại lý";

  return (
    <div>
      {/* Create form */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h3 style={{ margin: "0 0 1rem" }}>Tạo {roleLabel} mới</h3>
        <div className="form-grid">
          <label className="form-label">Tên đăng nhập *</label>
          <input className="form-input" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="username" />
          <label className="form-label">Mật khẩu *</label>
          <input className="form-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" />
          <label className="form-label">Tên hiển thị</label>
          <input className="form-input" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} placeholder="(mặc định = username)" />
          <label className="form-label">Markup %</label>
          <input className="form-input" type="number" min="0" max="100" value={newMarkup} onChange={(e) => setNewMarkup(e.target.value)} />
        </div>
        <button className="btn btn--primary" style={{ marginTop: "1rem" }} onClick={handleCreate} disabled={creating}>
          {creating ? "Đang tạo…" : `Tạo ${roleLabel}`}
        </button>
        {createMsg && <p style={{ marginTop: "0.5rem", color: createMsg.includes("thành công") ? "green" : "red" }}>{createMsg}</p>}
      </div>

      {/* List */}
      <h3 style={{ margin: "0 0 0.75rem" }}>Danh sách {roleLabel}</h3>
      {loading && <p>Đang tải…</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {!loading && !error && users.length === 0 && <p>Chưa có tài khoản nào.</p>}
      {!loading && users.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Tên hiển thị</th>
              <th>Vai trò</th>
              <th>Markup %</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.displayName}</td>
                <td>{u.role}</td>
                <td>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    style={{ width: "70px" }}
                    defaultValue={u.markupVnd}
                    onBlur={(e) => handleMarkupChange(u.id, Number(e.target.value))}
                  />
                </td>
                <td>
                  <button
                    className={`btn ${u.active ? "btn--danger" : "btn--primary"}`}
                    style={{ padding: "0.2rem 0.6rem", fontSize: "0.8rem" }}
                    onClick={() => handleToggleActive(u.id, u.active)}
                  >
                    {u.active ? "Khoá" : "Mở khoá"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
