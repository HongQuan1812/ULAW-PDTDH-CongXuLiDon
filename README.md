# Cổng xử lí đơn

## Cài đặt

Cần Node.js, pnpm, Docker.

```bash
pnpm install
cp .env.dev.example .env.dev
```

| Môi trường | Compose | Biến môi trường |
|---|---|---|
| Dev | `docker-compose.dev.yml` | `.env.dev` |
| Bản thật | `docker-compose.prod.yml` | `.env.prod` |

Tệp `.env.dev`, `.env.prod` mỗi máy tự tạo từ tệp `.example`, không lên git.

## Chạy dev

Cách 1, tất cả trong container:

```bash
pnpm dev:up
```

- Backend: http://localhost:3000/api/docs · giao diện: https://localhost:5173
- Mỗi lần bật / restart `api`: tạo bảng, nạp dữ liệu mẫu (xóa dữ liệu cũ). Sửa code thì tự chạy lại, không seed lại.

| Việc | Lệnh |
|---|---|
| Bật / bật lại, đổi `.env.dev` (vd thử đăng nhập Google) | `pnpm dev:up` |
| Về dữ liệu mẫu, khởi động lại `api` và `web` (vd đổi thư viện trong `package.json`, Vite giữ bản cũ) | `pnpm dev:reset` |
| Chạy test | `pnpm dev:test` |
| Xem log (mọi container; chỉ một cái thì thêm tên, vd `pnpm dev:logs api`) | `pnpm dev:logs` |
| Tắt | `pnpm dev:down` |

Các lệnh `pnpm dev:*`, `pnpm prod:*` ghi trong `package.json` ở thư mục gốc, là lệnh `docker compose` viết gọn. Thêm chữ phía sau thì nối vào cuối lệnh, vd `pnpm dev:up postgres` chỉ bật postgres.

Cách 2, chạy thẳng trên máy (chỉ postgres trong container), backend và giao diện mỗi cái một terminal:

```bash
pnpm dev:up postgres
pnpm --filter api exec prisma migrate dev                            # tạo bảng
pnpm --filter api exec prisma db seed                                # dữ liệu mẫu (xóa dữ liệu cũ)
pnpm --filter api dev                                                # backend
pnpm --filter web dev                                                # giao diện
```

Hai cách dùng chung cổng 3000, 5173: chạy cách này thì tắt cách kia. Trên máy vẫn `pnpm install` để VS Code gợi ý code.

## Chạy bản thật

```
Trình duyệt ──HTTPS──▶ nginx (80/443) ──/api──▶ api (3000) ──▶ postgres
```

Lần đầu:

```bash
cp .env.prod.example .env.prod          # điền giá trị thật, mật khẩu đặt mới (không dùng lại của dev), có FIRST_ADMIN_EMAIL
sh docker/nginx/make-dev-cert.sh        # chỉ khi thử trên máy mình; máy chủ thật thì chép chứng chỉ của trường vào docker/nginx/certs/

pnpm prod:up
```

Mở `https://localhost` (chứng chỉ tự kí: bấm Nâng cao → Tiếp tục, dùng Chrome / Edge).

Mỗi lần bật / restart, container `api` tự chạy `prisma migrate deploy` (tạo / cập nhật bảng) → `seed:production` (Admin đầu tiên theo `FIRST_ADMIN_EMAIL` và cấu hình email mặc định, chỉ thêm khi chưa có, không xóa gì) → backend. Thiếu `FIRST_ADMIN_EMAIL` thì `api` không chạy, xem `pnpm prod:logs`.

Các lần sau:

| Việc | Lệnh |
|---|---|
| Bật lại, đổi `.env.prod` | `pnpm prod:up` |
| Có mã mới | `pnpm prod:up` (build lại, migration tự chạy) |
| Đổi chứng chỉ | `docker compose -f docker-compose.prod.yml --env-file .env.prod restart nginx` |
| Xem log (mọi container; chỉ một cái thì thêm tên, vd `pnpm prod:logs api`) | `pnpm prod:logs` |
| Tắt | `pnpm prod:down` |

Không dùng `down -v`: xóa luôn dữ liệu và tệp tải lên.

## Đăng nhập Google

1. Google Cloud Console → Credentials → OAuth client ID, loại **Web application**.
2. Redirect URI: `https://localhost:5173/api/auth/google/callback` (dev) hoặc `https://<tên miền>/api/auth/google/callback` (bản thật).
   Muốn sao lưu vào Google Drive (trang Sao lưu) thì thêm `…/api/backups/google-drive/callback` (cùng địa chỉ gốc), và bật **Google Drive API** trong cùng project.
   Dev muốn thử kết nối Drive thật thì thêm `dev-google-drive-connect` vào `ALWAYS_REAL_APIS` rồi `up -d api`.
