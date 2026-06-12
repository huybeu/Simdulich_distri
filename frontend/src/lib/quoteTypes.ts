export type QuoteProduct = {
  wmproductId: string;
  productName: string;
  leSIM?: boolean;
  productType?: number;
  productPrice?: number;
};

export type QuoteCachePayload = {
  savedAt: number;
  prodList: QuoteProduct[];
};

export const QUOTE_CACHE_KEY = "worldmove-quotes-cache-v1";
export const QUOTE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function readQuoteCache(): QuoteCachePayload | null {
  try {
    const raw = localStorage.getItem(QUOTE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuoteCachePayload;
    if (!Array.isArray(parsed.prodList) || typeof parsed.savedAt !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeQuoteCache(prodList: QuoteProduct[]): void {
  localStorage.setItem(
    QUOTE_CACHE_KEY,
    JSON.stringify({ savedAt: Date.now(), prodList } satisfies QuoteCachePayload),
  );
}
