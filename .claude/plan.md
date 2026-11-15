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
- Bật / tắt bằng `VITE_USE_MOCK_BACKEND` trong `.env.dev`. Biến này chỉ chọn backend giả hay thật; chức năng thử nghiệm do `VITE_APP_ENV` / `APP_ENV` quản (README, mục Biến môi trường).
- API giả làm đúng luật nghiệp vụ (chuyển trạng thái, kiểm tra quyền, sinh mã đơn) và trả lỗi như thật (401, 403, 404, 409, 422).
- Dữ liệu giả nằm trong `web/src/mocks/db.ts`, giữ trong bộ nhớ. Tải lại trang là về ban đầu.
- Nút Đăng nhập gọi `POST /api/auth/login`; backend quyết định: `ENABLE_DEMO_APIS=true` (và `ALWAYS_REAL_APIS` không có `dev-login`) thì đăng nhập thử theo vai trò gửi kèm (phát cookie phiên thật), còn lại trả đường dẫn sang Google. Backend giả luôn đăng nhập thử. Ô đổi vai trò trong menu cũng gọi `POST /api/auth/login` kèm vai trò. Frontend không biết tên `dev-login`, tên này chỉ có ở backend.

## Giai đoạn 2: Backend (đang làm)

Làm `api/` (NestJS + Prisma + PostgreSQL) theo đúng hợp đồng trong `shared/src/api-contract/`.
Làm từng nhóm API. Xong nhóm nào thì chuyển nhóm đó sang API thật, các nhóm còn lại vẫn dùng API giả. Giao diện không phải sửa.

| # | Bước | Nhánh | Gồm | |
|---|---|---|---|---|
| 0 | Nền móng | `backend-nen-mong` | PostgreSQL bằng Docker ✓ · dựng NestJS, Prisma · đọc `api/.env` · lọc lỗi trả `ApiErrorBody` · kiểm tra request bằng schema Zod của `shared/` · Swagger · nhóm `health` | ✓ |
| 1 | Chạy giả và thật cùng lúc | `backend-nen-mong` | Vite chuyển `/api` sang backend · chọn nhóm nào dùng API thật · chuyển nhóm `health` sang API thật để thử đường đi | ✓ |
| 2 | Bảng, dữ liệu mẫu | `backend-bang` | `schema.prisma` đủ các bảng · migration đầu tiên · tách dữ liệu mẫu ra chỗ dùng chung để API giả và seed cùng dùng · seed | ✓ |
| 3 | Đăng nhập, quyền | `backend-dang-nhap` | đăng nhập thử theo vai trò (bản giả `dev-login` của `POST /auth/login`) · phiên bằng cookie httpOnly · `/auth/me`, đăng xuất · guard quyền `@RequirePermission` · nhóm `auth` | ✓ |
| 4 | Hồ sơ | `backend-ho-so` | `student-directory` bản giả (đọc dữ liệu mẫu) · nhóm `profile` · CCCD che / đầy đủ | ✓ |
| 5 | Tài khoản | `backend-tai-khoan` | nhóm `accounts`: danh sách phân trang, tạo, sửa, phân vai trò | ✓ |
| 6 | Loại đơn | `backend-loai-don` | nhóm `form-types`: danh sách, phiên bản, nháp / mở / đóng, kiểm tra cấu trúc | ✓ |
| 7 | Tệp | `backend-tep` | lưu tệp ở ổ đĩa máy chủ · nhóm `files`: xem / tải về, kiểm tra quyền xem tệp (tải lên đi cùng nộp, sửa đơn ở bước 9) | ✓ |
| 8 | Danh sách đơn, thống kê | `backend-danh-sach-don` | nhóm `forms`: đơn của tôi, đơn tôi xử lí, Quản lí đơn, thống kê, CCCD theo trang | ✓ |
| 9 | Nộp, sửa đơn | `backend-nop-don` | nhóm `form`: chi tiết, nộp, sửa · sinh mã đơn trong transaction · lưu bản chụp cấu trúc loại đơn | ✓ |
| 10 | Xử lí đơn | `backend-xu-li-don` | `workflow.service.ts`: tiếp nhận, yêu cầu bổ sung, duyệt, từ chối, chuyển giao | ✓ |
| 11 | Xuất Word | `backend-xuat-file` | nhóm `exports`: mẫu Word theo loại đơn, kiểm tra mã `{...}`, docxtemplater | ✓ |
| 12 | Thư điện tử | `backend-email` | nhóm `email`: lưu cấu hình, gửi thư thử · thư tự động khi nộp đơn, ra quyết định | ✓ |
| 13 | Đăng nhập Google | `backend-google-oauth` | `POST /auth/login` (bản thật trả đường dẫn sang Google; `ENABLE_DEMO_APIS=true` thì đăng nhập thử) → Google → `/auth/google/callback`: authorization code + PKCE, kiểm tra state, ID token, email trường · tự tạo tài khoản Người nộp đơn lần đầu · trang Đăng nhập báo lỗi theo `loginError` | ✓ |

