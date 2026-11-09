## Giai đoạn hiện tại: làm FE trước, API giả bằng MSW

Frontend gọi API thật bằng `fetch('/api/...')` như bình thường. **MSW** chặn các request này và trả dữ liệu giả.
Code frontend vì vậy **không biết mình đang chạy với API giả**. Khi có backend thật chỉ cần tắt MSW, không phải sửa trang nào.

- Bật / tắt bằng biến môi trường `VITE_USE_MOCKS=true` trong `web/.env.development`.
- **Hợp đồng API viết trong `shared/src/api.ts`**: danh sách endpoint, kiểu request / response viết bằng Zod.
  MSW và frontend cùng dùng file này. Sau này backend NestJS cũng làm theo đúng file này,
  nên giai đoạn làm FE cũng chính là giai đoạn thiết kế API.
- Handler MSW **làm đúng luật nghiệp vụ**: chuyển trạng thái, kiểm tra quyền theo vai trò, sinh mã đơn.
  Trả lỗi giống API thật (401, 403, 404, 409, 422) để giao diện xử lí lỗi ngay từ đầu.
- Dữ liệu giả lấy từ `artifact/js/sample-data.js` và `TYPES` trong `config.js`, giữ trong bộ nhớ (tải lại trang là về ban đầu).
- Đăng nhập giả: `POST /api/auth/dev-login` với vai trò chọn sẵn (thay cho phần chọn vai trò `JUST FOR DEMO` trong bản mẫu).
  Endpoint này chỉ có trong mock, backend thật không có.
- Có thể thêm độ trễ giả (`delay()`) để thử trạng thái đang tải.

Quy trình khi làm một màn hình mới:
1. Khai báo endpoint và schema trong `shared/src/api.ts`.
2. Viết handler trong `web/src/mocks/handlers/`.
3. Viết hook TanStack Query trong `web/src/api/`.
4. Làm giao diện.
