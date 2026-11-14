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
```

## Run dev

```bash
docker compose up -d            # bật PostgreSQL (chạy ngầm, bật một lần)
pnpm --filter api exec prisma migrate dev   # tạo bảng (lần đầu, và mỗi khi có migration mới)
pnpm --filter api exec prisma db seed       # nạp dữ liệu mẫu (xóa sạch dữ liệu cũ)
pnpm --filter api dev           # backend, cổng 3000 · tài liệu API: http://localhost:3000/api/docs
pnpm --filter web dev           # frontend, cổng 5173 · http://localhost:5173
```

Backend và frontend mỗi cái chạy ở một terminal riêng.

Tắt PostgreSQL:

```bash
docker compose down
```

## Biến môi trường: hai việc, không lẫn nhau

| Việc | Biến | Giá trị |
|---|---|---|
| Request `/api` đi tới **backend nào** | `VITE_USE_MOCK_BACKEND` (`web/.env.development`) | `false`: backend thật (`api/`) · `true`: backend giả (MSW, chạy trong trình duyệt) |
| | `REAL_BACKEND_GROUPS` (`web/src/mocks/realBackendGroups.ts`) | Khi bật backend giả: các nhóm vẫn tới backend thật |
| Có **chức năng thử nghiệm** hay không | `VITE_APP_ENV` (`web/.env.development`) | `dev`: hiện phần `JUST FOR DEMO` (khung đăng nhập thử, đổi vai trò trong menu) · trống: ẩn |
| | `APP_ENV` (`api/.env`) | `dev`: bật `dev-login`, Swagger, thư in ra console · trống: bản thật |

- Đăng nhập thử (`dev-login`) là chức năng thử nghiệm **của backend thật**: bỏ qua Google nhưng vẫn phát cookie phiên thật. `APP_ENV` quản, không phải `VITE_USE_MOCK_BACKEND`.
- Backend giả không phát được cookie cho backend thật: nhóm `auth` do backend giả trả lời thì mọi nhóm cần đăng nhập cũng phải giả, không thì bị 401.
- Chỉ chạy frontend, không bật backend: đặt `VITE_USE_MOCK_BACKEND=true` và để `REAL_BACKEND_GROUPS` rỗng.
- Lên máy chủ thật: `APP_ENV`, `VITE_APP_ENV` để trống; `VITE_USE_MOCK_BACKEND=false`.