Chưa làm, chờ thông tin từ bên ngoài:
- OAuth client thật cho máy chủ: tạo ở Google Cloud Console bằng tài khoản của trường, khai báo tên miền thật (cách tạo: README.md).
- `student-directory` bản thật: cần cách kết nối database sinh viên của trường. Đã có trong `DEMO_APIS`: bản giả `dev-student-directory` đọc bảng mẫu, bản thật hiện `throw realApiNotBuilt(...)` (501); làm xong thì thay dòng đó bằng kết nối database trường.
- Triển khai lên máy chủ: xem Giai đoạn 3.

## Giai đoạn 3: Container hóa, triển khai (đang làm)

Ứng dụng đã đủ chức năng, chỉ còn `student-directory` bản thật (bước 8). Không có nó, ứng dụng vẫn chạy, chỉ thiếu thông tin sinh viên (MSSV, lớp, ngành…).

Cả dev lẫn bản thật đều chạy bằng container. Mỗi môi trường một tệp compose, một tệp biến môi trường, `up` là chạy, không sửa tay giá trị.

| | Dev | Bản thật |
|---|---|---|
| Compose | `docker-compose.dev.yml`: postgres + api (`pnpm dev`) + web (Vite) | `docker-compose.prod.yml`: postgres + api (bản build) + nginx (web đã build) |
| Biến môi trường | `.env.dev` (chép từ `.env.dev.example`) | `.env.prod` (chép từ `.env.prod.example`) |
| Lên git | chỉ `.env.dev.example`; `.env.dev` mỗi máy tự tạo | chỉ `.env.prod.example`; `.env.prod` tạo tay trên máy chủ |
| Bật / restart container | `migrate deploy` → seed dữ liệu mẫu (**xóa sạch**, về trạng thái gốc) → `pnpm dev` | `migrate deploy` → `seed:production` (Admin đầu tiên + cấu hình email, **chỉ thêm khi chưa có**, không xóa gì) → chạy backend |
| Sửa code | backend, web tự chạy lại bên trong container, không seed lại | build lại image rồi `up -d` |

Mô hình chạy trên máy chủ: chỉ `nginx` mở cổng ra ngoài.

```
Trình duyệt ──HTTPS──▶ nginx (80/443) ──/api──▶ api (NestJS, 3000) ──▶ postgres (5432)
                         └─ / : file web đã build (dist/)               └─ volume giữ dữ liệu
```

Bước 0 đến 6 tự làm được ngay, thử trên máy mình, không cần chờ ai. Bước 7 và 8 chờ thông tin từ bên ngoài, đến lúc có thì chỉ việc đưa lên.
Bước 6 (CI/CD) thử trọn vẹn trên máy cá nhân trước. Khi lên máy chủ trường chỉ đổi nơi chạy runner và `.env.prod`, quy trình giữ nguyên.

