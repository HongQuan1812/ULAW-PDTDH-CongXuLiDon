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

## Giai đoạn 2: Backend ✓

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

### Việc chờ bên ngoài (đã xong)

- OAuth client Google tạo bằng tài khoản của trường ✓ (cách tạo: README.md). Lên máy chủ thật thì thêm redirect của tên miền thật (Giai đoạn 3, bước 7).
- `student-directory` bản thật ✓ (mục **`student-directory` bản thật** bên dưới). Bản giả `dev-student-directory` đọc bảng mẫu.
- Triển khai lên máy chủ: xem Giai đoạn 3.

### `student-directory` bản thật

Nhánh `backend-student-directory` ✓. Kết nối bằng tài khoản `lhquan` (không có quyền sửa), không làm tài khoản chỉ đọc riêng.

Thông tin sinh viên đọc từ SQL Server `CoreUis`. Cấu trúc ở `api/src/student-directory/school-database.json`, mục `THONG_TIN_SINH_VIEN`. Tệp này vừa là tài liệu, vừa là nơi code lấy tên database, tên bảng, tên cột (import thẳng, không chép lại ra hằng số riêng), nên đổi cấu trúc chỉ sửa một chỗ. Biến môi trường chỉ chứa thứ khác nhau theo máy hoặc bí mật: `SCHOOL_DB_HOST`, `SCHOOL_DB_PORT`, `SCHOOL_DB_USER`, `SCHOOL_DB_PASSWORD`. Không ghi gì vào database trường.

Lấy thông tin theo email, mỗi mục của `StudentInfo` lấy từ:

| Mục | Lấy từ |
|---|---|
| tìm MSSV theo email | `psc_StudentInfo.Email` = email đăng nhập; một email có thể có 2 MSSV, phải tra bảng, không cắt chuỗi email |
| `studentId` | `psc_StudentInfo.StudentID`; MSSV trùng phần trước @ đứng đầu |
| `className` | `psc_StudentClassStudent` → `psc_ClassStudents.ClassStudentName` (không có lớp: null) |
| `major` | `psc_StudentEnrolls.OlogyID` → `psc_Ologies.OlogyName` (mã ngành không có trong danh mục: null) |
| `currentCohort` | `psc_StudentEnrolls.CourseID` → `psc_Courses.CourseName` (lấy khóa qua bảng ngành, không qua lớp) |
| `originalCohort` | `psc_StudentEnrolls.OriginCourseID` → `psc_Courses.CourseName` |
| `trainingMode` | khóa → `psc_StudyTypes.StudyTypeName` |

Database trường ghi gì thì trả đúng như vậy (chỉ cắt khoảng trắng đầu cuối), không ghép thêm mục khác (vd bậc, năm nhập học), không tự điền thay (vd khóa gốc trống thì null, không lấy khóa hiện tại). Lớp có `IsInClass = 0` vẫn hiện.

