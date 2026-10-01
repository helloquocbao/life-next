#!/usr/bin/env bash
# =============================================================================
# Deploy backend LifeNext lên server production.
#   ./deploy/production/deploy.sh
# Đồng bộ mã nguồn backend + cấu hình compose lên /opt/lifenext rồi build & chạy lại container.
# .env và secrets/ trên server được giữ nguyên (không bao giờ ghi đè từ máy dev).
# =============================================================================
set -euo pipefail

SERVER="${SERVER:-root@163.61.72.37}"
REMOTE_DIR="${REMOTE_DIR:-/opt/lifenext}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

if [ ! -d "$ROOT/backend/src/DeathNote.HttpApi.Host/wwwroot/libs/abp" ]; then
  echo "Thiếu backend/src/DeathNote.HttpApi.Host/wwwroot/libs — chạy 'abp install-libs' trong thư mục đó trước." >&2
  exit 1
fi

echo "→ Đồng bộ mã nguồn lên $SERVER:$REMOTE_DIR"
rsync -az --delete \
  --exclude bin/ --exclude obj/ --exclude node_modules/ --exclude Logs/ --exclude App_Data/ \
  --exclude test/ --exclude .DS_Store --exclude '*.user' \
  "$ROOT/backend/" "$SERVER:$REMOTE_DIR/backend/"
rsync -az \
  --exclude .env --exclude secrets/ --exclude .DS_Store \
  "$ROOT/deploy/production/" "$SERVER:$REMOTE_DIR/deploy/production/"

echo "→ Build & khởi động container"
ssh "$SERVER" "cd $REMOTE_DIR/deploy/production && docker compose up -d --build && docker image prune -f >/dev/null && docker compose ps"
