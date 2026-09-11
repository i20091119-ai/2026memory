#!/usr/bin/env bash
#
# bridge-watch.sh — 버튼 브리지가 죽으면 스스로 되살린다.
#
#   bash scripts/bridge-watch.sh --install    # 감시 서비스 등록 (부팅 시 자동)
#   bash scripts/bridge-watch.sh --once       # 지금 상태만 진단 (아무것도 안 건드림)
#   bash scripts/bridge-watch.sh --restart    # 지금 한 번 되살리기
#   bash scripts/bridge-watch.sh --status     # 서비스 상태 + 최근 기록
#   bash scripts/bridge-watch.sh --pause      # 잠시 끄기 (손으로 디버깅할 때)
#   bash scripts/bridge-watch.sh --resume
#   bash scripts/bridge-watch.sh --uninstall
#
# 왜 필요한가
#   부스 운영 중 App Lab 앱(브리지)이 멈춘 일이 있었다. 게임은 멀쩡히 돌고
#   키보드도 먹지만 아케이드 버튼만 죽는다. 해설사가 알아챌 방법이 없고,
#   App Lab 은 멈춘 앱을 저절로 되살리지 않는다. 그래서 30초마다 8765 를
#   확인해서 닫혀 있으면 브리지를 다시 띄운다.
#
# 되살리는 방법을 찾는 순서
#   1. TORUS_BRIDGE_RESTART_CMD 환경변수 (있으면 그대로 실행 — 비상 탈출구)
#   2. 컨테이너 재시작 — App Lab 앱은 컨테이너로 돈다 (우노 Q)
#   3. torus-bridge.service 재시작 — USB 시리얼이 잡히는 보드
#   셋 다 없으면 기록만 남기고 조용히 계속 확인한다.
#
# 감시 자체가 문제를 만들면 안 되므로:
#   - 포트는 ss 로 "듣고 있는지"만 본다. 접속해 보면 브리지 로그가 더러워진다.
#   - 2회 연속 닫혀 있을 때만 손을 쓴다 (App Lab 이 스스로 재시작하는 중일 수 있다).
#   - 재시작 간격은 2분에서 시작해 실패하면 30분까지 늘린다 (무한 재시작 방지).
#   - 기록은 상태가 바뀔 때만 남긴다 (정상일 때는 한 줄도 안 쓴다).
#
# 'set -e' 는 일부러 쓰지 않는다. 감시자는 어떤 명령이 실패해도 죽으면 안 된다.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${TORUS_BRIDGE_PORT:-8765}"
LOG="${TORUS_WATCH_LOG:-$HOME/torus-bridge-watch.log}"
PAUSE_FLAG="$HOME/.torus-bridge-watch.pause"
UNIT="torus-bridge-watch"
UNITS="$HOME/.config/systemd/user"

INTERVAL="${TORUS_WATCH_INTERVAL:-30}"     # 확인 주기(초)
DEAD_STREAK="${TORUS_WATCH_STREAK:-2}"     # 몇 번 연속 닫혀 있으면 손을 쓸지
COOLDOWN_MIN="${TORUS_WATCH_COOLDOWN:-120}" # 재시작 최소 간격(초)
COOLDOWN_MAX=1800                           # 계속 실패하면 여기까지 늘린다
LOG_MAX=1000000                             # 1MB 넘으면 한 번 굴린다

# App Lab 이 만드는 컨테이너 이름에 들어가는 조각. 앱 이름을 바꿨으면 이것만 고친다.
CONTAINER_PAT="${TORUS_BRIDGE_CONTAINER:-button-bridge}"

ok()   { printf '  \033[1;32m✔\033[0m %s\n' "$*"; }
warn() { printf '  \033[1;33m!\033[0m %s\n' "$*"; }
head_() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }

rotate_log() {
  [ -f "$LOG" ] || return 0
  local sz
  sz="$(stat -c %s "$LOG" 2>/dev/null || echo 0)"
  [ "$sz" -gt "$LOG_MAX" ] && mv -f "$LOG" "$LOG.1"
  return 0
}