| # | Bước | Nhánh | Gồm | |
|---|---|---|---|---|
| 0 | Đóng gói | `trien-khai-dong-goi` | `api/Dockerfile` · build web thành `dist/` (đặt `VITE_USE_MOCK_BACKEND=false`, bỏ trống `VITE_APP_ENV` rồi mới build) · `nginx.conf` (`/api/` → `proxy_pass http://api:3000`, `/` → `dist/` với `try_files ... /index.html`, header `X-Forwarded-Proto`) · `docker-compose.prod.yml` (3 service, `restart: unless-stopped`, volume cho Postgres và `UPLOAD_DIR`, mount chứng chỉ) | ✓ |
| 1 | Tách biến môi trường dev / bản thật | `trien-khai-container` | `.env.dev.example`, `.env.prod.example` thay cho ba tệp mẫu hiện có (`.env.example` gốc, `api/.env.example`, `web/.env.example`): mỗi môi trường **một tệp** gồm biến Postgres, backend, giao diện; compose chia biến cho từng container · `.gitignore` bỏ qua `.env.dev`, `.env.prod`, giữ hai tệp mẫu · `.env.prod.example` ghi sẵn giá trị bản thật: `APP_ENV=` trống, `ENABLE_DEMO_APIS=false`, `WEB_BASE_URL_PRODUCTION`, `SMTP_*`, `GOOGLE_*`, email Admin đầu tiên, mật khẩu Postgres đặt mới · `VITE_*` của bản thật vẫn cố định trong `web/Dockerfile` (không bao giờ bật MSW ở bản thật) · app vẫn chỉ cấu hình bằng biến môi trường, container chỉ ghi sẵn giá trị: không có container vẫn chạy được (`loadApiEnvFile` đọc `.env.dev` ở thư mục gốc thay cho `api/.env`; biến compose truyền vào thì ưu tiên hơn, kiểm lại cách `process.loadEnvFile` xử lí biến đã có) · muốn thử API thật khi dev (vd đăng nhập Google) thì sửa `.env.dev` rồi `up -d api`, không cần bản prod · sửa README, `.claude/CLAUDE.md` (mục Hạ tầng) theo cách mới | ✓ |
| 2 | Container hóa dev | `trien-khai-container` | `docker-compose.dev.yml` (đã đổi tên từ `docker-compose.yml`): postgres (mở cổng 5432 để xem bằng công cụ DB) · api: target `dev` của `api/Dockerfile`, gắn mã nguồn vào container, lệnh khởi động `migrate deploy` → `prisma db seed` → `pnpm dev` (seed chỉ chạy lúc bật / restart container, sửa code thì `pnpm dev` tự chạy lại, không seed) · web: target `dev` của `web/Dockerfile`, Vite `https://localhost:5173`, `API_PROXY_TARGET=http://api:3000` · `node_modules` của container để trong volume riêng, không lẫn với máy · test chạy trong container (`docker compose -f docker-compose.dev.yml exec api pnpm test`) hoặc trên máy như cũ · trên máy vẫn `pnpm install` để VS Code gợi ý code, báo lỗi kiểu · chạy web một mình với API giả (MSW) vẫn làm được (`VITE_USE_MOCK_BACKEND=true` trong `.env.dev`) | ✓ |
| 3 | Cấu hình bản thật | `trien-khai-container` | `docker-compose.prod.yml` đọc `.env.prod` · lệnh khởi động api: `migrate deploy` → `seed:production` → `node dist/main.mjs`, mỗi lần bật / restart (đã có: `api/prisma/seed-production.ts` tạo Admin + cấu hình email, không xóa gì, chạy lại an toàn) · user dự án không có quyền `CREATEDB` ở bản thật (đã có: `APP_DB_CREATEDB: 'false'`; dev vẫn có vì `prisma migrate dev` cần tạo shadow database) · mật khẩu Postgres, SMTP, Google đặt mới, không dùng lại mật khẩu dev | |
| 4 | Chạy thử bản thật trên máy mình | `trien-khai-container` | `docker compose -f docker-compose.prod.yml up -d` với `localhost` và chứng chỉ tự kí · đăng nhập Google bằng Admin đầu tiên · nộp đơn, tải tệp, xử lí đơn, xuất Word, gửi thư · F5 ở trang con (vd `/forms/123`) không bị 404 · restart container: dữ liệu và tệp tải lên vẫn còn | |
| 5 | Vận hành | `trien-khai-van-hanh` | viết sẵn script sao lưu Postgres và thư mục tệp tải lên · cách xem log · cách cập nhật bản mới (build lại rồi `up -d`; `migrate deploy` tự chạy lúc bật container) · cách khôi phục từ bản sao lưu · thử hết trên máy mình | |
| 6 | CI/CD | `trien-khai-ci-cd` | GitHub Actions, chạy khi merge vào `main`: ① **CI**: chạy `pnpm --filter shared test`, `api test`, `web test` trên máy sạch (api cần Postgres tạm làm service container, chạy luôn migration); bỏ E2E Playwright cho nhẹ · đỏ thì dừng, không deploy ② **Build**: dựng image `api` và `nginx + web` rồi đẩy lên registry (GHCR); `VITE_USE_MOCK_BACKEND=false` và `VITE_APP_ENV=` đã đặt sẵn trong `web/Dockerfile`, CI không cần `.env.dev` ③ **Deploy**: máy đích kéo image mới → sao lưu Postgres → `migrate deploy` → `up -d` · thử deploy lên **máy cá nhân** bằng **self-hosted runner** (GitHub không tự với tới máy nằm sau mạng nhà / LAN) · secret để trong GitHub Secrets hoặc `.env` trên máy đích · tuỳ chọn: bấm Approve tay (GitHub Environments) trước khi deploy | |
| 7 | Lên máy chủ thật | (không có nhánh) | **chờ bên ngoài**: máy chủ Linux có Docker · domain / subdomain (vd `donthi.hcmulaw.edu.vn`) · chứng chỉ HTTPS thật · mở cổng 80/443 · OAuth client Google tạo bằng tài khoản trường (redirect `https://<domain>/api/auth/google/callback`) · xác nhận tên miền email thật để điền `SCHOOL_EMAIL_DOMAINS` · khi đủ thì: tạo `.env.prod` thật, mount chứng chỉ, `up -d`, đăng nhập Google bằng email trường, chạy lại các luồng chính | |
| 8 | Kết nối database trường | `backend-student-directory` | **chờ bên ngoài**: loại database, địa chỉ, cổng, tài khoản chỉ đọc · mở tường lửa phía trường cho IP máy chủ · thêm driver nếu không phải PostgreSQL · thay `throw realApiNotBuilt('dev-student-directory')` bằng kết nối thật · thử bằng `nc -zv` từ máy chủ và từ trong container | |

