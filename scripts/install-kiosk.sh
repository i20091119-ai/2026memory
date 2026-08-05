#!/usr/bin/env bash
#
# install-kiosk.sh — 우노 Q 에 메모리 게임을 설치하고 부팅 시 자동으로 뜨게 한다.
#
#   bash scripts/install-kiosk.sh              # 설치 / 재설치
#   bash scripts/install-kiosk.sh --uninstall  # 되돌리기 (파일은 안 지운다)
#   bash scripts/install-kiosk.sh --status     # 지금 상태만 보기
#
# 서비스 세 개를 사용자 서비스로 등록한다.
#   torus-web     정적 웹서버 (python3 -m http.server 8000)
#   torus-bridge  버튼 → WebSocket 브리지 (firmware/button_bridge/python/main.py)
#   torus-kiosk   크로미움 전체화면
#
# 몇 번을 돌려도 같은 결과가 되게(멱등) 만들었다. 리눅스 상시 켜짐 설정이나
# 다른 앱은 건드리지 않는다 — 그건 disable-autostart.sh 의 몫이다.
#
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UNITS="$HOME/.config/systemd/user"
PORT=8000
SERVICES=(torus-web torus-bridge torus-kiosk)
# 서비스나 sudo 로 실행될 때는 $USER 가 비어 있을 수 있다
WHO="${USER:-$(id -un)}"

ok()   { printf '  \033[1;32m✔\033[0m %s\n' "$*"; }
warn() { printf '  \033[1;33m!\033[0m %s\n' "$*"; }
die()  { printf '  \033[1;31m✘\033[0m %s\n' "$*" >&2; exit 1; }
head_() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }

# ------------------------------------------------------------------ 상태 보기
show_status() {
  head_ "서비스 상태"
  for s in "${SERVICES[@]}"; do
    local en ac
    en=$(systemctl --user is-enabled "$s" 2>/dev/null || echo "-")
    ac=$(systemctl --user is-active  "$s" 2>/dev/null || echo "-")
    printf '  %-14s 자동시작 %-10s 지금 %s\n' "$s" "$en" "$ac"
  done
  printf '  %-14s %s\n' "linger" "$(loginctl show-user "${WHO}" -p Linger --value 2>/dev/null || echo '-')"
  printf '  %-14s %s\n' "웹서버" "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/" 2>/dev/null || echo '응답없음')"
  echo
  echo "로그를 보려면: journalctl --user -u torus-kiosk -f"
}

[ "${1:-}" = "--status" ] && { show_status; exit 0; }

# ------------------------------------------------------------------ 되돌리기
if [ "${1:-}" = "--uninstall" ]; then
  head_ "메모리 게임 자동시작 해제"
  for s in "${SERVICES[@]}"; do
    systemctl --user disable --now "$s" 2>/dev/null && ok "$s 껐습니다" || true
    rm -f "$UNITS/$s.service"
  done
  rm -f "$HOME/.config/autostart/torus-kiosk.desktop"
  systemctl --user daemon-reload 2>/dev/null || true
  ok "서비스 파일을 지웠습니다 (저장소와 게임 파일은 그대로입니다)"
  echo
  echo "linger 는 남겨 두었습니다. 정말 끄려면: loginctl disable-linger ${WHO}"
  exit 0
fi

# ------------------------------------------------------------------ 준비 확인
head_ "1. 준비물 확인"

[ -f "$REPO/index.html" ] || die "$REPO 에 index.html 이 없습니다. 저장소 안에서 실행하세요."
ok "게임 파일: $REPO"

command -v python3 >/dev/null || die "python3 가 없습니다: sudo apt install python3"
ok "python3: $(python3 --version 2>&1)"

BROWSER=""
for b in chromium chromium-browser google-chrome chrome; do
  if command -v "$b" >/dev/null 2>&1; then BROWSER="$(command -v "$b")"; break; fi
done
[ -n "$BROWSER" ] || die "크로미움이 없습니다: sudo apt install chromium"
ok "브라우저: $BROWSER"