log() {
  rotate_log
  printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG"
}

# ------------------------------------------------------------------ 살았나 죽었나
#
# 접속이 아니라 "듣고 있는지"를 본다. 컨테이너가 멈추면 호스트의 8765 게시도
# 같이 사라지므로 이걸로 충분하다. ss 가 없는 환경에서만 실제 접속으로 넘어간다.
port_alive() {
  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | grep -qE ":${PORT}[[:space:]]"
    return $?
  fi
  (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null
  return $?
}

# ------------------------------------------------------------------ 되살리는 수단 찾기
RUNTIME=""      # 예: "docker" 또는 "sudo -n podman". 한 번 찾으면 기억한다.
RUNTIME_DONE=0

detect_runtime() {
  if [ "$RUNTIME_DONE" -eq 1 ]; then printf '%s' "$RUNTIME"; return 0; fi
  RUNTIME_DONE=1
  local base
  for base in docker podman; do
    command -v "$base" >/dev/null 2>&1 || continue
    # 그룹 권한이 있으면 그냥 되고, 없으면 sudo 로 한 번 더 본다.
    if "$base" ps >/dev/null 2>&1; then RUNTIME="$base"; break; fi
    if sudo -n "$base" ps >/dev/null 2>&1; then RUNTIME="sudo -n $base"; break; fi
  done
  printf '%s' "$RUNTIME"
}

find_container() {
  local rt; rt="$(detect_runtime)"
  [ -n "$rt" ] || return 1
  # shellcheck disable=SC2086  # rt 는 "sudo -n docker" 처럼 여러 단어일 수 있다
  $rt ps -a --format '{{.Names}}' 2>/dev/null | grep -i -- "$CONTAINER_PAT" | head -1
}

container_state() {
  local rt name; rt="$(detect_runtime)"; name="$1"
  [ -n "$rt" ] || return 1
  # shellcheck disable=SC2086
  $rt ps -a --filter "name=$name" --format '{{.Status}}' 2>/dev/null | head -1
}

has_bridge_service() {
  systemctl --user cat torus-bridge >/dev/null 2>&1
}

restart_bridge() {
  if [ -n "${TORUS_BRIDGE_RESTART_CMD:-}" ]; then
    log "되살리기: 지정된 명령 실행"
    # 새 세션으로 떼어낸다. 그러지 않으면 그 명령이 띄운 프로세스가 감시자의
    # 자식이 되어, 감시자가 재시작될 때 같이 죽는다.
    local runner=(bash -c)
    command -v setsid >/dev/null 2>&1 && runner=(setsid bash -c)
    "${runner[@]}" "$TORUS_BRIDGE_RESTART_CMD" >>"$LOG" 2>&1 && return 0
    log "지정된 명령이 실패했습니다"
    return 1
  fi

  local rt name
  rt="$(detect_runtime)"
  if [ -n "$rt" ]; then
    name="$(find_container 2>/dev/null || true)"
    if [ -n "$name" ]; then
      log "되살리기: 컨테이너 $name ($rt)"
      # shellcheck disable=SC2086
      $rt restart "$name" >>"$LOG" 2>&1 && return 0
      # shellcheck disable=SC2086
      $rt start "$name" >>"$LOG" 2>&1 && return 0
      log "컨테이너를 다시 띄우지 못했습니다"
    fi
  fi

  if has_bridge_service; then
    log "되살리기: torus-bridge.service"
    systemctl --user restart torus-bridge >>"$LOG" 2>&1 && return 0
    log "torus-bridge.service 재시작에 실패했습니다"
  fi

  return 1
}

# ------------------------------------------------------------------ 진단 (--once)
diagnose() {
  head_ "버튼 브리지 상태"

  if port_alive; then
    ok "8765 포트: 열려 있음 → 브리지 살아 있음"
  else
    warn "8765 포트: 닫혀 있음 → 브리지 죽음 (아케이드 버튼이 안 먹습니다)"
  fi

  local rt name st
  rt="$(detect_runtime)"
  if [ -n "$rt" ]; then
    ok "컨테이너 런타임: $rt"
    name="$(find_container 2>/dev/null || true)"
    if [ -n "$name" ]; then
      st="$(container_state "$name" 2>/dev/null || true)"
      ok "브리지 컨테이너: $name  [${st:-상태불명}]"
    else
      warn "'$CONTAINER_PAT' 이 들어간 컨테이너가 없습니다"
      warn "→ App Lab 앱을 한 번 Run 해야 컨테이너가 생깁니다"
    fi
  else
    warn "컨테이너 런타임에 접근하지 못했습니다 (docker/podman 없음 또는 권한 없음)"
  fi

  if has_bridge_service; then
    ok "torus-bridge.service: 있음 (시리얼 방식 보드)"
  fi

  if [ -n "${TORUS_BRIDGE_RESTART_CMD:-}" ]; then
    ok "지정된 되살리기 명령: $TORUS_BRIDGE_RESTART_CMD"
  fi

  head_ "감시 서비스"
  # is-enabled/is-active 는 값을 찍으면서 종료코드가 0이 아닐 수 있다.
  # '|| echo -' 를 붙이면 두 줄이 나오므로 첫 줄만 쓰고 비면 '-' 로 채운다.
  local en ac
  en="$(systemctl --user is-enabled "$UNIT" 2>/dev/null | head -1)"
  ac="$(systemctl --user is-active  "$UNIT" 2>/dev/null | head -1)"
  printf '  %-12s %s\n' "자동시작" "${en:--}"
  printf '  %-12s %s\n' "지금" "${ac:--}"
  [ -e "$PAUSE_FLAG" ] && warn "일시정지 상태입니다 (--resume 으로 해제)"

  if [ -f "$LOG" ]; then
    head_ "최근 기록 ($LOG)"
    tail -n 10 "$LOG" | sed 's/^/  /'
  fi
  echo
}

# ------------------------------------------------------------------ 설치 / 해제
install_unit() {
  head_ "브리지 감시 서비스 등록"

  # SSH 로 붙었을 때 사용자 systemd 에 말을 못 거는 일이 흔하다.
  if ! systemctl --user show-environment >/dev/null 2>&1; then
    export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
    export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=$XDG_RUNTIME_DIR/bus}"
  fi
  if ! systemctl --user show-environment >/dev/null 2>&1; then
    warn "systemd 사용자 인스턴스에 붙지 못해 등록하지 못했습니다"
    warn "보드 화면 앞에서 터미널을 열어 다시 실행하세요"
    return 1
  fi

  mkdir -p "$UNITS"
  cat > "$UNITS/$UNIT.service" <<EOF
[Unit]
Description=토러스 메모리 게임 — 버튼 브리지 감시
After=default.target

[Service]
ExecStart=/usr/bin/env bash $REPO/scripts/bridge-watch.sh
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
EOF
  ok "$UNIT.service"

  systemctl --user daemon-reload
  rm -f "$PAUSE_FLAG"
  if systemctl --user enable --now "$UNIT" 2>/dev/null; then
    ok "감시 시작 (${INTERVAL}초마다 확인)"
  else
    warn "감시 서비스를 시작하지 못했습니다 — systemctl --user status $UNIT"
    return 1
  fi

  # 지금 정말로 되살릴 수 있는 상태인지 여기서 확인해 둔다.
  # 새벽에 조용히 실패하는 것보다 설치할 때 알려주는 게 낫다.
  local rt name
  rt="$(detect_runtime)"
  name="$(find_container 2>/dev/null || true)"
  if [ -n "$rt" ] && [ -n "$name" ]; then
    ok "되살리기 수단 확인됨: $name ($rt)"
  elif has_bridge_service; then
    ok "되살리기 수단 확인됨: torus-bridge.service"
  else
    warn "지금은 되살릴 대상을 못 찾았습니다"
    warn "→ App Lab 에서 브리지 앱을 한 번 Run 하면 컨테이너가 생기고, 그 뒤로는 자동으로 찾습니다"
    warn "→ 확인: bash scripts/bridge-watch.sh --once"
  fi
  echo
  echo "기록: $LOG"
  echo "상태: bash scripts/bridge-watch.sh --status"
}

