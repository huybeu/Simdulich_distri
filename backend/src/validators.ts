/** Server-side guards mirroring client rules from Worldmove v2.0.0 spec. */

export function totalQty(prodList: Array<{ qty: number }>): number {
  return prodList.reduce((sum, row) => sum + row.qty, 0);
}

export function assertEsimQtyLimit(prodList: Array<{ qty: number }>): void {
  const total = totalQty(prodList);
  if (total <= 0) {
    throw new Error("Số lượng eSIM phải lớn hơn 0.");
  }
  if (total > 20) {
    throw new Error("Mỗi đơn chỉ được tối đa 20 eSIM.");
  }
}

export function assertDepositRules(
  prodList: Array<{ day: number; simNum: string }>,
): void {
  if (prodList.length === 0) {
    throw new Error("Danh sách nạp tiền không được rỗng.");
  }
  if (prodList.length > 500) {
    throw new Error("Mỗi lô nạp tối đa 500 thẻ SIM.");
  }

  const seen = new Set<string>();
  for (const row of prodList) {
    if (row.day <= 0) {
      throw new Error("Số ngày nạp phải lớn hơn 0.");
    }
    if (row.day > 30) {
      throw new Error("Số ngày nạp không được vượt quá 30.");
    }
    if (!row.simNum?.trim()) {
      throw new Error("Số thẻ SIM không được để trống.");
    }
    if (seen.has(row.simNum)) {
      throw new Error("Phát hiện số thẻ SIM trùng lặp trong danh sách.");
    }
    seen.add(row.simNum);
  }
}

/** API 6.4: exactly 20 half-width digits. */
export function assertSimNumFormat(simNum: string): void {
  if (!/^\d{20}$/.test(simNum)) {
    throw new Error(
      "Số thẻ phải đúng 20 ký tự, chỉ gồm chữ số (không khoảng trắng/ký tự khác).",
    );
  }
}

export function assertRequired(value: string, label: string): void {
  if (!value?.trim()) {
    throw new Error(`${label} không được để trống.`);
  }
}
