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
docker compose -f docker-compose.dev.yml --env-file .env.dev up -d --build
```

- Backend: http://localhost:3000/api/docs · giao diện: https://localhost:5173
- Mỗi lần bật / restart `api`: tạo bảng, nạp dữ liệu mẫu (xóa dữ liệu cũ). Sửa code thì tự chạy lại, không seed lại.

Các lần sau (`docker compose -f docker-compose.dev.yml --env-file .env.dev …`):

| Việc | Lệnh |
|---|---|
| Bật lại | `up -d` |
| Về dữ liệu mẫu | `restart api` |
| Đổi `.env.dev` (vd thử đăng nhập Google) | `up -d api web` |
| Đổi thư viện (`package.json`) | `restart api web` |
| Chạy test | `exec api pnpm test` |
| Xem log | `logs -f api` |
| Tắt | `down` |

Cách 2, chạy thẳng trên máy (chỉ postgres trong container), backend và giao diện mỗi cái một terminal:

```bash
docker compose -f docker-compose.dev.yml --env-file .env.dev up -d postgres
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
cp .env.prod.example .env.prod          # điền giá trị thật
sh docker/nginx/make-dev-cert.sh        # chỉ khi thử trên máy mình; máy chủ thật thì chép chứng chỉ của trường vào docker/nginx/certs/

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm api pnpm exec prisma migrate deploy
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm api pnpm seed:production <email trường>
```

Mở `https://localhost` (chứng chỉ tự kí: bấm Nâng cao → Tiếp tục, dùng Chrome / Edge).

`seed:production` tạo Admin đầu tiên và cấu hình email mặc định. Không xóa gì, chạy lại vẫn an toàn.

Các lần sau (`docker compose -f docker-compose.prod.yml --env-file .env.prod …`):

| Việc | Lệnh |
|---|---|
| Bật lại | `up -d` |
| Đổi `.env.prod` | `up -d api` |
| Có mã mới | `up -d --build`, rồi `migrate deploy` như trên |
| Đổi chứng chỉ | `restart nginx` |
| Xem log | `logs -f api` |
| Tắt | `down` |

Không dùng `down -v`: xóa luôn dữ liệu và tệp tải lên.

## Đăng nhập Google

1. Google Cloud Console → Credentials → OAuth client ID, loại **Web application**.
2. Redirect URI: `https://localhost:5173/api/auth/google/callback` (dev) hoặc `https://<tên miền>/api/auth/google/callback` (bản thật).
3. Điền `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` vào `.env.dev` / `.env.prod`.

Chỉ email trường (`SCHOOL_EMAIL_DOMAINS`, `shared/src/validators/auth.ts`) đăng nhập được.

## Biến môi trường

| Biến | Ý nghĩa |
|---|---|
| `POSTGRES_ADMIN_USER`, `POSTGRES_ADMIN_PASSWORD` | superuser của PostgreSQL, chỉ để quản trị |
| `APP_DB_USER`, `APP_DB_PASSWORD`, `APP_DB_NAME` | user và database của dự án, ứng dụng dùng tài khoản này |
| `POSTGRES_PORT` | cổng PostgreSQL mở ra máy (dev) |
| `DATABASE_URL` | chuỗi kết nối khi chạy trên máy (dev), khớp `APP_DB_*`. Bản thật compose tự dựng |
| `APP_ENV` | `dev`: Swagger, thư in ra console, cookie không `secure` · trống: bản thật |
| `ENABLE_DEMO_APIS` | `true`: dùng bản giả của API (vd đăng nhập thử theo vai trò) · `false`: bản thật (đăng nhập Google) |
| `ALWAYS_REAL_APIS` | khi bật bản giả, các API vẫn dùng bản thật, vd `dev-login` |
| `API_PORT` | cổng backend (dev) |
| `UPLOAD_DIR` | thư mục lưu tệp tải lên (dev) |
| `WEB_BASE_URL_DEV`, `WEB_BASE_URL_PRODUCTION` | địa chỉ cổng, dùng cho đường dẫn trong thư và đăng nhập Google |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | máy chủ gửi thư · `SMTP_HOST` trống: không gửi |
| `DEV_EMAIL_REDIRECT_TO` | dev: thư tự động gửi về địa chỉ này thay cho người dùng mẫu · trống: chỉ in ra console |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth client của Google · trống: chưa bật đăng nhập Google |
| `FIRST_ADMIN_EMAIL` | email Admin đầu tiên (bản thật) |
| `HTTP_PORT`, `HTTPS_PORT`, `TLS_CERT_DIR` | cổng và thư mục chứng chỉ của nginx (bản thật) |
| `VITE_USE_MOCK_BACKEND` | `true`: giao diện dùng backend giả (MSW) · `false`: backend thật |
| `VITE_REAL_BACKEND_GROUPS` | khi dùng backend giả, các nhóm vẫn tới backend thật, vd `health,auth` |
| `VITE_APP_ENV` | `dev`: hiện phần thử nghiệm (chọn vai trò khi đăng nhập) · trống: ẩn |
| `VITE_MOCK_BACKEND_FAILURE_RATE` | tỉ lệ backend giả trả lỗi ngẫu nhiên (0 → 1) |
| `WEB_PORT`, `API_PROXY_TARGET` | cổng Vite và địa chỉ backend Vite chuyển `/api` tới (dev) |

Biến `VITE_*` của bản thật đặt cố định trong `web/Dockerfile`, không lấy từ `.env.prod`.