uninstall_unit() {
  head_ "브리지 감시 해제"
  systemctl --user disable --now "$UNIT" 2>/dev/null && ok "$UNIT 껐습니다" || true
  rm -f "$UNITS/$UNIT.service"
  systemctl --user daemon-reload 2>/dev/null || true
  ok "서비스 파일을 지웠습니다 (기록 $LOG 은 남겨 둡니다)"
}

# ------------------------------------------------------------------ 감시 루프
watch_loop() {
  log "감시 시작 — ${INTERVAL}초마다 8765 확인 (연속 ${DEAD_STREAK}회 닫히면 되살림)"

  local alive="unknown" streak=0 cooldown="$COOLDOWN_MIN" last_try=0 paused=0 nowsec

  while :; do
    if [ -e "$PAUSE_FLAG" ]; then
      if [ "$paused" -eq 0 ]; then log "일시정지 (--resume 으로 해제)"; paused=1; fi
      sleep "$INTERVAL"
      continue
    fi
    if [ "$paused" -eq 1 ]; then log "일시정지 해제"; paused=0; fi

    if port_alive; then
      # 정상일 때는 아무것도 남기지 않는다. 되살아난 순간만 기록한다.
      [ "$alive" = "0" ] && log "브리지 정상 복구됨 (8765 열림)"
      alive=1
      streak=0
      cooldown="$COOLDOWN_MIN"
    else
      streak=$((streak + 1))
      if [ "$alive" != "0" ]; then
        log "브리지 응답 없음 — 8765 가 닫혔습니다 (아케이드 버튼 먹지 않음)"
      fi
      alive=0

      if [ "$streak" -ge "$DEAD_STREAK" ]; then
        nowsec="$(date +%s)"
        if [ $((nowsec - last_try)) -ge "$cooldown" ]; then
          last_try="$nowsec"
          if restart_bridge; then
            log "되살리기 명령을 보냈습니다 — 다음 확인에서 결과를 봅니다"
            streak=0
          else
            log "되살릴 방법을 찾지 못했습니다 (App Lab 에서 직접 Run 이 필요합니다)"
          fi
          # 계속 죽으면 간격을 늘려 무한 재시작을 막는다. 정상으로 돌아오면 초기화된다.
          cooldown=$((cooldown * 2))
          [ "$cooldown" -gt "$COOLDOWN_MAX" ] && cooldown="$COOLDOWN_MAX"
        fi
      fi
    fi

    sleep "$INTERVAL"
  done
}

# ------------------------------------------------------------------ 진입점
case "${1:-}" in
  --install)   install_unit ;;
  --uninstall) uninstall_unit ;;
  --status)    diagnose ;;
  --once)      diagnose ;;
  --restart)
    if restart_bridge; then ok "되살리기 명령을 보냈습니다"; sleep 5
      if port_alive; then ok "8765 열렸습니다 — 버튼을 눌러 확인하세요"
      else warn "아직 8765 가 닫혀 있습니다. 몇 초 더 기다렸다가 --once 로 다시 보세요"; fi
    else
      warn "되살릴 방법을 찾지 못했습니다 — bash scripts/bridge-watch.sh --once"
      exit 1
    fi
    ;;
  --pause)     touch "$PAUSE_FLAG"; ok "감시를 일시정지했습니다" ;;
  --resume)    rm -f "$PAUSE_FLAG"; ok "감시를 다시 켰습니다" ;;
  "")          watch_loop ;;
  *)           sed -n '3,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
