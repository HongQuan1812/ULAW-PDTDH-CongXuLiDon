#!/bin/sh
# Chạy MỘT LẦN khi container PostgreSQL khởi tạo thư mục dữ liệu trống (image postgres tự chạy mọi tệp trong /docker-entrypoint-initdb.d).
# Tạo user riêng của dự án và database của dự án; user này không phải superuser, chỉ làm chủ database của mình.
# Thêm dự án khác vào cùng instance sau này: đăng nhập bằng superuser (POSTGRES_USER) rồi chạy các lệnh tương tự, không cần dựng lại container.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v app_user="$APP_DB_USER" -v app_password="$APP_DB_PASSWORD" -v app_db="$APP_DB_NAME" \
  -v app_createdb="${APP_DB_CREATEDB:-true}" <<'SQL'
-- User của dự án: đăng nhập được.
-- CREATEDB để "prisma migrate dev" tạo database tạm ("shadow database") khi phát triển.
-- Bản thật (docker-compose.prod.yml đặt APP_DB_CREATEDB=false) không cần: "prisma migrate deploy" không tạo database
\if :app_createdb
CREATE ROLE :"app_user" LOGIN CREATEDB PASSWORD :'app_password';
\else
CREATE ROLE :"app_user" LOGIN NOCREATEDB PASSWORD :'app_password';
\endif

-- Database của dự án, do user dự án làm chủ; user khác (trừ superuser) không kết nối được
CREATE DATABASE :"app_db" OWNER :"app_user";
REVOKE ALL ON DATABASE :"app_db" FROM PUBLIC;
SQL
