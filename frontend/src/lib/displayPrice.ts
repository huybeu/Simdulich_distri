/** Định dạng số VND (giá đã tính markup). */
export function formatVnd(vndAmount: number): string {
  return `${Math.round(vndAmount).toLocaleString("vi-VN")} VND`;
}

/** @deprecated dùng formatVnd — giá plan đã là VND */
export function formatVndFromNt(ntAmount: number, rate: number): string {
  return formatVnd(ntAmount * rate);
}

export function formatNt(ntAmount: number): string {
  return `${ntAmount.toLocaleString()} NT`;
}
