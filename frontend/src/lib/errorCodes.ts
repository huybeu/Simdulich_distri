export type ErrorUiHint = {
  title: string;
  ui: string;
  tone: "success" | "error" | "warning" | "info";
};

/** Vietnamese UI mapping from API v2.0.0 spec (Attachment 1 + user table). */
export const ERROR_CODE_UI: Record<number, ErrorUiHint> = {
  0: {
    title: "Thành công",
    ui: "Hiển thị màu xanh lá, tiếp tục luồng dữ liệu.",
    tone: "success",
  },
  400: {
    title: "Thiếu tham số",
    ui: "Báo đỏ viền ô nhập liệu thiếu thông tin.",
    tone: "error",
  },
  401: {
    title: "Lỗi chữ ký encStr",
    ui: "Cảnh báo lỗi bảo mật hệ thống nội bộ.",
    tone: "error",
  },
  402: {
    title: "Không có sản phẩm",
    ui: 'Hiển thị "Sản phẩm không khả dụng".',
    tone: "error",
  },
  403: {
    title: "Số lượng = 0",
    ui: "Khóa nút gửi khi số lượng bằng 0.",
    tone: "warning",
  },
  404: {
    title: "Số ngày nạp = 0",
    ui: "Chặn và bắt buộc chọn số ngày nạp hợp lệ.",
    tone: "warning",
  },
  405: {
    title: "Thiếu số thẻ",
    ui: "Yêu cầu nhập số thẻ.",
    tone: "error",
  },
  406: {
    title: "Ngoài phạm vi",
    ui: "Giới hạn số ngày/số thẻ ngay trên bộ chọn.",
    tone: "warning",
  },
  407: {
    title: "orderId sai",
    ui: "Báo đỏ trường nhập ID đơn hàng.",
    tone: "error",
  },
  408: {
    title: "eSIM chưa sẵn sàng",
    ui: 'Hiển thị loading "Đang tạo eSIM...".',
    tone: "info",
  },
  409: {
    title: "Đặt eSIM thất bại",
    ui: "Hiển thị cảnh báo lỗi giao dịch màu đỏ lớn.",
    tone: "error",
  },
  410: {
    title: "Không reset được",
    ui: 'Khóa chức năng "Traffic Reset" cho SIM này.',
    tone: "warning",
  },
  411: {
    title: "Số thẻ không tồn tại",
    ui: 'Cảnh báo "Số thẻ sai hoặc không thuộc quyền quản lý".',
    tone: "error",
  },
  801: {
    title: "Gói nạp không hỗ trợ",
    ui: "Thông báo lỗi không hỗ trợ gói cước nạp.",
    tone: "error",
  },
  802: {
    title: "Vượt 30 ngày",
    ui: "Giới hạn tối đa 30 ngày trên thanh cuộn nhập liệu.",
    tone: "warning",
  },
  804: {
    title: "Vượt 500 thẻ",
    ui: "Chặn CSV có trên 500 dòng.",
    tone: "warning",
  },
  805: {
    title: "Hết hàng",
    ui: 'Đổi nút thành "Hết hàng".',
    tone: "warning",
  },
  808: {
    title: "Trùng số thẻ",
    ui: "Kích hoạt bộ lọc loại bỏ dòng trùng lặp.",
    tone: "warning",
  },
  996: {
    title: "Tài khoản bị đóng băng",
    ui: "Khóa toàn bộ giao dịch, liên hệ nhà cung cấp.",
    tone: "error",
  },
  999: {
    title: "Giao dịch thất bại",
    ui: "Thử lại hoặc liên hệ hỗ trợ kỹ thuật.",
    tone: "error",
  },
};

export function mapApiCode(code: unknown, msg?: string): ErrorUiHint {
  const numeric = typeof code === "number" ? code : Number(code);
  const mapped = ERROR_CODE_UI[numeric];
  if (mapped) {
    return {
      ...mapped,
      title: msg ? `${mapped.title}: ${msg}` : mapped.title,
    };
  }
  return {
    title: msg ?? "Phản hồi không xác định",
    ui: "Kiểm tra JSON chi tiết bên dưới.",
    tone: "info",
  };
}
