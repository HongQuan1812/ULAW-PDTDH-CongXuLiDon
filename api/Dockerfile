# Image của backend (NestJS). Build từ thư mục gốc repo, vì backend cần cả shared/:
#   docker compose -f docker-compose.prod.yml build api
# Image không chứa .env: biến môi trường do docker-compose.prod.yml đưa vào lúc chạy.
FROM node:24.16.0-slim

# Prisma cần openssl; pnpm cùng phiên bản với máy phát triển
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@12.18.0
ENV CI=true

WORKDIR /app

# Cài thư viện trước khi chép mã nguồn: mã đổi mà thư viện không đổi thì Docker dùng lại lớp này
# (cài xong tự chạy prisma generate, nên cần schema)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY api/package.json api/prisma.config.ts api/
COPY api/prisma api/prisma
RUN pnpm install --frozen-lockfile --filter api...

# Chép mã nguồn rồi build ra api/dist/main.mjs (gói luôn shared/)
COPY shared/ shared/
COPY api/ api/
RUN pnpm --filter api build

# Thư mục tệp tải lên (gắn volume ở docker-compose.prod.yml), thuộc user node vì không chạy bằng root
WORKDIR /app/api
RUN mkdir -p uploads && chown node:node uploads
USER node

ENV NODE_ENV=production
EXPOSE 3000

# Kiểm tra sống: gọi /api/health
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://localhost:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/main.mjs"]
