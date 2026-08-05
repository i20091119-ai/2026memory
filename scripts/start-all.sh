#!/usr/bin/env bash
#
# start-all.sh — 게임에 필요한 세 조각을 한 번에 띄운다.
#
#   웹서버(8000) + 버튼 브리지 + 크로미움 전체화면
#
# systemd 사용자 서비스를 못 쓰는 환경(그래픽 세션 없이 SSH 로만 붙는 경우 등)의
# 대비책이자, "지금 당장 한 번 띄워 보고 싶을 때" 쓰는 명령이기도 하다.
# 크로미움을 닫으면 웹서버와 브리지도 같이 정리된다.
#
#   bash scripts/start-all.sh              # 전체화면(키오스크)
#   bash scripts/start-all.sh --windowed   # 창 모드 (디버깅용)
#   bash scripts/start-all.sh --no-browser # 서버·브리지만 (브라우저는 직접 열기)
#
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT=8000
PIDS=()

cleanup() {
  for p in "${PIDS[@]:-}"; do
    [ -n "$p" ] && kill "$p" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

MODE="kiosk"
for a in "$@"; do
  case "$a" in
    --windowed)   MODE="window" ;;
    --no-browser) MODE="none" ;;
  esac
done

# ------------------------------------------------------------------ 웹서버
if curl -sf "http://localhost:$PORT/" >/dev/null 2>&1; then
  echo "웹서버가 이미 $PORT 에서 돌고 있습니다 — 새로 띄우지 않습니다."
else
  python3 -m http.server "$PORT" -d "$REPO" --bind 127.0.0.1 >/dev/null 2>&1 &
  PIDS+=("$!")
  echo "웹서버 시작: http://localhost:$PORT/"
fi

# ------------------------------------------------------------------ 브리지
BRIDGE="$REPO/firmware/button_bridge/python/main.py"
if [ -f "$BRIDGE" ] && python3 -c 'import websockets' 2>/dev/null; then
  python3 "$BRIDGE" --source serial --port "${TORUS_SERIAL:-/dev/ttyACM0}" >/dev/null 2>&1 &
  PIDS+=("$!")
  echo "버튼 브리지 시작 (ws://localhost:8765)"
else
  echo "버튼 브리지를 건너뜁니다 — 키보드 1234 로 플레이됩니다."
  echo "  버튼을 쓰려면: pip3 install websockets pyserial"
fi

# 웹서버가 응답할 때까지 잠깐 기다린다 (브라우저가 먼저 뜨면 빈 화면이 뜬다)
for _ in $(seq 1 20); do
  curl -sf "http://localhost:$PORT/" >/dev/null 2>&1 && break
  sleep 0.5
done

# ------------------------------------------------------------------ 브라우저
if [ "$MODE" = "none" ]; then
  echo "브라우저는 띄우지 않습니다. http://localhost:$PORT/ 을 직접 여세요."
  echo "멈추려면 Ctrl+C."
  wait
  exit 0
fi

BROWSER=""
for b in chromium chromium-browser google-chrome chrome; do
  if command -v "$b" >/dev/null 2>&1; then BROWSER="$(command -v "$b")"; break; fi
done
if [ -z "$BROWSER" ]; then
  echo "크로미움이 없습니다: sudo apt install chromium"
  echo "서버는 떠 있으니 다른 브라우저로 http://localhost:$PORT/ 을 여세요. (Ctrl+C 로 종료)"
  wait
  exit 0
fi

FLAGS=(--noerrdialogs --disable-infobars --disable-session-crashed-bubble
       --disable-features=Translate --autoplay-policy=no-user-gesture-required
       --check-for-update-interval=31536000
       --disable-pinch --overscroll-history-navigation=0)
[ "$MODE" = "kiosk" ] && FLAGS+=(--kiosk)

# 화면 절전 끄기 (X11 에서만, 실패해도 무시)
command -v xset >/dev/null 2>&1 && [ -n "${DISPLAY:-}" ] && xset s off -dpms 2>/dev/null

echo "브라우저를 띄웁니다. 닫으면 전부 정리됩니다."
"$BROWSER" "${FLAGS[@]}" "http://localhost:$PORT/"
