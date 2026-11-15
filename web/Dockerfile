# Image của giao diện. Build từ thư mục gốc repo, vì web cần cả shared/.
#   dev:      target dev (docker-compose.dev.yml), chạy Vite, mã nguồn gắn từ máy vào
#   bản thật: target production, mặc định (docker-compose.prod.yml build nginx): build web thành dist/,
#             rồi phục vụ bằng nginx (nginx cũng chuyển /api sang backend)

# ---------- Dev: chỉ có Node, pnpm; thư viện cài lúc bật container, vào volume riêng ----------
FROM node:24.16.0-slim AS dev
RUN npm install -g pnpm@12.18.0
ENV CI=true
RUN mkdir -p /app/node_modules /app/web/node_modules /app/shared/node_modules /home/node/.pnpm-store \
  && chown -R node:node /app /home/node/.pnpm-store
USER node
WORKDIR /app/web

# ---------- Bước 1: build web ----------
FROM node:24.16.0-slim AS build
RUN npm install -g pnpm@12.18.0
ENV CI=true
WORKDIR /app

# Cài thư viện trước khi chép mã nguồn, để Docker dùng lại lớp này khi chỉ đổi mã
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY shared/package.json shared/
COPY web/package.json web/
RUN pnpm install --frozen-lockfile --filter web...

COPY shared/ shared/
COPY web/ web/

# Biến VITE_* được nhúng vào dist/ lúc build, nên đặt giá trị bản thật ngay ở đây
# (.env.dev, .env.prod không được gửi vào lúc build, xem .dockerignore):
#   backend thật, không MSW · tắt phần thử nghiệm của giao diện
ENV VITE_USE_MOCK_BACKEND=false \
    VITE_REAL_BACKEND_GROUPS="" \
    VITE_APP_ENV=""
RUN pnpm --filter web build

# ---------- Bước 2: nginx phục vụ dist/ ----------
FROM nginx:1.30.6-alpine AS production
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80 443