| # | Việc | Gồm | |
|---|---|---|---|
| 0 | Xem dữ liệu thật | chạy vài câu SELECT bằng tài khoản dev: kiểu cột chữ (`NVARCHAR` hay `VARCHAR`, tiếng Việt có lỗi font không), collation (so email không phân biệt hoa thường thì khỏi `LOWER()`, dùng được index), kết nối có bắt buộc mã hóa (TLS) không · kết quả: cột tên `NVARCHAR` (tiếng Việt đúng), collation `CI_AS` nên so `=` là đủ, cột `Email` là `VARCHAR(50)` không có index (tham số khai báo `VarChar`), mã hóa không bắt buộc (vẫn bật), tài khoản dev không có quyền sửa |✓ |
| 1 | Cấu hình | `SCHOOL_DB_HOST/PORT/USER/PASSWORD` trong `app-config.ts`, tên database lấy từ `school-database.json` (đã có trong `.env.*`) · `SCHOOL_DB_HOST` trống mà dùng bản thật: báo lỗi rõ "chưa cấu hình database trường", backend vẫn chạy |✓ |
| 2 | Kết nối | thêm thư viện `mssql` · `SchoolDatabaseService`: một pool dùng chung, kết nối khi cần lần đầu, đóng khi tắt backend, thời gian chờ ngắn (vd 5 giây) · database trường lỗi / không tới được: trả 503 kèm câu thông báo, các trang khác vẫn chạy |✓ |
| 3 | Câu truy vấn | một câu SELECT dựng từ tên bảng, tên cột trong `school-database.json` (đặt trong `[...]` của SQL Server); giá trị người dùng chỉ đi qua tham số (`@email`, không nối chuỗi), `LEFT JOIN` các bảng ở trên · chỉ SELECT đúng các cột cần, **không bao giờ** SELECT cột mật khẩu của `psc_StudentInfo` · tách hàm thuần "dòng kết quả → `StudentInfo[]`" (cắt khoảng trắng, chuỗi rỗng thành null, sắp MSSV trùng email lên đầu) |✓ |
| 4 | Nối vào API | `findStudents` bản thật thay cho `throw realApiNotBuilt('dev-student-directory')`; tìm theo email của người dùng thay vì `userId` · bản giả `dev-student-directory` giữ nguyên · các hàm nhận người dùng (`id`, `email`) thay cho `userId` |✓ |
| 5 | Test | test hàm chuyển dòng → `StudentInfo[]` bằng dữ liệu giả (chạy trên CI, CI không tới được database trường) · test kết nối thật chỉ chạy khi có `SCHOOL_DB_HOST` · thử trên giao diện: `ALWAYS_REAL_APIS=dev-student-directory`, đăng nhập thử bằng một tài khoản có email sinh viên thật · đã thử trên 297 email thật (có đủ 47 email 2 MSSV): đều ra MSSV, trung bình 45 ms · đã thử trên giao diện |✓ |
| 6 | Container, bản thật | thử gọi từ trong container api (Docker tới được IP LAN) · container dev, prod gọi được · dùng tài khoản `lhquan` (không có quyền sửa), không làm tài khoản chỉ đọc riêng · máy chủ thật phải tới được database trường (Giai đoạn 3, bước 7) |✓ |
| 7 | Tài liệu | README (biến `SCHOOL_DB_*`), `.claude/CLAUDE.md` (cây thư mục, bỏ việc còn treo "cách kết nối database sinh viên"), `docs/business-rules.md` |✓ |

Để sau (ngoài phạm vi việc này): lấy họ tên (`psc_Students`), số điện thoại (`MobilePhone`, `HomePhone`) để điền sẵn khi sinh viên đăng nhập lần đầu.

Tên miền email sinh viên trong database trường là `email.hcmulaw.edu.vn`, là tên miền con của `hcmulaw.edu.vn`, nên `SCHOOL_EMAIL_DOMAINS` hiện có đã cho đăng nhập.

## Giai đoạn 3: Container hóa, triển khai (đang làm)

Ứng dụng đã đủ chức năng, kể cả `student-directory` bản thật (đọc database trường).

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

Bước 0 đến 6 tự làm được ngay, thử trên máy mình, không cần chờ ai. Bước 7 chờ thông tin từ bên ngoài, đến lúc có thì chỉ việc đưa lên.
Bước 6 (CI/CD) thử trọn vẹn trên máy cá nhân trước. Khi lên máy chủ trường chỉ đổi nơi chạy runner và `.env.prod`, quy trình giữ nguyên.

