#!/bin/sh
# Tạo chứng chỉ HTTPS tự kí cho localhost, để chạy thử docker-compose.prod.yml trên máy mình.
# Trình duyệt sẽ cảnh báo "không an toàn": bấm tiếp tục. Máy chủ thật dùng chứng chỉ của trường, không dùng tệp này.
# Chạy từ thư mục gốc repo: sh docker/nginx/make-dev-cert.sh
set -e

CERT_DIR="$(dirname "$0")/certs"
mkdir -p "$CERT_DIR"

openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout "$CERT_DIR/privkey.pem" -out "$CERT_DIR/fullchain.pem" \
  -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo "Đã tạo $CERT_DIR/fullchain.pem và $CERT_DIR/privkey.pem"
