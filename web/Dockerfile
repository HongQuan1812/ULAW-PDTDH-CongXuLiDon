# Image của giao diện: build web thành dist/, rồi phục vụ bằng nginx (nginx cũng chuyển /api sang backend).
# Build từ thư mục gốc repo, vì web cần cả shared/:
#   docker compose -f docker-compose.prod.yml build nginx

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
# (web/.env không được gửi vào lúc build, xem .dockerignore):
#   backend thật, không MSW · tắt phần thử nghiệm của giao diện
ENV VITE_USE_MOCK_BACKEND=false \
    VITE_REAL_BACKEND_GROUPS="" \
    VITE_APP_ENV=""
RUN pnpm --filter web build

# ---------- Bước 2: nginx phục vụ dist/ ----------
FROM nginx:1.30.6-alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80 443
