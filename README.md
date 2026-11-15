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
pnpm --filter api exec prisma db seed       # nạp dữ liệu mẫu (xóa sạch dữ liệu cũ)
pnpm --filter api dev           # backend, cổng 3000 · tài liệu API: http://localhost:3000/api/docs
pnpm --filter web dev           # frontend, cổng 5173 · http://localhost:5173
```

Backend và frontend mỗi cái chạy ở một terminal riêng.

Tắt PostgreSQL:

```bash
docker compose down
```

## Chạy bản thật bằng Docker

Ba container trong `docker-compose.prod.yml`, chỉ nginx mở cổng ra ngoài:

```
Trình duyệt ──HTTPS──▶ nginx (80/443) ──/api──▶ api (3000) ──▶ postgres (5432)
                         └─ / : giao diện đã build
```

Không cần Node.js, pnpm, `pnpm install` hay `web/.env`: image tự cài và tự build.
Bản này dùng container và database riêng (tên project `cong-xu-li-don-prod`), không đụng PostgreSQL của `docker compose up` ở mục trên.

### Chuẩn bị (một lần mỗi máy)

1. **Tệp biến môi trường**:

   ```bash
   cp .env.example .env            # tài khoản PostgreSQL; HTTP_PORT, HTTPS_PORT, TLS_CERT_DIR (bỏ trống: 80, 443, ./docker/nginx/certs)
   cp api/.env.example api/.env    # biến của backend
   ```

   Trong `api/.env`, compose tự đặt `DATABASE_URL`, `UPLOAD_DIR`, `API_PORT` cho khớp với các container (lấy tài khoản từ `APP_DB_*` của `.env` gốc), nên ba biến này để nguyên cũng được.
   Thử trên máy mình thì giữ `APP_ENV=dev`, `ENABLE_DEMO_APIS=true` để đăng nhập thử theo vai trò. Máy chủ thật: `APP_ENV=` (trống), `ENABLE_DEMO_APIS=false`, điền `WEB_BASE_URL_PRODUCTION`, `SMTP_*`, `GOOGLE_*`, và mật khẩu mới trong `.env` gốc.

2. **Chứng chỉ HTTPS**: nginx đọc `fullchain.pem` + `privkey.pem` trong `TLS_CERT_DIR` (gắn vào container, không nằm trong image).

   ```bash
   sh docker/nginx/make-dev-cert.sh    # thử trên máy mình: chứng chỉ tự kí cho localhost
   ```

   Máy chủ thật: không chạy lệnh trên, chép chứng chỉ do trường cấp vào thư mục đó với đúng hai tên tệp (hoặc trỏ `TLS_CERT_DIR` tới chỗ để chứng chỉ).

### Chạy lần đầu

```bash
docker compose -f docker-compose.prod.yml up -d --build                                   # build image và bật 3 container
docker compose -f docker-compose.prod.yml run --rm api pnpm exec prisma migrate deploy    # tạo bảng
docker compose -f docker-compose.prod.yml run --rm api pnpm exec prisma db seed           # dữ liệu mẫu, CHỈ khi thử trên máy mình (xóa sạch dữ liệu cũ)
```

Mở `https://localhost` (cổng 443 mặc định của https). Chứng chỉ tự kí nên trình duyệt cảnh báo: bấm Nâng cao → Tiếp tục.
Simple Browser của VS Code không cho bỏ qua cảnh báo này, mở bằng Chrome / Edge.

### Các lần sau

| Việc | Lệnh (`docker compose -f docker-compose.prod.yml …`) |
|---|---|
| Bật lại (dữ liệu vẫn còn trong volume) | `up -d` |
| Đổi `api/.env` | `up -d api` (không dùng `restart`: `restart` giữ biến cũ) |
| Có mã mới | `up -d --build`, rồi `run --rm api pnpm exec prisma migrate deploy` nếu có migration mới |
| Đổi chứng chỉ | chép tệp mới vào `TLS_CERT_DIR`, rồi `restart nginx` |
| Xem log | `logs -f api` · `logs -f nginx` |
| Xem trạng thái | `ps` |
| Tắt (dữ liệu vẫn còn) | `down` |

Lưu ý:
- **Không dùng `down -v`**: xóa luôn volume `postgres-data` và `uploads`, mất hết dữ liệu và tệp tải lên.
- Biến `VITE_*` của giao diện nhúng vào image lúc build, đặt sẵn trong `web/Dockerfile` (backend thật, tắt phần thử nghiệm); `web/.env` không dùng ở đây.
- Tài khoản PostgreSQL chỉ được tạo ở lần chạy đầu (volume trống). Đổi `APP_DB_*` trong `.env` sau đó không đổi mật khẩu trong database.

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