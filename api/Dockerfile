# Image của backend (NestJS). Build từ thư mục gốc repo, vì backend cần cả shared/.
#   dev:      target dev (docker-compose.dev.yml), mã nguồn gắn từ máy vào, không chép vào image
#   bản thật: target production, mặc định (docker-compose.prod.yml build api)
# Image không chứa .env: biến môi trường do compose đưa vào lúc chạy.

# ---------- Nền chung ----------
FROM node:24.16.0-slim AS base

# Prisma cần openssl; trang Sao lưu cần pg_dump cùng bản với PostgreSQL (18, lấy từ kho apt.postgresql.org) và tar;
# pnpm cùng phiên bản với máy phát triển.
# Max-Age: apt mặc định gửi "Cache-Control: max-age=0"; mạng của Docker Desktop trên Windows chặn request mang header này
# (apt báo Connection failed, trên WSL thì không). Đổi chỉ ảnh hưởng bộ nhớ đệm trên đường, chữ kí gói vẫn được kiểm như thường
RUN echo 'Acquire::http::Max-Age "86400";' > /etc/apt/apt.conf.d/99max-age \
  && apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && install -d /usr/share/postgresql-common/pgdg \
  && curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  && . /etc/os-release \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $VERSION_CODENAME-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client-18 \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@12.18.0
ENV CI=true
WORKDIR /app

# ---------- Dev: chỉ có Node, pnpm; thư viện cài lúc bật container, vào volume riêng ----------
# Tạo sẵn các thư mục sẽ gắn volume, thuộc user node (uid 1000, trùng user trên máy), để tệp sinh ra trong
# thư mục mã nguồn (dist/, uploads/, src/generated/) vẫn thuộc user trên máy
FROM base AS dev
RUN mkdir -p /app/node_modules /app/api/node_modules /app/shared/node_modules /home/node/.pnpm-store \
  && chown -R node:node /app /home/node/.pnpm-store
USER node
WORKDIR /app/api

# ---------- Bản thật: cài thư viện, build ----------
FROM base AS production

# Cài thư viện trước khi chép mã nguồn: mã đổi mà thư viện không đổi thì Docker dùng lại lớp này
# (cài xong tự chạy prisma generate, nên cần schema và prisma.config.ts)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY api/package.json api/prisma.config.ts api/
COPY api/prisma api/prisma
# prisma.config.ts dùng hàm đọc tệp env này
COPY api/src/config/env-file.ts api/src/config/
RUN pnpm install --frozen-lockfile --filter api...

# Chép mã nguồn rồi build ra api/dist/main.mjs (gói luôn shared/)
COPY shared/ shared/
COPY api/ api/
RUN pnpm --filter api build

# Thư mục tệp tải lên và thư mục sao lưu (gắn volume ở docker-compose.prod.yml), thuộc user node vì không chạy bằng root
WORKDIR /app/api
RUN mkdir -p uploads backups && chown node:node uploads backups
USER node

ENV NODE_ENV=production
EXPOSE 3000

# Kiểm tra sống: gọi /api/health
# (start-period dài hơn vì trước khi chạy backend còn migrate, seed)
HEALTHCHECK --interval=10s --timeout=3s --start-period=60s --retries=5 \
  CMD node -e "fetch('http://localhost:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Mỗi lần bật / restart: tạo / cập nhật bảng → Admin đầu tiên + cấu hình email (chỉ thêm khi chưa có, không xóa gì) → chạy backend
# (exec để node nhận tín hiệu dừng của docker trực tiếp)
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm seed:production && exec node dist/main.mjs"]
