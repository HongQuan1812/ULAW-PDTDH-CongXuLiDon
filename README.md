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
