type ResultBoxProps = {
  loading: boolean;
  error: string | null;
  hint: string | null;
  result: unknown;
};

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function extractQrCandidates(input: unknown): string[] {
  const out: string[] = [];

  function walk(node: unknown): void {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== "object") return;

    const obj = node as Record<string, unknown>;
    const qrcode = obj.qrcode;
    if (typeof qrcode === "string" && qrcode.trim()) {
      out.push(qrcode.trim());
    }
    const qrcodeContent = obj.qrcodeContent;
    if (typeof qrcodeContent === "string" && qrcodeContent.trim()) {
      out.push(qrcodeContent.trim());
    }

    Object.values(obj).forEach(walk);
  }

  walk(input);
  return Array.from(new Set(out));
}

export function ResultBox({ loading, error, hint, result }: ResultBoxProps) {
  const qrCandidates = result ? extractQrCandidates(result) : [];
  const qrUrls = qrCandidates.filter(isHttpUrl);
  const qrTexts = qrCandidates.filter((v) => !isHttpUrl(v));

  return (
    <div className="result-box">
      {loading ? <p className="info">Đang xử lý...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {hint ? <p className="hint">{hint}</p> : null}
      {qrUrls.length > 0 ? (
        <div className="qr-preview-wrap">
          {qrUrls.slice(0, 4).map((url) => (
            <figure key={url} className="qr-preview">
              <img src={url} alt="QR eSIM" loading="lazy" />
              <figcaption>
                <a href={url} target="_blank" rel="noreferrer">
                  Mở QR
                </a>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      {qrTexts.length > 0 ? (
        <div className="qr-text">
          <strong>QR/LPA text:</strong>
          <pre>{qrTexts.slice(0, 2).join("\n\n")}</pre>
        </div>
      ) : null}
      <pre>{result ? JSON.stringify(result, null, 2) : "Chưa có kết quả."}</pre>
    </div>
  );
}
