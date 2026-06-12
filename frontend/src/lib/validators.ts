export function parseJsonLines<T>(raw: string, mapLine: (line: string) => T): T[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(mapLine);
}

export function validateEsimProdList(
  prodList: Array<{ wmproductId: string; qty: number; leSIM?: boolean }>,
): string | null {
  const total = prodList.reduce((sum, row) => sum + row.qty, 0);
  if (total <= 0) return "Số lượng mua phải lớn hơn 0.";
  if (total > 20) return "Mỗi đơn chỉ được tối đa 20 eSIM.";
  if (prodList.some((row) => row.leSIM === false)) {
    return "Chỉ hỗ trợ sản phẩm leSIM=true (Simdulich.vn).";
  }
  return null;
}

export function validateDepositLines(
  lines: Array<{ wmproductId: string; day: number; simNum: string }>,
): string | null {
  if (lines.length === 0) return "Danh sách nạp không được rỗng.";
  if (lines.length > 500) return "Mỗi lô nạp tối đa 500 thẻ SIM.";

  const seen = new Set<string>();
  for (const row of lines) {
    if (row.day <= 0) return "Số ngày nạp phải lớn hơn 0.";
    if (row.day > 30) return "Số ngày nạp không được vượt quá 30.";
    if (!row.simNum.trim()) return "Số thẻ SIM không được để trống.";
    if (seen.has(row.simNum)) return "Phát hiện số thẻ SIM trùng lặp.";
    seen.add(row.simNum);
  }
  return null;
}

export function validateSimNum20(simNum: string): string | null {
  if (!/^\d{20}$/.test(simNum)) {
    return "Số thẻ phải đúng 20 chữ số (half-width), không khoảng trắng/ký tự khác.";
  }
  return null;
}