### Lưu ý khi triển khai

- `VITE_*` được nhúng vào `dist/` lúc build. Bản thật đặt cố định trong `web/Dockerfile`; dev lấy từ `.env.dev`.
- `API_PROXY_TARGET` chỉ dùng ở dev (Vite làm proxy). Bản thật thì nginx làm việc này.
- Khi `ENABLE_DEMO_APIS=false`, chỉ còn đăng nhập Google: phải có OAuth client và tên miền email đúng trước khi mở cho người dùng.
- Backend không cần `trust proxy`: cookie `secure` theo `APP_ENV`, không đọc `req.protocol` / `req.ip` (đã kiểm ở bước 0).
- Compose tự dựng `DATABASE_URL` từ biến Postgres trong tệp env (host `postgres`), không ghi chuỗi kết nối hai lần.
- `api` và `postgres` bản thật không mở cổng ra ngoài, nginx gọi backend bằng tên service (`http://api:3000`), không dùng `127.0.0.1`.
- Mật khẩu SMTP, `GOOGLE_CLIENT_SECRET`, mật khẩu Postgres bản thật chỉ nằm trong `.env.prod` trên máy chủ, không commit, không đóng gói vào image.
- Không dùng `down -v`: xóa luôn volume, mất dữ liệu và tệp tải lên (dev thì không sao, bật lại là seed lại).

### Làm một nhóm API

1. Đọc hợp đồng của nhóm trong `shared/src/api-contract/<nhóm>.ts` và API giả trong `web/src/mocks/handlers/<nhóm>.ts`. API giả cho biết hành vi cần có: luật, mã lỗi, câu thông báo. Đối chiếu thêm `docs/business-rules.md`.
2. Thêm bảng, cột cần thiết vào `schema.prisma`, tạo migration, cập nhật seed.
3. Viết module NestJS: controller mỏng, service gọi Prisma. Luật nghiệp vụ gọi hàm trong `shared/`, không viết lại.
4. Viết test (Vitest + Supertest): response khớp schema Zod của `shared/`, kiểm tra quyền, các mã lỗi.
5. Chuyển nhóm đó sang API thật, mở giao diện bấm thử như người dùng.
6. Tạo Pull Request vào `main`.

### Chạy giả và thật cùng lúc

- `VITE_REAL_BACKEND_GROUPS` trong `.env.dev` là danh sách các nhóm tới backend thật khi đang bật backend giả, vd `health,auth,profile`. MSW bỏ qua các nhóm này, Vite chuyển request sang backend.
- Backend seed từ cùng dữ liệu mẫu với API giả (cùng id người dùng, cùng mã đơn), nên nhóm giả và nhóm thật nói về cùng một người, cùng một lá đơn.
- Khi nhóm `auth` đã thật: API giả lấy người đang đăng nhập từ API thật, không tự giữ phiên riêng.
- Lỗi ngẫu nhiên (`VITE_MOCK_BACKEND_FAILURE_RATE`) chỉ áp dụng cho các nhóm còn giả.
- Bảng danh sách: làm trước bằng hàm `applyListQuery` của `shared/` (đọc rồi lọc trong bộ nhớ), giống API giả. Khi dữ liệu nhiều, đo thấy chậm thì chuyển sang câu truy vấn SQL.