| # | Bước | Nhánh | Gồm | |
|---|---|---|---|---|
| 0 | Đóng gói | `trien-khai-dong-goi` | `api/Dockerfile` · build web thành `dist/` (đặt `VITE_USE_MOCK_BACKEND=false`, bỏ trống `VITE_APP_ENV` rồi mới build) · `nginx.conf` (`/api/` → `proxy_pass http://api:3000`, `/` → `dist/` với `try_files ... /index.html`, header `X-Forwarded-Proto`) · `docker-compose.prod.yml` (3 service, `restart: unless-stopped`, volume cho Postgres và `UPLOAD_DIR`, mount chứng chỉ) | ✓ |
| 1 | Tách biến môi trường dev / bản thật | `trien-khai-container` | `.env.dev.example`, `.env.prod.example` thay cho ba tệp mẫu hiện có (`.env.example` gốc, `api/.env.example`, `web/.env.example`): mỗi môi trường **một tệp** gồm biến Postgres, backend, giao diện; compose chia biến cho từng container · `.gitignore` bỏ qua `.env.dev`, `.env.prod`, giữ hai tệp mẫu · `.env.prod.example` ghi sẵn giá trị bản thật: `APP_ENV=` trống, `ENABLE_DEMO_APIS=false`, `WEB_BASE_URL_PRODUCTION`, `SMTP_*`, `GOOGLE_*`, email Admin đầu tiên, mật khẩu Postgres đặt mới · `VITE_*` của bản thật vẫn cố định trong `web/Dockerfile` (không bao giờ bật MSW ở bản thật) · app vẫn chỉ cấu hình bằng biến môi trường, container chỉ ghi sẵn giá trị: không có container vẫn chạy được (`loadApiEnvFile` đọc `.env.dev` ở thư mục gốc thay cho `api/.env`; biến compose truyền vào thì ưu tiên hơn, kiểm lại cách `process.loadEnvFile` xử lí biến đã có) · muốn thử API thật khi dev (vd đăng nhập Google) thì sửa `.env.dev` rồi `up -d api`, không cần bản prod · sửa README, `.claude/CLAUDE.md` (mục Hạ tầng) theo cách mới | ✓ |
| 2 | Container hóa dev | `trien-khai-container` | `docker-compose.dev.yml` (đã đổi tên từ `docker-compose.yml`): postgres (mở cổng 5432 để xem bằng công cụ DB) · api: target `dev` của `api/Dockerfile`, gắn mã nguồn vào container, lệnh khởi động `migrate deploy` → `prisma db seed` → `pnpm dev` (seed chỉ chạy lúc bật / restart container, sửa code thì `pnpm dev` tự chạy lại, không seed) · web: target `dev` của `web/Dockerfile`, Vite `https://localhost:5173`, `API_PROXY_TARGET=http://api:3000` · `node_modules` của container để trong volume riêng, không lẫn với máy · test chạy trong container (`docker compose -f docker-compose.dev.yml exec api pnpm test`) hoặc trên máy như cũ · trên máy vẫn `pnpm install` để VS Code gợi ý code, báo lỗi kiểu · chạy web một mình với API giả (MSW) vẫn làm được (`VITE_USE_MOCK_BACKEND=true` trong `.env.dev`) | ✓ |
| 3 | Cấu hình bản thật | `trien-khai-container` | `docker-compose.prod.yml` đọc `.env.prod` · lệnh khởi động api: `migrate deploy` → `seed:production` → `node dist/main.mjs`, mỗi lần bật / restart (đã có: `api/prisma/seed-production.ts` tạo Admin + cấu hình email, không xóa gì, chạy lại an toàn) · user dự án không có quyền `CREATEDB` ở bản thật (đã có: `APP_DB_CREATEDB: 'false'`; dev vẫn có vì `prisma migrate dev` cần tạo shadow database) · mật khẩu Postgres, SMTP, Google đặt mới, không dùng lại mật khẩu dev · email Admin đầu tiên lấy từ `FIRST_ADMIN_EMAIL` | ✓ |
| 4 | Chạy thử bản thật trên máy mình | `trien-khai-container` | `docker compose -f docker-compose.prod.yml up -d` với `localhost` và chứng chỉ tự kí · đăng nhập Google bằng Admin đầu tiên · nộp đơn, tải tệp, xử lí đơn, xuất Word, gửi thư · F5 ở trang con (vd `/forms/123`) không bị 404 · restart container: dữ liệu và tệp tải lên vẫn còn · đã thử: đăng nhập Google, lấy được thông tin sinh viên từ database trường, F5 trang con, http → https, restart giữ dữ liệu; nộp / xử lí / xuất Word / gửi thư đã thử ở bản dev (cùng code) | ✓ |
| 5 | Sao lưu | `trien-khai-sao-luu` | trang Sao lưu cho Admin: nơi lưu, sao lưu ngay, lịch định kì, lịch sử (mục **Sao lưu** bên dưới) · xem log đã có (`pnpm prod:logs`), `migrate deploy` đã tự chạy lúc bật container (bước 3) · khôi phục: tự chạy lệnh (`pg_restore`, giải nén `uploads/`), không làm trên giao diện | ✓ |
| 6 | CI/CD | `trien-khai-ci-cd` | GitHub Actions, chạy khi merge vào `main`: ① **CI**: chạy `pnpm --filter shared test`, `api test`, `web test` trên máy sạch (api cần Postgres tạm làm service container, chạy luôn migration); bỏ E2E Playwright cho nhẹ · đỏ thì dừng, không deploy ② **Build**: dựng image `api` và `nginx + web` rồi đẩy lên registry (GHCR); `VITE_USE_MOCK_BACKEND=false` và `VITE_APP_ENV=` đã đặt sẵn trong `web/Dockerfile`, CI không cần `.env.dev` ③ **Deploy**: máy đích kéo image mới → sao lưu Postgres → `migrate deploy` → `up -d` · thử deploy lên **máy cá nhân** bằng **self-hosted runner** (GitHub không tự với tới máy nằm sau mạng nhà / LAN) · secret để trong GitHub Secrets hoặc `.env` trên máy đích · tuỳ chọn: bấm Approve tay (GitHub Environments) trước khi deploy · đã viết: `.github/workflows/deploy.yml` (PR chỉ kiểm thử; push `main` thì kiểm thử → build đẩy GHCR tag theo commit → tự deploy lên `dev-machine` (máy cá nhân); Run workflow chọn `dev-machine` / `prod-machine` (máy chủ trường) thì deploy image đã build của commit mới nhất; mỗi máy một runner gắn nhãn và một Environment cùng tên), `docker/deploy.sh` (sao lưu bằng chức năng Sao lưu của cổng: lệnh `backup-before-update` trong container api đang chạy, vào mọi nơi lưu kiểu thư mục máy chủ, lịch sử ghi "Trước cập nhật" → `pull` → `up -d --no-build --wait`), compose dùng `API_IMAGE` / `WEB_IMAGE` có sẵn, README mục CI/CD · còn: cài runner, chạy thử trọn trên máy mình | |
| 7 | Lên máy chủ thật | (không có nhánh) | **chờ bên ngoài**: máy chủ Linux có Docker · domain / subdomain (vd `donthi.hcmulaw.edu.vn`) · chứng chỉ HTTPS thật · mở cổng 80/443 · thêm redirect `https://<domain>/api/auth/google/callback` vào OAuth client Google của trường (đã có) · máy chủ tới được database trường (192.168.3.25:1433) · xác nhận tên miền email thật để điền `SCHOOL_EMAIL_DOMAINS` · khi đủ thì: tạo `.env.prod` thật, mount chứng chỉ, `up -d`, đăng nhập Google bằng email trường, chạy lại các luồng chính | |

