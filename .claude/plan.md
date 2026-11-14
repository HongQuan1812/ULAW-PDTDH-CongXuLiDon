# Kế hoạch

## Giai đoạn 1: Frontend, dùng API giả ✓

Mỗi bước làm trên một nhánh riêng. Xong thì tạo Pull Request vào `main`.

| # | Bước | Nhánh | Gồm | |
|---|---|---|---|---|
| 0 | Nền móng | `setup` | pnpm workspace, Vite + React, Router, TanStack Query, MSW | ✓ |
| 1 | Giao diện chung, luật dùng chung | `setup` | màu, font · `shared/` trạng thái, vai trò, quyền | ✓ |
| 2 | Đăng nhập, khung trang | `dang-nhap` | đăng nhập giả theo vai trò · thanh menu theo quyền · đăng xuất | ✓ |
| 3 | Hồ sơ cá nhân | `ho-so` | lần đầu đăng nhập xác nhận họ tên · trang thông tin, sửa CCCD / SĐT | ✓ |
| 4 | Nộp đơn | `nop-don` | form theo cấu trúc loại đơn (Xét miễn môn) · bảng · tải tệp · gửi đơn | ✓ |
| 5 | Chi tiết, xử lí đơn | `xu-li-don` | trang chi tiết đơn · sửa đơn · tiếp nhận · yêu cầu bổ sung · duyệt · từ chối · chuyển giao · xem hồ sơ người nộp đơn · câu thông báo | ✓ |
| 6 | Quản lí đơn | `quan-li-don` | bảng tìm, lọc, sắp xếp, phân trang · xem nhanh · thống kê | ✓ |
| 7 | Loại đơn, trình soạn form | `soan-loai-don` | danh sách loại đơn · mở / đóng · trình soạn kiểu Google Form | ✓ |
| 8 | Quản lí tài khoản | `tai-khoan` | tạo, sửa tài khoản · phân vai trò (Admin) | ✓ |
| 9 | Xem tệp, xuất Word | `xuat-file` | xem ảnh / PDF / Word · xuất theo mẫu Word | ✓ |

### Làm một màn hình

1. Khai báo endpoint và schema (Zod) trong `shared/src/api-contract/<nhóm>.ts`.
2. Viết API giả trong `web/src/mocks/handlers/`.
3. Viết hook gọi API trong `web/src/api/`.
4. Làm giao diện, đối chiếu với `docs/business-rules.md`.

### API giả (backend giả, MSW)

- Frontend gọi `fetch('/api/...')` như thật. MSW chặn lại và trả dữ liệu giả, nên trang không biết mình đang dùng API giả.
- Bật / tắt bằng `VITE_USE_MOCK_BACKEND` trong `web/.env.development`. Biến này chỉ chọn backend giả hay thật; chức năng thử nghiệm do `VITE_APP_ENV` / `APP_ENV` quản (README, mục Biến môi trường).
- API giả làm đúng luật nghiệp vụ (chuyển trạng thái, kiểm tra quyền, sinh mã đơn) và trả lỗi như thật (401, 403, 404, 409, 422).
- Dữ liệu giả nằm trong `web/src/mocks/db.ts`, giữ trong bộ nhớ. Tải lại trang là về ban đầu.
- Đăng nhập thử: `POST /api/auth/dev-login` với vai trò chọn sẵn. Backend giả có một bản; backend thật cũng có (phát cookie phiên thật), chỉ bật khi `APP_ENV=dev`.

## Giai đoạn 2: Backend (đang làm)

Làm `api/` (NestJS + Prisma + PostgreSQL) theo đúng hợp đồng trong `shared/src/api-contract/`.
Làm từng nhóm API. Xong nhóm nào thì chuyển nhóm đó sang API thật, các nhóm còn lại vẫn dùng API giả. Giao diện không phải sửa.

