#!/usr/bin/env bash
#
# survey.sh — 이 보드에서 "부팅할 때 저절로 켜지는 것"을 전부 훑어 보여 준다.
#
# 아무것도 고치지 않는다. 읽기만 한다.
#
# 리눅스에서 프로그램이 저절로 켜지는 길은 여러 갈래라, 모스부호 앱이 어느 길로
# 켜지는지 모르면 엉뚱한 것을 지우게 된다. 먼저 이걸 돌려서 어디에 걸려 있는지
# 확인하고, disable-autostart.sh 로 그 항목만 정확히 끈다.
#
#   bash scripts/survey.sh              # 전부 보기
#   bash scripts/survey.sh morse        # 이름에 'morse' 가 든 것만 추려 보기
#
set -uo pipefail

NEEDLE="${1:-}"
FOUND=0
# 서비스로 실행될 때는 $USER 가 비어 있을 수 있다
WHO="${USER:-$(id -un)}"

c_head() { printf '\n\033[1;36m== %s\033[0m\n' "$1"; }
c_hit()  { printf '  \033[1;33m%s\033[0m\n' "$1"; FOUND=1; }
c_dim()  { printf '  \033[2m%s\033[0m\n' "$1"; }

# 필터가 있으면 그 줄만, 없으면 전부 보여 준다.
show() {
  local line
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    if [ -z "$NEEDLE" ]; then
      c_dim "$line"
    elif printf '%s' "$line" | grep -qi -- "$NEEDLE"; then
      c_hit "$line"
    fi
  done
}

echo "부팅 시 자동 실행되는 것들을 훑습니다."
[ -n "$NEEDLE" ] && echo "필터: '$NEEDLE' (노란 줄이 걸린 항목)"

c_head "1. systemd 시스템 서비스 (enabled)"
systemctl list-unit-files --state=enabled --no-legend --no-pager 2>/dev/null \
  | awk '{print $1}' | show

c_head "2. systemd 사용자 서비스 (enabled)"
systemctl --user list-unit-files --state=enabled --no-legend --no-pager 2>/dev/null \
  | awk '{print $1}' | show

c_head "3. 지금 돌고 있는 서비스"
{ systemctl list-units --type=service --state=running --no-legend --no-pager 2>/dev/null
  systemctl --user list-units --type=service --state=running --no-legend --no-pager 2>/dev/null
} | awk '{print $1}' | show

c_head "4. 데스크톱 자동시작 (.desktop)"
for d in "$HOME/.config/autostart" /etc/xdg/autostart; do
  [ -d "$d" ] || continue
  find "$d" -maxdepth 1 -name '*.desktop' 2>/dev/null | show
done

c_head "5. crontab @reboot"
{ crontab -l 2>/dev/null | grep -i '@reboot' || true
  sudo -n crontab -l 2>/dev/null | grep -i '@reboot' || true
} | show

c_head "6. rc.local / 프로필 스크립트"
for f in /etc/rc.local "$HOME/.xsessionrc" "$HOME/.xinitrc" "$HOME/.profile" "$HOME/.bash_profile"; do
  [ -f "$f" ] || continue
  grep -nIv '^[[:space:]]*\(#\|$\)' "$f" 2>/dev/null | sed "s|^|$f:|" | show
done

c_head "7. Arduino App Lab 앱"
# App Lab 은 버전마다 앱을 두는 위치가 달라서 흔한 자리를 모두 훑는다.
for d in "$HOME/ArduinoApps" "$HOME/Arduino/apps" "$HOME/.arduino-app-lab" \
         /opt/arduino /var/lib/arduino /usr/share/arduino-app-lab; do
  [ -d "$d" ] || continue
  echo "[디렉터리] $d" | show
  find "$d" -maxdepth 2 -mindepth 1 \( -type d -o -name '*.yaml' -o -name '*.yml' \) 2>/dev/null | show
done
{ systemctl list-unit-files --no-legend --no-pager 2>/dev/null | awk '{print $1}' | grep -i arduino || true
  systemctl --user list-unit-files --no-legend --no-pager 2>/dev/null | awk '{print $1}' | grep -i arduino || true
} | show

c_head "8. 화면·세션 상태 (키오스크가 뜰 수 있는 환경인지)"
c_dim "세션 종류 : ${XDG_SESSION_TYPE:-(모름)}"
c_dim "DISPLAY   : ${DISPLAY:-(없음)}"
c_dim "WAYLAND   : ${WAYLAND_DISPLAY:-(없음)}"
c_dim "그래픽 타깃: $(systemctl get-default 2>/dev/null || echo '(모름)')"
c_dim "linger    : $(loginctl show-user "${WHO}" -p Linger --value 2>/dev/null || echo '(모름)')"
for b in chromium chromium-browser google-chrome chrome; do
  command -v "$b" >/dev/null 2>&1 && c_dim "브라우저   : $(command -v "$b")"
done

echo
if [ -n "$NEEDLE" ] && [ "$FOUND" -eq 0 ]; then
  echo "'$NEEDLE' 로는 아무것도 안 걸렸습니다."
  echo "App Lab UI 에서 켜지는 앱일 수 있습니다 — 필터 없이 다시 돌려 7번 항목을 보세요."
else
  echo "끄고 싶은 항목을 찾았으면:"
  echo "  bash scripts/disable-autostart.sh <서비스명 또는 .desktop 경로>"
  echo "되돌리려면:"
  echo "  bash scripts/disable-autostart.sh --restore"
fi
