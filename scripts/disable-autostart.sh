#!/usr/bin/env bash
#
# disable-autostart.sh — 부팅 시 저절로 켜지는 항목 하나를 끈다. 되돌릴 수 있게.
#
# 지우지 않는다. systemd 는 disable, .desktop 은 Hidden=true 한 줄 추가,
# crontab 은 주석 처리로 막는다. 무엇을 어떻게 건드렸는지 저널에 적어 두므로
# --restore 로 전부 원래대로 돌릴 수 있다.
#
#   bash scripts/disable-autostart.sh morse-code.service
#   bash scripts/disable-autostart.sh ~/.config/autostart/morse.desktop
#   bash scripts/disable-autostart.sh --list        # 저널 보기
#   bash scripts/disable-autostart.sh --restore     # 전부 되돌리기
#
# 무엇을 껐는지 모르겠으면 먼저: bash scripts/survey.sh morse
#
set -uo pipefail

JOURNAL="$HOME/.torus-autostart-journal"
say()  { printf '  %s\n' "$*"; }
ok()   { printf '  \033[1;32m✔\033[0m %s\n' "$*"; }
warn() { printf '  \033[1;33m!\033[0m %s\n' "$*"; }
note() { printf '%s\n' "$*" >> "$JOURNAL"; }

# ------------------------------------------------------------------ 저널 보기
if [ "${1:-}" = "--list" ]; then
  if [ -s "$JOURNAL" ]; then cat "$JOURNAL"; else echo "끈 항목이 없습니다."; fi
  exit 0
fi

# ------------------------------------------------------------------ 되돌리기
if [ "${1:-}" = "--restore" ]; then
  [ -s "$JOURNAL" ] || { echo "되돌릴 항목이 없습니다."; exit 0; }
  echo "저널에 적힌 항목을 되돌립니다."
  # 나중에 한 것부터 되돌린다
  tac "$JOURNAL" | while IFS='|' read -r kind target extra; do
    case "$kind" in
      user-unit)   systemctl --user enable "$target" 2>/dev/null && ok "사용자 서비스 복구: $target" ;;
      sys-unit)    sudo systemctl enable "$target" 2>/dev/null && ok "시스템 서비스 복구: $target" ;;
      desktop)     [ -f "$extra" ] && mv -f "$extra" "$target" && ok "자동시작 복구: $target" ;;
      crontab)     [ -f "$extra" ] && crontab "$extra" && ok "crontab 복구 (백업: $extra)" ;;
      *)           warn "알 수 없는 저널 항목: $kind|$target" ;;
    esac
  done
  mv -f "$JOURNAL" "$JOURNAL.done.$(date +%Y%m%d%H%M%S)"
  echo
  echo "되돌렸습니다. 반영은 재부팅 후입니다."
  exit 0
fi

# ------------------------------------------------------------------ 끄기
TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  echo "사용법: bash scripts/disable-autostart.sh <서비스명 | .desktop 경로>"
  echo "        bash scripts/disable-autostart.sh --list | --restore"
  echo
  echo "무엇을 꺼야 할지 모르겠으면: bash scripts/survey.sh morse"
  exit 2
fi

echo "끄려는 대상: $TARGET"
DID=0

# 1) .desktop 파일이면 — 지우지 않고 옆으로 치운다
if [ -f "$TARGET" ] && [ "${TARGET##*.}" = "desktop" ]; then
  BAK="$TARGET.torus-disabled"
  mv -f "$TARGET" "$BAK"
  note "desktop|$TARGET|$BAK"
  ok "자동시작에서 뺐습니다 (파일은 $BAK 로 보관)"
  DID=1
fi

# 2) systemd 사용자 서비스
UNIT="$TARGET"
case "$UNIT" in *.service|*.timer|*.target) ;; *) UNIT="$TARGET.service" ;; esac

if systemctl --user list-unit-files --no-legend --no-pager 2>/dev/null | grep -q "^$UNIT"; then
  systemctl --user stop "$UNIT" 2>/dev/null
  if systemctl --user disable "$UNIT" 2>/dev/null; then
    note "user-unit|$UNIT|"
    ok "사용자 서비스를 껐습니다: $UNIT"
    DID=1
  fi
fi

# 3) systemd 시스템 서비스 (sudo 필요)
if systemctl list-unit-files --no-legend --no-pager 2>/dev/null | grep -q "^$UNIT"; then
  if sudo -n true 2>/dev/null || sudo true; then
    sudo systemctl stop "$UNIT" 2>/dev/null
    if sudo systemctl disable "$UNIT" 2>/dev/null; then
      note "sys-unit|$UNIT|"
      ok "시스템 서비스를 껐습니다: $UNIT"
      DID=1
    fi
  else
    warn "시스템 서비스라 sudo 가 필요합니다: sudo systemctl disable $UNIT"
  fi
fi

# 4) crontab @reboot 줄 — 통째로 백업하고 해당 줄만 주석 처리
if crontab -l 2>/dev/null | grep -qi -- "$TARGET"; then
  BAK="$HOME/.torus-crontab-backup.$(date +%Y%m%d%H%M%S)"
  crontab -l > "$BAK"
  crontab -l | sed "s|^\([^#].*$TARGET.*\)$|# [torus 로 비활성화] \1|" | crontab -
  note "crontab||$BAK"
  ok "crontab 에서 주석 처리했습니다 (원본 백업: $BAK)"
  DID=1
fi

echo
if [ "$DID" -eq 1 ]; then
  echo "끝났습니다. 재부팅해서 더 이상 안 뜨는지 확인하세요."
  echo "되돌리려면: bash scripts/disable-autostart.sh --restore"
else
  warn "'$TARGET' 에 해당하는 자동시작 항목을 찾지 못했습니다."
  echo
  echo "App Lab 으로 등록한 앱은 systemd·crontab 이 아니라 App Lab 자체가 띄웁니다."
  echo "그런 경우엔 App Lab 화면에서 그 앱의 '부팅 시 실행'을 끄는 것이 정답입니다."
  echo "전체 목록을 다시 보려면: bash scripts/survey.sh"
  exit 1
fi
