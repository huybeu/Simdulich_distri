export type CatalogProduct = {
  wmproductId: string;
  productName: string;
  leSIM: boolean;
  productType?: number;
  productPrice: number;
};

function parseLeSim(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s === "true" || s === "1" || s === "y" || s === "yes";
  }
  return false;
}

function normalizeRow(raw: Record<string, unknown>): CatalogProduct | null {
  const wmproductId = String(
    raw.wmproductId ?? raw.productId ?? raw.wmProductId ?? "",
  ).trim();
  if (!wmproductId) return null;

  const productName = String(raw.productName ?? raw.name ?? wmproductId).trim();
  const productPrice = Number(raw.productPrice ?? raw.price ?? raw.product_price ?? 0);

  return {
    wmproductId,
    productName,
    leSIM: parseLeSim(raw.leSIM ?? raw.leSim ?? raw.lesim ?? raw.isLeSIM),
    productType:
      raw.productType !== undefined ? Number(raw.productType) : undefined,
    productPrice: Number.isFinite(productPrice) ? productPrice : 0,
  };
}

/** Trích prodList từ nhiều dạng JSON Worldmove trả về. */
export function extractCatalogProducts(data: unknown): CatalogProduct[] {
  if (!data || typeof data !== "object") return [];

  const root = data as Record<string, unknown>;
  const candidates: unknown[] = [];

  if (Array.isArray(root.prodList)) candidates.push(root.prodList);
  if (Array.isArray(root.productList)) candidates.push(root.productList);
  if (Array.isArray(root.list)) candidates.push(root.list);

  const nested = root.data;
  if (nested && typeof nested === "object") {
    const inner = nested as Record<string, unknown>;
    if (Array.isArray(inner.prodList)) candidates.push(inner.prodList);
    if (Array.isArray(inner.productList)) candidates.push(inner.productList);
  }

  const rawList = candidates.find((c) => Array.isArray(c)) as
    | Array<Record<string, unknown>>
    | undefined;
  if (!rawList) return [];

  const out: CatalogProduct[] = [];
  for (const row of rawList) {
    if (!row || typeof row !== "object") continue;
    const normalized = normalizeRow(row as Record<string, unknown>);
    if (normalized) out.push(normalized);
  }
  return out;
}