### Sao lưu

Tính năng của cổng, chỉ Admin dùng (quyền mới trong `ROLES`). Mỗi bản sao lưu luôn gồm **cả database lẫn tệp tải lên**: một tệp `sao-luu-<YYYYMMDD-HHmmss>.tar.gz` chứa `database.dump` (`pg_dump -Fc`) và thư mục `uploads/`. api tự chạy, không cần script ngoài.

Nơi lưu:

| Kiểu | Gồm |
|---|---|
| Thư mục trên máy chủ | Admin đặt tên và thư mục con, nằm trong `BACKUP_DIR` (volume `backups`, máy chủ thật có thể gắn ổ thứ hai vào đây); không cho ra ngoài `BACKUP_DIR` |
| Google Drive | Admin bấm kết nối tài khoản Google (OAuth client của trường, quyền `drive.file`), chọn thư mục có sẵn bằng Google Picker (thư mục chọn được cấp cho cổng); refresh token lưu mã hóa ở máy chủ, không trả về giao diện |
| Tải về máy Admin | chỉ có khi sao lưu ngay: tạo bản rồi tải thẳng về trình duyệt, không giữ trên máy chủ; bản đã lưu ở thư mục máy chủ cũng có nút tải về |

- **Sao lưu ngay**: popup chọn một hoặc nhiều nơi lưu, hoặc chỉ tải về máy này (tích tải về thì các nơi lưu bị khóa). Mỗi lúc chỉ chạy một bản, đang chạy thì nút khóa lại.
- **Lịch định kì**: nhiều lịch; mỗi lịch bật / tắt, hằng ngày hoặc hằng tuần (thứ mấy), giờ chạy, nơi lưu (một hoặc nhiều, không có Tải về). Mỗi nơi lưu đặt giữ N bản gần nhất (bản cũ hơn tự xóa sau mỗi lần sao lưu thành công, chạy tay hay định kì đều vậy). Giờ theo `Asia/Ho_Chi_Minh`.
- **Lịch sử**: mỗi lần chạy một dòng: lúc bắt đầu, thời gian chạy, chạy tay (ai bấm), định kì hay trước cập nhật (CI/CD), nơi lưu, dung lượng, thành công / lỗi (kèm câu lỗi). Bảng phân trang ở máy chủ, tìm, lọc, sắp xếp như các bảng khác. Trên đầu trang: lần sao lưu thành công gần nhất, lần chạy định kì tới.
- Lỗi khi sao lưu (hết chỗ, mất kết nối Drive…) ghi vào lịch sử, không làm hỏng các trang khác.

