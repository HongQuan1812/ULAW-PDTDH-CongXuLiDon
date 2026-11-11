# Kế hoạch

## Giai đoạn 1: Frontend, dùng API giả (đang làm)

Mỗi bước làm trên một nhánh riêng. Xong thì tạo Pull Request vào `main`.

| # | Bước | Nhánh | Gồm | |
|---|---|---|---|---|
| 0 | Nền móng | `setup` | pnpm workspace, Vite + React, Router, TanStack Query, MSW | ✓ |
| 1 | Giao diện chung, luật dùng chung | `setup` | màu, font từ bản mẫu · `shared/` trạng thái, vai trò, quyền | ✓ |
| 2 | Đăng nhập, khung trang | `dang-nhap` | đăng nhập giả theo vai trò · thanh menu theo quyền · đăng xuất | ✓ |
| 3 | Hồ sơ cá nhân | `ho-so` | lần đầu đăng nhập xác nhận họ tên · trang thông tin, sửa CCCD / SĐT | ✓ |
| 4 | Nộp đơn | `nop-don` | form theo cấu trúc loại đơn (Xét miễn môn) · bảng · tải tệp · gửi đơn | ✓ |
| 5 | Chi tiết, xử lí đơn | `xu-li-don` | trang chi tiết đơn · sửa đơn · tiếp nhận · yêu cầu bổ sung · duyệt · từ chối · chuyển giao · xem hồ sơ người nộp đơn · câu thông báo | ✓ |
| 6 | Quản lí đơn | `quan-li-don` | bảng tìm, lọc, sắp xếp, phân trang · xem nhanh · thống kê | ✓ |
| 7 | Loại đơn, trình soạn form | `soan-loai-don` | danh sách loại đơn · mở / đóng · trình soạn kiểu Google Form | ✓ |
| 8 | Quản lí tài khoản | `tai-khoan` | tạo, sửa tài khoản · phân vai trò (Admin) || ✓ |
| 9 | Xem tệp, xuất Word | `xuat-file` | xem ảnh / PDF / Word · xuất theo mẫu Word | |

### Làm một màn hình

1. Khai báo endpoint và schema (Zod) trong `shared/src/api-contract/<nhóm>.ts`.
2. Viết API giả trong `web/src/mocks/handlers/`.
3. Viết hook gọi API trong `web/src/api/`.
4. Làm giao diện, đối chiếu với bản mẫu.

### API giả (MSW)

- Frontend gọi `fetch('/api/...')` như thật. MSW chặn lại và trả dữ liệu giả, nên trang không biết mình đang dùng API giả.
- Bật / tắt bằng `VITE_USE_MOCKS` trong `web/.env.development`.
- API giả làm đúng luật nghiệp vụ (chuyển trạng thái, kiểm tra quyền, sinh mã đơn) và trả lỗi như thật (401, 403, 404, 409, 422).
- Dữ liệu giả lấy từ `artifact/js/sample-data.js` và `TYPES` trong `config.js`, giữ trong bộ nhớ. Tải lại trang là về ban đầu.
- Đăng nhập giả: `POST /api/auth/dev-login` với vai trò chọn sẵn. Chỉ có ở API giả, backend thật không có.

## Giai đoạn 2: Backend

Làm `api/` (NestJS + Prisma + PostgreSQL) theo đúng hợp đồng trong `shared/src/api-contract/`.
Xong nhóm API nào thì tắt API giả của nhóm đó. Giao diện không phải sửa.