3. Điền `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` vào `.env.dev` / `.env.prod`.

Chỉ email trường (`SCHOOL_EMAIL_DOMAINS`, `shared/src/validators/auth.ts`) đăng nhập được.

## Biến môi trường

| Biến | Ý nghĩa |
|---|---|
| `POSTGRES_ADMIN_USER`, `POSTGRES_ADMIN_PASSWORD` | superuser của PostgreSQL, chỉ để quản trị |
| `APP_DB_USER`, `APP_DB_PASSWORD`, `APP_DB_NAME` | user và database của dự án, ứng dụng dùng tài khoản này |
| `POSTGRES_PORT` | cổng PostgreSQL mở ra máy (dev) |
| `DATABASE_URL` | chuỗi kết nối khi chạy trên máy (dev), khớp `APP_DB_*`. Bản thật compose tự dựng |
| `APP_ENV` | `dev`: Swagger, `WEB_BASE_URL_DEV`, cookie không `secure` · trống: bản thật |
| `ENABLE_DEMO_APIS` | `true`: dùng bản giả của API: `dev-login` đăng nhập thử theo vai trò, `dev-student-directory` thông tin sinh viên mẫu, `dev-email` thư tự động không tới người nộp đơn, `dev-google-drive-connect` chỉ giả bước kết nối Google Drive cho nơi lưu sao lưu (không qua Google; sao lưu vào nơi đó vẫn báo lỗi vì không có quyền thật) · `false`: bản thật |
| `ALWAYS_REAL_APIS` | khi bật bản giả, các API vẫn dùng bản thật, vd `dev-login,dev-student-directory` |
| `API_PORT` | cổng backend (dev) |
| `UPLOAD_DIR` | thư mục lưu tệp tải lên (dev) |
| `BACKUP_DIR` | thư mục sao lưu (dev): mỗi nơi lưu kiểu "Thư mục trên máy chủ" là một thư mục con. Bản thật compose đặt `/app/api/backups` (volume `backups`) |
| `WEB_BASE_URL_DEV`, `WEB_BASE_URL_PRODUCTION` | địa chỉ cổng, dùng cho đường dẫn trong thư và redirect URI của Google · trống: `https://localhost:5173`, `https://localhost` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | máy chủ gửi thư · `SMTP_HOST` trống: không gửi |
| `DEV_EMAIL_REDIRECT_TO` | bản giả `dev-email`: thư tự động gửi về địa chỉ này thay cho người nộp đơn · trống: chỉ in ra console |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth client của Google · trống: chưa bật đăng nhập Google |
| `SCHOOL_DB_HOST`, `SCHOOL_DB_PORT`, `SCHOOL_DB_USER`, `SCHOOL_DB_PASSWORD` | database trường (SQL Server, chỉ đọc) cho thông tin sinh viên; tên database, bảng, cột ở `api/src/student-directory/school-database.json` · `SCHOOL_DB_HOST` trống: chưa kết nối, trang hồ sơ báo chưa lấy được thông tin sinh viên. Bản thật dùng tài khoản chỉ có quyền SELECT |
| `FIRST_ADMIN_EMAIL` | email Admin đầu tiên (bản thật, bắt buộc): container `api` tạo khi bật nếu chưa có |
| `FIRST_ADMIN_NAME` | họ tên Admin đầu tiên (bản thật): có thì đăng nhập là vào thẳng · trống: lần đầu tự nhập · chỉ dùng khi tạo mới |
| `HTTP_PORT`, `HTTPS_PORT`, `TLS_CERT_DIR` | cổng và thư mục chứng chỉ của nginx (bản thật) |
| `VITE_USE_MOCK_BACKEND` | `true`: giao diện dùng backend giả (MSW) · `false`: backend thật |
| `VITE_REAL_BACKEND_GROUPS` | khi dùng backend giả, các nhóm vẫn tới backend thật, vd `health,auth` |
| `VITE_APP_ENV` | `dev`: hiện phần thử nghiệm (chọn vai trò khi đăng nhập) · trống: ẩn |
| `VITE_MOCK_BACKEND_FAILURE_RATE` | tỉ lệ backend giả trả lỗi ngẫu nhiên (0 → 1) |
| `WEB_PORT`, `API_PROXY_TARGET` | cổng Vite và địa chỉ backend Vite chuyển `/api` tới (dev) |

Biến `VITE_*` của bản thật đặt cố định trong `web/Dockerfile`, không lấy từ `.env.prod`.