# 브리지는 없어도 게임은 돈다(키보드 모드). 없으면 알리기만 하고 넘어간다.
BRIDGE="$REPO/firmware/button_bridge/python/main.py"
BRIDGE_OK=0
if [ -f "$BRIDGE" ] && python3 -c 'import websockets' 2>/dev/null; then
  BRIDGE_OK=1
  ok "버튼 브리지 준비됨"
else
  warn "버튼 브리지를 못 씁니다 — pip3 install websockets pyserial 후 다시 실행하세요"
  warn "(그래도 게임은 설치됩니다. 키보드 1234 로는 플레이됩니다)"
fi

# systemd 사용자 인스턴스에 말을 걸 수 있는지 확인한다.
# SSH 로 붙었을 때 XDG_RUNTIME_DIR 이 안 잡혀 실패하는 일이 흔해서, 한 번 세워 보고
# 다시 시도한다. 그래도 안 되면 서비스 대신 데스크톱 자동시작으로 등록한다.
userctl_ok() { systemctl --user show-environment >/dev/null 2>&1; }

USERCTL=1
if ! userctl_ok; then
  export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
  export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=$XDG_RUNTIME_DIR/bus}"
  userctl_ok || USERCTL=0
fi

if [ "$USERCTL" -eq 1 ]; then
  ok "systemd 사용자 서비스 사용 가능"
  # 그래픽 세션 타깃이 있으면 키오스크도 서비스로, 없으면 데스크톱 자동시작으로.
  if systemctl --user list-unit-files --no-legend --no-pager 2>/dev/null \
      | grep -q '^graphical-session.target'; then
    KIOSK_MODE="service"
  else
    KIOSK_MODE="autostart"
  fi
else
  warn "systemd 사용자 인스턴스에 붙지 못했습니다"
  warn "→ 서비스 대신 데스크톱 자동시작(.desktop)으로 등록합니다"
  KIOSK_MODE="autostart-all"
fi
ok "등록 방식: $KIOSK_MODE"

# ------------------------------------------------------------------ 서비스 작성
head_ "2. 서비스 등록"
mkdir -p "$UNITS"

cat > "$UNITS/torus-web.service" <<EOF
[Unit]
Description=토러스 메모리 게임 — 정적 웹서버
After=network.target

[Service]
ExecStart=/usr/bin/env python3 -m http.server $PORT -d $REPO --bind 127.0.0.1
Restart=always
RestartSec=2

[Install]
WantedBy=default.target
EOF
ok "torus-web.service"

cat > "$UNITS/torus-bridge.service" <<EOF
[Unit]
Description=토러스 메모리 게임 — 버튼 브리지
After=torus-web.service

[Service]
# 보드가 켜질 때 /dev/ttyACM0 이 늦게 잡히는 일이 있어 항상 재시작하게 둔다.
ExecStart=/usr/bin/env python3 $BRIDGE --source serial --port /dev/ttyACM0
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF
ok "torus-bridge.service"

# 키오스크 플래그
#   --kiosk                     전체화면, 주소창 없음
#   --noerrdialogs 등           오류 팝업·복구 풍선 차단 (전시물에 뜨면 안 된다)
#   --autoplay-policy           첫 입력 전에도 효과음이 나게
#   --check-for-update-interval 업데이트 알림 억제
KIOSK_CMD="$BROWSER --kiosk --noerrdialogs --disable-infobars \
--disable-session-crashed-bubble --disable-features=Translate \
--autoplay-policy=no-user-gesture-required \
--check-for-update-interval=31536000 \
--disable-pinch --overscroll-history-navigation=0 \
http://localhost:$PORT/"

cat > "$UNITS/torus-kiosk.service" <<EOF
[Unit]
Description=토러스 메모리 게임 — 키오스크 브라우저
After=torus-web.service graphical-session.target
PartOf=graphical-session.target

[Service]
ExecStartPre=/usr/bin/env bash -c 'until curl -sf http://localhost:$PORT/ >/dev/null; do sleep 1; done'
ExecStart=$KIOSK_CMD
Restart=always
RestartSec=3

[Install]
WantedBy=graphical-session.target
EOF
ok "torus-kiosk.service"

