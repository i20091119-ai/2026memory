#!/usr/bin/env bash
#
# pi-kiosk.sh — 라즈베리파이 5에서 게임기 화면을 띄운다 (부팅 자동시작용).
#
#   bash scripts/pi-kiosk.sh            # 모니터 배치 → 소리 → 절전 해제 → 크로미움
#   bash scripts/pi-kiosk.sh --layout   # 모니터 배치만 (확인용)
#   bash scripts/pi-kiosk.sh --audio    # 소리 출력 설정만
#
# 파이 한 대가 모니터 두 대를 맡는다. 두 모니터를 옆으로 이어 붙여(3840×1080)
# 크로미움 창 하나를 그 크기로 띄우면, 웹앱이 왼쪽 반 = 책상 1, 오른쪽 반 = 책상 2 로
# 쓴다 (?seats=2). 모니터가 하나뿐이면 보통대로 1좌석이다.
#
# --kiosk 를 쓰지 않는다. 크로미움의 전체화면은 "모니터 하나"에 붙기 때문이다.
# 대신 --app 창을 3840×1080 으로 띄우고, 창 테두리는 Openbox 규칙(install-kiosk.sh 가
# 넣는다)으로 없앤다.
#
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${TORUS_PORT:-8000}"
PROFILE="$HOME/.torus-kiosk-profile"
LOG="$HOME/torus-kiosk.log"

log() { printf '%s  %s\n' "$(date '+%F %T')" "$*" | tee -a "$LOG"; }

# ------------------------------------------------------------------ 모니터 배치
# 연결된 출력 두 개를 왼쪽·오른쪽으로 이어 붙인다. 출력 이름은 보드/드라이버마다
# 다르므로(HDMI-1, HDMI-A-1 …) xrandr 가 "connected" 라고 하는 것을 순서대로 쓴다.
# 파이 5 의 HDMI0(전원 단자 옆) 이 먼저 나오므로 그쪽이 왼쪽 책상이다.
layout() {
  command -v xrandr >/dev/null 2>&1 || { log "xrandr 없음 — 배치 생략"; return 0; }
  local outs
  mapfile -t outs < <(xrandr --query 2>/dev/null | awk '/ connected/ {print $1}')
  if [ "${#outs[@]}" -ge 2 ]; then
    xrandr --output "${outs[0]}" --mode 1920x1080 --pos 0x0 --rotate normal \
           --output "${outs[1]}" --mode 1920x1080 --pos 1920x0 --rotate normal 2>>"$LOG" \
      && log "모니터 2대 배치: ${outs[0]} 왼쪽, ${outs[1]} 오른쪽" \
      || log "xrandr 배치 실패 — 기본 배치로 진행"
    echo 2
  else
    [ "${#outs[@]}" -eq 1 ] && xrandr --output "${outs[0]}" --mode 1920x1080 --pos 0x0 2>>"$LOG"
    log "모니터 ${#outs[@]}대 — 1좌석"
    echo 1
  fi
}

# ------------------------------------------------------------------ 소리
# USB 사운드카드를 기본 출력으로, 볼륨 100% (스피커 노브로만 조절한다).
audio() {
  if command -v wpctl >/dev/null 2>&1; then
    local id
    id="$(wpctl status 2>/dev/null | awk '/Sinks:/{f=1;next} /Sources:/{f=0} f && /[Uu][Ss][Bb]/ {gsub(/[^0-9]/,"",$1); if($1=="") {for(i=1;i<=NF;i++) if($i ~ /^[0-9]+\.$/){gsub(/\./,"",$i); print $i; exit}} else {print $1; exit}}')"
    if [ -n "$id" ]; then
      wpctl set-default "$id" 2>>"$LOG" && log "기본 출력: USB 사운드카드 (#$id)"
    else
      log "USB 사운드카드를 못 찾음 — 기본 출력 그대로"
    fi
    wpctl set-volume @DEFAULT_AUDIO_SINK@ 1.0 2>>"$LOG"
    wpctl set-mute @DEFAULT_AUDIO_SINK@ 0 2>>"$LOG"
  elif command -v pactl >/dev/null 2>&1; then
    local sink
    sink="$(pactl list short sinks 2>/dev/null | grep -i usb | head -1 | cut -f2)"
    [ -n "$sink" ] && pactl set-default-sink "$sink" && log "기본 출력: $sink"
    pactl set-sink-volume @DEFAULT_SINK@ 100% 2>>"$LOG"
    pactl set-sink-mute @DEFAULT_SINK@ 0 2>>"$LOG"
  else
    log "wpctl/pactl 없음 — 소리 설정 생략"
  fi
}

case "${1:-}" in
  --layout) layout >/dev/null; exit 0 ;;
  --audio)  audio; exit 0 ;;
esac

# ------------------------------------------------------------------ 본 실행
log "키오스크 시작"

# 웹서버가 뜰 때까지 기다린다 (먼저 뜨면 "연결할 수 없음" 화면이 남는다)
for _ in $(seq 1 60); do
  curl -sf "http://localhost:$PORT/" >/dev/null 2>&1 && break
  sleep 1
done

SEATS="${TORUS_SEATS:-$(layout | tail -1)}"
audio

# 화면 절전·블랭킹 끄기, 커서 숨기기
xset s off -dpms 2>/dev/null || true
xset s noblank 2>/dev/null || true
command -v unclutter >/dev/null 2>&1 && (unclutter -idle 0.5 -root >/dev/null 2>&1 &)

BROWSER=""
for b in chromium chromium-browser; do
  command -v "$b" >/dev/null 2>&1 && { BROWSER="$(command -v "$b")"; break; }
done
[ -n "$BROWSER" ] || { log "크로미움 없음: sudo apt install -y chromium"; exit 1; }

if [ "$SEATS" = "2" ]; then
  URL="http://localhost:$PORT/?seats=2"
  WIN="--window-size=3840,1080 --window-position=0,0"
else
  URL="http://localhost:$PORT/?seats=1"
  WIN="--window-size=1920,1080 --window-position=0,0"
fi
log "좌석 $SEATS · $URL"

# 브라우저 캐시는 램(/dev/shm)에 — SD 카드에 쓰지 않는다.
mkdir -p /dev/shm/torus-cache
exec "$BROWSER" \
  --app="$URL" $WIN \
  --user-data-dir="$PROFILE" --disk-cache-dir=/dev/shm/torus-cache \
  --noerrdialogs --disable-infobars --disable-session-crashed-bubble \
  --disable-features=Translate,TranslateUI \
  --autoplay-policy=no-user-gesture-required \
  --check-for-update-interval=31536000 \
  --disable-pinch --overscroll-history-navigation=0 \
  --no-first-run --no-default-browser-check --restore-last-session=false \
  --password-store=basic \
  >>"$LOG" 2>&1
