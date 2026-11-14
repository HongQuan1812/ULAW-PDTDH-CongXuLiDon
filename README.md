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

Nhóm API nào đã làm xong ở backend thì ghi tên nhóm vào `REAL_API_GROUPS` (`web/src/mocks/realApiGroups.ts`).
Các nhóm còn lại dùng API giả (MSW) ngay trong trình duyệt, nên chỉ chạy frontend vẫn bấm thử được.

Tắt PostgreSQL:

```bash
docker compose down
```

## Đăng nhập Google

Chưa điền `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` trong `api/.env` thì nút Đăng nhập bằng Google báo "chưa bật";
khi `APP_ENV=dev` vẫn đăng nhập thử theo vai trò được (phần "Bản thử nghiệm" ở trang Đăng nhập).

Tạo OAuth client (làm một lần, ở https://console.cloud.google.com):

1. Tạo project (hoặc chọn project có sẵn).
2. **Google Auth Platform → Branding**: điền tên ứng dụng, email hỗ trợ.
   **Audience**: chọn *Internal* nếu project thuộc Google Workspace của trường (chỉ email trường đăng nhập được);
   không thì *External*, và khi còn ở trạng thái *Testing* phải thêm email người thử vào *Test users*.
3. **Clients → Create client** → loại *Web application*:
   - *Authorized JavaScript origins*: `https://localhost:5173`
   - *Authorized redirect URIs*: `https://localhost:5173/api/auth/google/callback`
   (lên máy chủ thật thì thêm `https://<tên miền thật>` và `https://<tên miền thật>/api/auth/google/callback`)
4. Chép *Client ID* và *Client secret* vào `api/.env`, rồi chạy lại backend.

Redirect URI phải trùng từng ký tự với `WEB_BASE_URL_DEV` (khi dev) hoặc `WEB_BASE_URL_PRODUCTION` + `/api/auth/google/callback`.
Google không nhận địa chỉ IP trong mạng LAN (vd `https://192.168.x.x:5173`), nên thử đăng nhập Google bằng `https://localhost:5173`.

Email nào được vào cổng do `SCHOOL_EMAIL_DOMAINS` (`shared/src/validators/auth.ts`) quyết định, kể cả tên miền con.
Email trường đăng nhập lần đầu được tạo tài khoản Người nộp đơn; đổi vai trò ở trang Quản lí tài khoản (Admin).
