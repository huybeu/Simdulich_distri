# Simdulich.vn

Giao diện React (điều hướng theo tab) + backend Node.js/Express — hệ thống vận hành eSIM / SIM du lịch.

## Cấu trúc

- `frontend/` — Vite + React + TypeScript (UI Simdulich.vn)
- `backend/` — Express proxy + SHA1 `encStr` + webhook nhận callback

## Cài đặt

```bash
copy .env.example .env
# Sửa WORLDMOVE_MERCHANT_ID, WORLDMOVE_DEPT_ID, WORLDMOVE_TOKEN trong .env

npm install
npm install --prefix frontend
npm install --prefix backend
```

## Chạy dev

```bash
npm run dev
```

- UI: http://localhost:5173
- API: http://localhost:4000

## Quản trị & phân cấp giá

Hệ thống có 3 cấp tài khoản:

| Cấp | Vai trò |
|-----|---------|
| `admin` | Quản trị — xem **giá gốc NT**, tab **Quản trị** |
| `tong_kho` | Tổng kho — **3 màn hình**: Đặt eSIM, Đặt SIM vật lý, **Quản lý đại lý** |
| `dai_ly` | Đại lý — **2 màn hình**: Đặt eSIM, Đặt SIM vật lý (giá + markup) |

Tổng kho và đại lý đặt SIM qua tài khoản admin (API cấu hình trên máy admin). Admin giữ đầy đủ tab vận hành.

**Tài khoản mẫu** (tạo lần đầu khi chưa có `backend/data/users.json`):

| Đăng nhập | Mật khẩu | Markup mẫu |
|-----------|----------|------------|
| `admin` | `admin123` | 0% (giá gốc) |
| `tongkho` | `tongkho123` | 3% |
| `daily` | `daily123` | 8% |

Admin có thể:

- Chỉnh **tỷ giá NT→VND** và markup mặc định theo cấp (tab Quản trị)
- Chỉnh **markup % riêng** trên từng tài khoản (blur ô input trong bảng)
- Tạo tài khoản **Tổng kho** mới (tab Quản lý đại lý — hiển thị với admin dưới nhãn "Tổng kho")

Tổng kho có thể:

- Tạo tài khoản **Đại lý** của riêng mình (tab Quản lý đại lý)
- Chỉnh **markup %** và **khoá / mở khoá** từng đại lý cấp dưới
- Xem **toàn bộ đơn hàng** do đại lý thuộc nhánh mình tạo

Tổng kho 1 **chỉ thấy đơn** từ đại lý mà chính nó tạo ra (phân vùng riêng biệt giữa các tổng kho).

Dữ liệu lưu tại `backend/data/` (JSON, không commit git).

### API phân quyền quản lý

| Endpoint | Phương thức | Mô tả |
|----------|-------------|-------|
| `/api/manage/users` | `GET` | admin: tất cả users; tong_kho: danh sách đại lý trực tiếp |
| `/api/manage/users` | `POST` | admin tạo tong_kho; tong_kho tạo dai_ly |
| `/api/manage/users/:id` | `PATCH` | Cập nhật markupPercent / active / password (chỉ con trực tiếp) |
| `/api/orders` | `GET` | Trả đơn theo cấp bậc (admin: tất cả; tong_kho: nhánh của mình; dai_ly: của mình) |
| `/api/orders` | `POST` | Lưu đơn eSIM sau khi đặt thành công |

## Webhook (cấu hình trên cổng API nhà cung cấp)

Trỏ về máy bạn (cần expose public, ví dụ ngrok):

| API | Path |
|-----|------|
| 2.2 eSIM Order Callback | `POST /webhooks/worldmove/esim-order` |
| 2.5 eSIM Order & Redeem Callback | `POST /webhooks/worldmove/esim-order-redeem` |
| 3.2 Redeem Callback | `POST /webhooks/worldmove/redeem` |
| 5.2 Top-up Callback | `POST /webhooks/worldmove/topup` |

Backend **bắt buộc** trả về chuỗi `"1"` (đã implement).

## Lưu ý nghiệp vụ đã validate ở UI + server

- eSIM: tổng `qty` ≤ 20, sản phẩm `leSIM=true` (khi chọn từ báo giá)
- Nạp tiền: `day` ≤ 30, tối đa 500 dòng, không trùng `simNum`
- simExists: `simNum` đúng 20 chữ số
- SIM vật lý: `taxId` và `note` bắt buộc (có thể chuỗi rỗng)

## Production URL

`https://fmshippingsys.fastmove.com.tw` (mặc định trong `.env.example`)

---

## Ghi chú: Thay đổi placeholder "E-commerce Order" trên Worldmove Admin UI

Field `E-commerce Order` trong giao diện Worldmove (`receiverEcid`) hiển thị placeholder lấy từ key đa ngôn ngữ `ecommerceOrder`. Có 2 cách thay đổi:

### Cách 1: Sửa trực tiếp trong HTML (nhanh nhất nếu không dùng đa ngôn ngữ)

Xóa bỏ `ng-attr-placeholder="{{ 'ecommerceOrder' | translate }}"` và hardcode `placeholder` trong thẻ `<input>`:

```html
<div class="col-sm-10">
    <input type="text" maxlength="50" name="receiverEcid_esim" ng-model="form.receiverEcid"
        class="form-control" id="inputEcid" placeholder="Worldmove Order" style="">
</div>
```

> Lưu ý: Xóa `ng-attr-placeholder` để Angular không ghi đè lại giá trị cũ.

### Cách 2: Sửa qua file ngôn ngữ (khuyên dùng)

Giữ nguyên HTML, vào file cấu hình ngôn ngữ (thường trong `assets/i18n/`) và sửa key `ecommerceOrder`:

**`en.json`**
```json
{
  "ecommerceOrder": "Worldmove Order"
}
```

**`vi.json`**
```json
{
  "ecommerceOrder": "Đơn hàng Worldmove"
}
```

### Ghi chú cho Dev tích hợp API

- Thay đổi nội dung hiển thị (placeholder) của ô nhập liệu từ `"E-commerce Order"` thành `"Đơn hàng [Tên_Công_Ty]"` hoặc `"Đơn hàng Worldmove"` để phù hợp với luồng nghiệp vụ đặt hàng eSIM.
- Cách thực hiện: Cập nhật giá trị key `'ecommerceOrder'` trong các file ngôn ngữ (`en.json`, `vi.json`) để đồng bộ toàn hệ thống, tránh sửa cứng (hardcode) trong HTML.
