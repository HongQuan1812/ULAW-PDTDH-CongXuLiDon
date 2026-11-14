# Cổng xử lí đơn

## Cài đặt

Cần có Node.js và Docker. Cài pnpm rồi cài thư viện:

```bash
npm install -g pnpm
pnpm install
```

Tạo tệp biến môi trường từ tệp mẫu (sửa mật khẩu nếu muốn, nhớ giữ `DATABASE_URL` trong `api/.env` khớp với `.env` ở thư mục gốc):

```bash
cp .env.example .env            # cho Docker (PostgreSQL)
cp api/.env.example api/.env    # cho backend
cp web/.env.example web/.env    # cho giao diện
```

Các tệp `.env` là cài đặt riêng của từng máy, không đưa lên git. Thêm biến mới thì thêm vào cả `.env.example`.

## Run dev

```bash
docker compose up -d            # bật PostgreSQL (chạy ngầm, bật một lần)
pnpm --filter api exec prisma migrate dev   # tạo bảng (lần đầu, và mỗi khi có migration mới)
pnpm --filter api exec prisma db seed       # APP_ENV=dev: xóa sạch rồi nạp dữ liệu mẫu · bản thật: chỉ thêm Admin ban đầu, không xóa gì
pnpm --filter api dev           # backend, cổng 3000 · tài liệu API: http://localhost:3000/api/docs
pnpm --filter web dev           # frontend, cổng 5173 · http://localhost:5173
```

Backend và frontend mỗi cái chạy ở một terminal riêng.

Tắt PostgreSQL:

```bash
docker compose down
```

## Biến môi trường: mỗi biến một việc

| Việc | Biến | Giá trị |
|---|---|---|
| Request `/api` đi tới **backend nào** | `VITE_USE_MOCK_BACKEND` (`web/.env`) | `false`: backend thật (`api/`) · `true`: backend giả (MSW, chạy trong trình duyệt) |
| | `VITE_REAL_BACKEND_GROUPS` (`web/.env`) | Khi bật backend giả: các nhóm vẫn tới backend thật, cách nhau bằng dấu phẩy, vd `health,auth` |
| Có **chức năng thử nghiệm** hay không | `VITE_APP_ENV` (`web/.env`) | `dev`: hiện phần `JUST FOR DEMO` (khung chọn vai trò ở trang Đăng nhập, đổi vai trò trong menu) · trống: ẩn |
| Backend chạy **môi trường nào** | `APP_ENV` (`api/.env`) | `dev`: Swagger, thư in ra console, địa chỉ `WEB_BASE_URL_DEV`, cookie không `secure` · trống: bản thật |
| Backend dùng **bản giả của API** không | `ENABLE_DEMO_APIS` (`api/.env`) | `true`: API nào có bản giả thì dùng bản giả (vd đăng nhập thử theo vai trò, `dev-login`), trừ API trong `ALWAYS_REAL_APIS` · `false` / trống: dùng bản thật (vd đăng nhập Google) |
| | `ALWAYS_REAL_APIS` (`api/.env`) | Khi bật bản giả: các API vẫn dùng bản thật, cách nhau bằng dấu phẩy, vd `dev-login` |

Mọi API có bản giả đều theo một cách: bản giả `dev-<tên>` (vd `dev-login`, `dev-student-directory`), danh sách trong `DEMO_APIS` (`api/src/config/demo-apis.ts`), `ENABLE_DEMO_APIS` chọn bản. Bản thật chưa phát triển (vd đọc database trường) thì request gọi tới báo lỗi 501 "API thật … chưa được phát triển", backend vẫn chạy. Biến này không phụ thuộc `APP_ENV`. Tên `dev-<tên>` chỉ có ở backend: frontend chỉ gọi endpoint bình thường (vd `POST /auth/login`), không biết bản nào đang chạy.
Ví dụ đăng nhập: frontend chỉ gọi `POST /auth/login` (nút Đăng nhập, ô đổi vai trò); `VITE_APP_ENV` chỉ hiện khung chọn vai trò. Backend giả (MSW) luôn đăng nhập thử; backend thật chọn đăng nhập thử (`dev-login`) hay sang Google. Muốn thử Google thật mà các API khác vẫn giả: đặt `ALWAYS_REAL_APIS=dev-login`.