# 데스크톱 자동시작 항목. autostart-all 이면 start-all.sh 하나가 세 조각을 다 띄운다.
write_desktop() {
  mkdir -p "$HOME/.config/autostart"
  cat > "$HOME/.config/autostart/torus-kiosk.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=토러스 메모리 게임
Exec=$1
X-GNOME-Autostart-enabled=true
EOF
  ok "자동시작 등록: ~/.config/autostart/torus-kiosk.desktop"
}

case "$KIOSK_MODE" in
  autostart)     write_desktop "$KIOSK_CMD" ;;
  autostart-all) write_desktop "/usr/bin/env bash $REPO/scripts/start-all.sh" ;;
esac

# ------------------------------------------------------------------ 켜기
head_ "3. 켜기"

if [ "$USERCTL" -eq 0 ]; then
  warn "systemd 서비스는 등록하지 못했습니다. 유닛 파일은 $UNITS 에 만들어 두었습니다."
  echo
  echo "  보드 화면 앞에서(SSH 말고) 터미널을 열어 아래를 실행하면 서비스로 전환됩니다:"
  echo "    bash $REPO/scripts/install-kiosk.sh"
  echo
  echo "  지금 바로 게임을 한 번 띄워 보려면:"
  echo "    bash $REPO/scripts/start-all.sh"
  echo
  echo "부팅 자동시작은 .desktop 으로 걸어 두었으니 재부팅하면 뜹니다."
  exit 0
fi

systemctl --user daemon-reload

systemctl --user enable --now torus-web && ok "torus-web 시작" \
  || warn "torus-web 시작 실패 — journalctl --user -u torus-web -n 30"

if [ "$BRIDGE_OK" -eq 1 ]; then
  systemctl --user enable --now torus-bridge && ok "torus-bridge 시작" \
    || warn "torus-bridge 시작 실패 — 시리얼 포트(/dev/ttyACM0)를 확인하세요"
else
  systemctl --user disable torus-bridge 2>/dev/null || true
  warn "torus-bridge 는 건너뜁니다 (websockets 설치 후 systemctl --user enable --now torus-bridge)"
fi

if [ "$KIOSK_MODE" = "service" ]; then
  systemctl --user enable torus-kiosk 2>/dev/null && ok "torus-kiosk 자동시작 등록" || \
    warn "torus-kiosk 자동시작 등록 실패 — 화면 세션이 없을 수 있습니다"
  systemctl --user start torus-kiosk 2>/dev/null || warn "지금은 화면이 없어 못 띄웠습니다 (재부팅 후 확인)"
fi

# 로그인 없이도 부팅 직후 웹서버·브리지가 뜨게
if loginctl enable-linger "${WHO}" 2>/dev/null; then
  ok "linger 켬 (로그인 없이도 부팅 시 실행)"
else
  warn "linger 를 못 켰습니다: sudo loginctl enable-linger ${WHO}"
fi

# ------------------------------------------------------------------ 절전 끄기
head_ "4. 화면 절전 끄기"
if command -v xset >/dev/null 2>&1 && [ -n "${DISPLAY:-}" ]; then
  xset s off -dpms 2>/dev/null && ok "X11 절전·블랭킹 껐습니다 (이번 세션)" || warn "xset 적용 실패"
else
  warn "xset 을 지금 적용하지 못했습니다 (X11 세션이 아니거나 미설치)"
fi
if command -v gsettings >/dev/null 2>&1; then
  gsettings set org.gnome.desktop.session idle-delay 0 2>/dev/null && ok "GNOME 자동 절전 껐습니다" || true
  gsettings set org.gnome.desktop.screensaver lock-enabled false 2>/dev/null || true
fi
warn "웨이랜드라면 컴포지터 설정에서 화면 끄기를 직접 해제해야 합니다"

show_status
cat <<'EOF'

다음 할 일
  1. 모스부호 앱이 아직 뜬다면:  bash scripts/survey.sh morse
  2. 스케치(버튼 읽기)는 App Lab 에서 firmware/button_bridge/sketch 를 올려야 합니다.
  3. 재부팅해서 타이틀 화면이 저절로 뜨는지 확인하세요.

문제가 생기면
  journalctl --user -u torus-kiosk -n 50 --no-pager
  journalctl --user -u torus-bridge -n 50 --no-pager
EOF