| # | Việc | Gồm | |
|---|---|---|---|
| 0 | Hợp đồng | `shared/src/api-contract/backups.ts`: nơi lưu, lịch, lịch sử, sao lưu ngay, tải về · quyền mới · câu thông báo | ✓ |
| 1 | API giả, giao diện | handler MSW · hook · trang Sao lưu trong menu Admin: thẻ tóm tắt, nơi lưu, lịch, bảng lịch sử | ✓ |
| 2 | Bảng, chạy sao lưu | `schema.prisma`: `BackupTarget`, `BackupSchedule`, `BackupRun` · `pg_dump` trong image api (bản `postgresql-client` khớp Postgres 18) · volume `backups` · tạo tệp `.tar.gz`, lưu vào thư mục máy chủ, tải về | ✓ |
| 3 | Lịch định kì | api tự kiểm mỗi phút, tới giờ thì chạy · giữ N bản gần nhất · restart không chạy trùng | ✓ |
| 4 | Google Drive | kết nối tài khoản ngay trong hộp thêm / sửa nơi lưu (popup sang Google, callback báo email về hộp thoại; bản giả `dev-google-drive-connect`) ✓ · ô thư mục kiểu "Lưu thành…": chỗ lưu (My Drive hoặc chọn bằng Google Picker) + tên thư mục mới không bắt buộc, máy chủ tạo khi Lưu vì Picker không tạo được (`GOOGLE_PICKER_API_KEY`; trước đó gõ đường dẫn thì cổng tạo thư mục mới trùng tên vì `drive.file` không thấy thư mục có sẵn), tải tệp lên · xóa bản cũ trên Drive · mất quyền thì báo trong lịch sử · nút Mở trên Drive ở lịch sử · đã thử với tài khoản Google thật trên bản prod | ✓ |
| 5 | Test, tài liệu | test api (quyền, lịch, giữ N bản) · thử trên bản prod ở máy mình · README, `docs/business-rules.md` · đã thử trên bản prod ở máy mình: thư mục máy chủ, Drive, tải về, lịch | ✓ |

### Lưu ý khi triển khai

- `VITE_*` được nhúng vào `dist/` lúc build. Bản thật đặt cố định trong `web/Dockerfile`; dev lấy từ `.env.dev`.
- `API_PROXY_TARGET` chỉ dùng ở dev (Vite làm proxy). Bản thật thì nginx làm việc này.
- Khi `ENABLE_DEMO_APIS=false`, chỉ còn đăng nhập Google: phải có OAuth client và tên miền email đúng trước khi mở cho người dùng.
- Backend không cần `trust proxy`: cookie `secure` theo `APP_ENV`, không đọc `req.protocol` / `req.ip` (đã kiểm ở bước 0).
- Compose tự dựng `DATABASE_URL` từ biến Postgres trong tệp env (host `postgres`), không ghi chuỗi kết nối hai lần.
- `api` và `postgres` bản thật không mở cổng ra ngoài, nginx gọi backend bằng tên service (`http://api:3000`), không dùng `127.0.0.1`.
- Mật khẩu SMTP, `GOOGLE_CLIENT_SECRET`, mật khẩu Postgres bản thật chỉ nằm trong `.env.prod` trên máy chủ, không commit, không đóng gói vào image.
- Không dùng `down -v` (`pnpm prod:wipe`) trên máy chủ thật: xóa luôn volume, mất dữ liệu và tệp tải lên (dev thì không sao, bật lại là seed lại).
