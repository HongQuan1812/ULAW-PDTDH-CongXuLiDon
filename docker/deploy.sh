#!/usr/bin/env bash
# Deploy bản thật bằng image đã build sẵn trên GHCR. Job deploy của .github/workflows/deploy.yml gọi tệp này trên máy đích.
#   1. sao lưu bằng chính chức năng Sao lưu của cổng (lệnh backup-before-update trong container api đang chạy):
#      database + uploads/ vào mọi nơi lưu kiểu "Thư mục trên máy chủ", giữ N bản, lịch sử ghi "Trước cập nhật"
#   2. kéo image mới
#   3. bật lại (api tự chạy migrate deploy → seed:production), chờ tới khi khỏe
#
# Biến cần có:
#   DEPLOY_DIR  thư mục trên máy đích chứa .env.prod, chứng chỉ (TLS_CERT_DIR), docker/postgres/init
#               (thử trên máy mình: chính thư mục repo đang làm, nên trùng container với pnpm prod:up)
#   API_IMAGE   vd ghcr.io/<chủ repo>/ulaw-cong-xu-li-don-api:<commit>
#   WEB_IMAGE   vd ghcr.io/<chủ repo>/ulaw-cong-xu-li-don-web:<commit>
# Tệp compose lấy từ mã nguồn của commit đang deploy; đường dẫn tương đối trong đó tính từ DEPLOY_DIR.
set -euo pipefail

# Git Bash trên Windows: không tự đổi các chuỗi bắt đầu bằng / thành đường dẫn Windows
export MSYS_NO_PATHCONV=1

: "${DEPLOY_DIR:?Chưa đặt DEPLOY_DIR (GitHub: Settings → Environments → dev-machine hoặc prod-machine → Variables)}"
: "${API_IMAGE:?Thiếu API_IMAGE}"
: "${WEB_IMAGE:?Thiếu WEB_IMAGE}"

# Git Bash trên Windows: pwd trả /d/..., docker cần D:/... nên đổi bằng cygpath (Linux không có cygpath, giữ nguyên)
native_path() {
  if command -v cygpath >/dev/null; then cygpath -m "$1"; else echo "$1"; fi
}

DEPLOY_DIR="$(native_path "$DEPLOY_DIR")"
COMPOSE_FILE_PATH="$(native_path "$(pwd)")/docker-compose.prod.yml"
ENV_FILE="$DEPLOY_DIR/.env.prod"
API_CONTAINER=ulaw-cong-xu-li-don-prod-api
BACKUP_COMMAND=dist/backups/backup-before-update.mjs

if [ ! -f "$ENV_FILE" ]; then
  echo "Không thấy $ENV_FILE" >&2
  exit 1
fi

compose() {
  docker compose -f "$COMPOSE_FILE_PATH" --project-directory "$DEPLOY_DIR" --env-file "$ENV_FILE" "$@"
}

# 1. Sao lưu trước khi đổi bản; lỗi thì dừng, không deploy
#    (lần deploy đầu chưa có container api, hoặc bản đang chạy chưa có lệnh này: bỏ qua)
if [ "$(docker inspect -f '{{.State.Running}}' "$API_CONTAINER" 2>/dev/null || true)" != "true" ]; then
  echo "Chưa có api đang chạy, bỏ qua sao lưu"
elif ! docker exec "$API_CONTAINER" test -f "$BACKUP_COMMAND"; then
  echo "Bản đang chạy chưa có lệnh sao lưu trước cập nhật, bỏ qua sao lưu"
else
  docker exec "$API_CONTAINER" node "$BACKUP_COMMAND"
fi

# 2. Kéo image mới
export API_IMAGE WEB_IMAGE
compose pull

# 3. Bật lại bằng image vừa kéo (không build), chờ api khỏe
compose up -d --no-build --wait --wait-timeout 300
compose ps

# Dọn image không còn tên (bản cũ bị thay)
docker image prune -f
