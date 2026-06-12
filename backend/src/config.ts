import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load .env from repo root (one level above backend/).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const config = {
  port: Number(process.env.PORT ?? 4000),
  worldmoveBaseUrl:
    process.env.WORLDMOVE_BASE_URL?.trim() ??
    "https://fmshippingsys.fastmove.com.tw",
  /** Có thể để trống — UI gửi qua header sau khi lưu tab Cấu hình. */
  merchantId: process.env.WORLDMOVE_MERCHANT_ID?.trim() ?? "",
  deptId: process.env.WORLDMOVE_DEPT_ID?.trim() ?? "",
  token: process.env.WORLDMOVE_TOKEN?.trim() ?? "",
};
