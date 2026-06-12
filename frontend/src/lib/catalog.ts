import type { QuoteProduct } from "./quoteTypes";

export type CatalogResponse = {
  prodList: QuoteProduct[];
  esimProducts: QuoteProduct[];
  count: number;
  esimCount: number;
  msg?: string;
};
