import { useCallback, useState } from "react";
import { mapApiCode } from "../lib/errorCodes";

export function useApiAction() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const run = useCallback(async (task: () => Promise<unknown>) => {
    setLoading(true);
    setError(null);
    setHint(null);
    try {
      const data = await task();
      setResult(data);
      const code = (data as { code?: number })?.code;
      if (typeof code === "number") {
        const mapped = mapApiCode(code, (data as { msg?: string }).msg);
        setHint(`${mapped.title} — ${mapped.ui}`);
      }
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Lỗi không xác định";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, result, error, hint, run, setResult };
}