| # | Bước | Nhánh | Gồm | |
|---|---|---|---|---|
| 0 | Nền móng | `backend-nen-mong` | PostgreSQL bằng Docker ✓ · dựng NestJS, Prisma · đọc `api/.env` · lọc lỗi trả `ApiErrorBody` · kiểm tra request bằng schema Zod của `shared/` · Swagger · nhóm `health` | ✓ |
| 1 | Chạy giả và thật cùng lúc | `backend-nen-mong` | Vite chuyển `/api` sang backend · chọn nhóm nào dùng API thật · chuyển nhóm `health` sang API thật để thử đường đi | ✓ |
| 2 | Bảng, dữ liệu mẫu | `backend-bang` | `schema.prisma` đủ các bảng · migration đầu tiên · tách dữ liệu mẫu ra chỗ dùng chung để API giả và seed cùng dùng · seed | ✓ |
| 3 | Đăng nhập, quyền | `backend-dang-nhap` | `dev-login` (chỉ bật khi `APP_ENV=dev`) · phiên bằng cookie httpOnly · `/auth/me`, đăng xuất · guard quyền `@RequirePermission` · nhóm `auth` | ✓ |
| 4 | Hồ sơ | `backend-ho-so` | `student-directory` bản giả (đọc dữ liệu mẫu) · nhóm `profile` · CCCD che / đầy đủ | ✓ |
| 5 | Tài khoản | `backend-tai-khoan` | nhóm `accounts`: danh sách phân trang, tạo, sửa, phân vai trò | ✓ |
| 6 | Loại đơn | `backend-loai-don` | nhóm `form-types`: danh sách, phiên bản, nháp / mở / đóng, kiểm tra cấu trúc | ✓ |
| 7 | Tệp | `backend-tep` | lưu tệp ở ổ đĩa máy chủ · nhóm `files`: xem / tải về, kiểm tra quyền xem tệp (tải lên đi cùng nộp, sửa đơn ở bước 9) | ✓ |
| 8 | Danh sách đơn, thống kê | `backend-danh-sach-don` | nhóm `forms`: đơn của tôi, đơn tôi xử lí, Quản lí đơn, thống kê, CCCD theo trang | ✓ |
| 9 | Nộp, sửa đơn | `backend-nop-don` | nhóm `form`: chi tiết, nộp, sửa · sinh mã đơn trong transaction · lưu bản chụp cấu trúc loại đơn | ✓ |
| 10 | Xử lí đơn | `backend-xu-li-don` | `workflow.service.ts`: tiếp nhận, yêu cầu bổ sung, duyệt, từ chối, chuyển giao | ✓ |
| 11 | Xuất Word | `backend-xuat-file` | nhóm `exports`: mẫu Word theo loại đơn, kiểm tra mã `{...}`, docxtemplater | ✓ |
| 12 | Thư điện tử | `backend-email` | nhóm `email`: lưu cấu hình, gửi thư thử · thư tự động khi nộp đơn, ra quyết định | ✓ |
| 13 | Đăng nhập Google | `backend-google-oauth` | `/auth/google` → Google → `/auth/google/callback`: authorization code + PKCE, kiểm tra state, ID token, email trường · tự tạo tài khoản Người nộp đơn lần đầu · trang Đăng nhập báo lỗi theo `loginError` | ✓ |

Chưa làm, chờ thông tin từ bên ngoài:
- OAuth client thật cho máy chủ: tạo ở Google Cloud Console bằng tài khoản của trường, khai báo tên miền thật (cách tạo: README.md).
- `student-directory` bản thật: cần cách kết nối database sinh viên của trường.
- Triển khai lên máy chủ (bỏ quyền `CREATEDB` của user dự án, dùng `prisma migrate deploy`; nhập cấu hình gửi thư của hộp thư chính thức nếu không dùng Gmail đang thử).

### Làm một nhóm API

1. Đọc hợp đồng của nhóm trong `shared/src/api-contract/<nhóm>.ts` và API giả trong `web/src/mocks/handlers/<nhóm>.ts`. API giả cho biết hành vi cần có: luật, mã lỗi, câu thông báo. Đối chiếu thêm `docs/business-rules.md`.
2. Thêm bảng, cột cần thiết vào `schema.prisma`, tạo migration, cập nhật seed.
3. Viết module NestJS: controller mỏng, service gọi Prisma. Luật nghiệp vụ gọi hàm trong `shared/`, không viết lại.
4. Viết test (Vitest + Supertest): response khớp schema Zod của `shared/`, kiểm tra quyền, các mã lỗi.
5. Chuyển nhóm đó sang API thật, mở giao diện bấm thử như người dùng.
6. Tạo Pull Request vào `main`.

### Chạy giả và thật cùng lúc

- `REAL_BACKEND_GROUPS` trong `web/src/mocks/realBackendGroups.ts` là danh sách các nhóm tới backend thật khi đang bật backend giả, vd `['health', 'auth', 'profile']`. MSW bỏ qua các nhóm này, Vite chuyển request sang backend.
- Backend seed từ cùng dữ liệu mẫu với API giả (cùng id người dùng, cùng mã đơn), nên nhóm giả và nhóm thật nói về cùng một người, cùng một lá đơn.
- Khi nhóm `auth` đã thật: API giả lấy người đang đăng nhập từ API thật, không tự giữ phiên riêng.
- Lỗi ngẫu nhiên (`VITE_MOCK_BACKEND_FAILURE_RATE`) chỉ áp dụng cho các nhóm còn giả.
- Bảng danh sách: làm trước bằng hàm `applyListQuery` của `shared/` (đọc rồi lọc trong bộ nhớ), giống API giả. Khi dữ liệu nhiều, đo thấy chậm thì chuyển sang câu truy vấn SQL.
