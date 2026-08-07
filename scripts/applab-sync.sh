#!/usr/bin/env bash
#
# applab-sync.sh — App Lab 앱 폴더에 버튼 브리지 파일 3개를 복사한다.
#
#   bash scripts/applab-sync.sh
#
# App Lab 에서 앱을 Duplicate/생성해 두면, 그 폴더를 알아서 찾아
# sketch.ino / python/main.py / app.yaml 을 저장소 것으로 덮어쓴다.
# 긴 경로를 손으로 치다 오타 나는 일을 없애기 위한 스크립트다.
#
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$REPO/firmware/button_bridge"

ok()   { printf '  \033[1;32m✔\033[0m %s\n' "$*"; }
die()  { printf '  \033[1;31m✘\033[0m %s\n' "$*" >&2; exit 1; }

[ -f "$SRC/sketch/sketch.ino" ] || die "저장소에 스케치가 없습니다: $SRC"

# 앱 폴더 찾기 — 이름이 정확히 맞으면 그걸, 아니면 ~/ArduinoApps 에서
# sketch/ 를 가진 가장 최근 폴더(내부용 'arduino' 제외)를 고른다.
APP="$HOME/ArduinoApps/torus-button-bridge"
if [ ! -d "$APP/sketch" ]; then
  APP=""
  for d in $(ls -dt "$HOME"/ArduinoApps/*/ 2>/dev/null); do
    base="$(basename "$d")"
    [ "$base" = "arduino" ] && continue
    if [ -d "$d/sketch" ]; then APP="${d%/}"; break; fi
  done
fi
[ -n "$APP" ] || die "App Lab 앱 폴더를 못 찾았습니다. App Lab 에서 먼저 앱을 Duplicate 하세요."

echo "대상 앱 폴더: $APP"

cp "$SRC/sketch/sketch.ino" "$APP/sketch/sketch.ino" && ok "sketch.ino"
mkdir -p "$APP/python"
cp "$SRC/python/main.py" "$APP/python/main.py" && ok "python/main.py"
cp "$SRC/app.yaml" "$APP/app.yaml" && ok "app.yaml"

# 진짜 우리 스케치인지 확인
if head -3 "$APP/sketch/sketch.ino" | grep -q "아케이드 버튼"; then
  ok "스케치 내용 확인됨"
else
  die "복사는 됐는데 내용이 이상합니다. head -3 $APP/sketch/sketch.ino 를 확인하세요."
fi

cat <<'EOF'

끝. 다음 할 일:
  1. App Lab 에서 이 앱을 열고 Run (스케치 굽기 + 브리지 시작)
  2. Python 탭에서 "Bridge RPC 대기 중" 확인
  3. 버튼을 왼쪽부터 눌러 0(빨강)→1(노랑)→2(초록)→3(파랑) 확인
  4. 앱의 'Run at startup' 켜기 (모스부호 앱은 끄기)
  5. bash scripts/install-kiosk.sh
  6. sudo reboot
EOF
