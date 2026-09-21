# 하드웨어 연결 가이드

실물 게임기(아두이노 우노 Q + 카멜 포터블 모니터 + 100파이 아케이드 버튼 4개)를
조립하고 소프트웨어를 올리는 절차. 설계명세서 §8 의 내용을 그대로 옮긴 것이다.

---

## 1. 구성품

| 항목 | 비고 |
|---|---|
| 아두이노 우노 Q | 전원 USB-C PD 5V/3A |
| 카멜 포터블 모니터 | 보조 모니터 |
| USB-C 허브 | **PD 패스스루 + DP Alt-Mode 지원 필수** |
| 100파이 아케이드 버튼 4개 | DM2878: 마이크로스위치 + LED(4~12V) |
| 12V 어댑터 | LED 상시 점등용 |
| 점퍼선 / 스페이드 단자 | 2.8mm |
| 아크릴 함체 | 별도 제작 완료 |

---

> 조립하면서 볼 그림은 **[`배선도.pdf`](배선도.pdf)** 에 있다. 인쇄해서 옆에 두면 편하다.
> (원본은 `docs/wiring.html` — 브라우저로 열어 인쇄하면 PDF 가 다시 나온다.)

## 2. 버튼 → 우노 Q 배선

| 버튼(좌→우) | 색 | 스위치 NO → | 스위치 COM → |
|---|---|---|---|
| 1 | 빨강 | D2 | GND (4개 데이지체인) |
| 2 | 노랑 | D3 | GND |
| 3 | 초록 | D4 | GND |
| 4 | 파랑 | D5 | GND |

- 마이크로스위치의 **COM/NO 단자**를 사용한다. **NC 사용 금지** (반대로 동작한다).
- 단자 연결은 **파스톤(평형) 암단자 압착** 또는 **납땜** 둘 중 하나. 어느 쪽이든 수축튜브로 절연한다.
  단자에 그냥 감아만 두면 버튼을 세게 치는 동안 헐거워져 간헐적 접촉 불량이 난다.
  납땜은 **3초 안에** 끝낸다 — 오래 지지면 스위치 내부가 녹아 접점이 틀어진다.
- 스위치 몸통에 **COM ① / NC ② / NO ③** 이 각인되어 있으므로 도통 확인 없이 글자만 보고 물리면 된다.
- 내부 풀업(`INPUT_PULLUP`)을 쓰므로 외부 저항이 필요 없다. 평상시 HIGH, 누르면 LOW.
- 우노 Q 헤더는 **3.3V 로직**이지만 단순 스위치 입력에는 영향이 없다.

버튼 인덱스 **0=빨강, 1=노랑, 2=초록, 3=파랑** 은 함체 왼쪽→오른쪽 순서와 같고,
펌웨어·웹앱 전체에서 이 순서를 절대 바꾸지 않는다.

---

## 3. 버튼 LED (상시 점등, 게임 제어 없음)

- LED 스펙 4~12V, **9V 이상 권장**.
- **12V 어댑터 → LED 4개 병렬** 연결. 극성(+/−) 주의.
- **저항 필요 여부**: 전압이 `4~12V` 처럼 범위로 적혀 있으면 저항 내장 모듈이라 12V 직결.
  맨 LED 알이면 저항 없이 물리는 순간 탄다. 판단이 안 서면 **LED 마다 470Ω 을 직렬로 하나씩**
  넣고 켜 본다 — 어느 쪽이든 안전하다. 충분히 밝으면 맨 LED였던 것이니 그대로 두고,
  많이 어두우면 저항 내장 모듈이니 저항을 빼고 직결로 바꾼다.
  공통 저항 하나로 4개를 묶지 않는다 (한 개로 전류가 몰린다). 정격은 1/2W 이상.
- 스위치 배선과 **완전히 별개 회로**다. 우노 Q 와 전기적으로 연결하지 않는다.
- 소프트웨어는 LED 를 전혀 제어하지 않는다 (설계 결정).

---

## 4. 모니터·전원 연결

```
콘센트 ── PD 어댑터(5V/3A 이상) ──┐
                                  USB-C 허브 ── USB-C ── 우노 Q
카멜 모니터 ◀── HDMI/USB-C ────────┘
```

- 우노 Q 는 USB-C 포트가 하나뿐이므로 **PD 패스스루 + 영상출력(DP Alt-Mode) 겸용 허브가 필수**다.
- 12V(LED)와 5V(우노 Q) 어댑터는 별개다. 함체 뒷면 노치(40×14mm)로 케이블을 뺀다.

**화면이 안 나올 때 점검 순서**

1. 허브가 DP Alt-Mode 를 지원하는가
2. 모니터 입력 소스가 맞는가
3. 우노 Q 의 출력 한계(HD+ 720×1680@60Hz)를 넘지 않는가

---

## 5. 소프트웨어 설치 (우노 Q)

보드 화면 앞에서 터미널을 열고 진행한다. **SSH 로만 붙으면 사용자 서비스 등록이
안 될 수 있다** (그 경우 스크립트가 알아서 데스크톱 자동시작으로 대신 걸고 알려 준다).

### 5.0 이미 켜져 있는 다른 앱 정리

전에 쓰던 앱(예: 모스부호)이 부팅과 함께 켜지고 있다면 먼저 그것부터 끈다.
**리눅스 자체의 상시 켜짐 설정은 건드리지 않는다** — 앱 하나만 뗀다.

먼저 무엇이 어떤 방식으로 켜지는지 확인한다. 이 명령은 아무것도 고치지 않는다.

```bash
bash scripts/survey.sh            # 부팅 시 켜지는 것 전부
bash scripts/survey.sh morse      # 이름으로 추려 보기
```

찾았으면 그 항목만 끈다. 지우지 않고 되돌릴 수 있게 막아 둔다.

```bash
bash scripts/disable-autostart.sh <서비스명 또는 .desktop 경로>
bash scripts/disable-autostart.sh --list      # 무엇을 껐는지
bash scripts/disable-autostart.sh --restore   # 전부 되돌리기
```

> **App Lab 으로 등록한 앱이면** systemd·crontab 이 아니라 App Lab 자체가 띄우므로
> 위 스크립트에 안 잡힌다. App Lab 화면에서 그 앱 카드의 **`⋯` 메뉴 → `Run at startup`
> 토글을 끄면** 된다 (같은 메뉴의 `Delete` 는 앱을 지운다 — 끄기만 할 거면 토글만 내린다).
> 지금 돌고 있다면 화면 아래 **`Stop`** 도 함께 누른다.
>
> 실제 사례: 이 보드의 모스부호 앱은 `~/mosbuho/booth-app/arduino` 에 있고
> App Lab 의 `Run at startup` 으로 켜지고 있었다.

스케치(STM32)는 앱 하나만 올라간다. 다음 절에서 버튼 브리지 스케치를 올리면
모스부호 스케치는 자연히 지워진다.

### 5.1 역할 분담 (우노 Q 실물에서 확인한 구성)

부팅 시 뜨는 것이 **두 군데로 나뉜다.** 우노 Q 는 STM32 가 내장이라 버튼을
읽으려면 App Lab 의 Bridge RPC 를 써야 하는데, 그 API 는 App Lab 런타임 안에서만
임포트되므로 systemd 로는 띄울 수 없다.

| 무엇 | 어디서 | 자동시작 |
|---|---|---|
| 스케치 + **버튼 브리지** (8765) | **App Lab 앱** | App Lab 카드 `⋯` → `Run at startup` |
| 웹서버 (8000) + **크로미움 키오스크** | systemd / `.desktop` | `install-kiosk.sh` |
| **브리지 감시** (죽으면 되살림) | systemd 사용자 서비스 | `install-kiosk.sh` |

App Lab 은 **멈춘 앱을 저절로 되살리지 않는다.** 실제로 운영 중에 브리지 앱이
멈춰 아케이드 버튼만 죽은 일이 있었다 — 게임은 멀쩡히 돌고 키보드도 먹으니
해설사가 알아챌 방법이 없었다. 그래서 `install-kiosk.sh` 가 감시 서비스를
같이 등록한다 (§5.8).

### 5.2 설치

```bash
git clone https://github.com/i20091119-ai/2026memory.git ~/torus-memory-game
cd ~/torus-memory-game
sudo apt install -y python3-websockets python3-serial
bash scripts/install-kiosk.sh
```

스크립트가 하는 일 — 몇 번을 돌려도 결과가 같다(멱등).

| | |
|---|---|
| `torus-web` | 정적 웹서버 (`python3 -m http.server 8000`, localhost 전용) |
| `torus-bridge` | 버튼 브리지. **USB 시리얼이 없으면 등록하지 않고** App Lab 으로 안내한다 |
| `torus-kiosk` | 크로미움 전체화면. 전용 프로필(`~/.torus-kiosk-profile`)을 쓴다 |
| `torus-bridge-watch` | 30초마다 8765 확인 → 죽어 있으면 브리지를 다시 띄운다 (§5.8) |
| linger | 로그인 없이도 부팅 시 뜨게 |
| 절전 | 화면 블랭킹·자동 잠금 해제 시도 |

키오스크를 서비스로 걸지 `.desktop` 자동시작으로 걸지는 `graphical-session.target`
이 **실제로 활성화되는 환경인지** 보고 정한다. XFCE 처럼 systemd 세션 연동이 없으면
서비스로 걸어도 영영 안 뜨므로 `.desktop` 으로 건다.
`TORUS_KIOSK_MODE=service|autostart` 로 직접 지정할 수도 있다.

> **크로미움 프로필을 갈라 쓰는 이유**: 공용 프로필을 쓰면 예전에 이 기계에서
> 돌던 다른 키오스크의 "이전 세션 복원"이 살아나 그 페이지가 대신 뜬다.
> 실제로 이 보드에서 겪은 문제다.

확인·해제:

```bash
bash scripts/install-kiosk.sh --status      # 지금 상태
bash scripts/install-kiosk.sh --uninstall   # 자동시작 해제 (게임 파일은 남는다)
```

서비스를 안 쓰고 지금 한 번만 띄워 보려면:

```bash
bash scripts/start-all.sh              # 웹서버+브리지+전체화면 한 번에
bash scripts/start-all.sh --windowed   # 창 모드 (디버깅)
```

### 5.3 스케치 올리기

버튼을 읽는 쪽은 App Lab 으로 올려야 한다. `firmware/button_bridge/sketch` 를
App Lab 에서 열어 우노 Q 에 업로드한다. 전송 방식(시리얼/Bridge RPC) 선택과
확인 절차는 [`../firmware/README.md`](../firmware/README.md) 참조.

올린 뒤 확인:

```bash
python3 firmware/button_bridge/python/main.py -v   # 버튼을 누르면 로그가 뜬다
```

### 5.4 업데이트

```bash
cd ~/torus-memory-game && git pull
systemctl --user restart torus-web torus-kiosk
```

### 5.5 장시간 구동 설정 (필수)

전시·상시 운영이므로 아래를 반드시 적용한다.

- **화면 절전·블랭킹 끄기**
  - X11: `xset s off -dpms` (자동시작 스크립트에 추가)
  - Wayland: 컴포지터의 idle/blank 설정에서 해제
  - 웹앱도 Screen Wake Lock API 로 한 번 더 막지만, OS 설정이 우선이다.
- **마우스 커서 숨김**: 웹앱이 CSS `cursor:none` 을 이미 적용한다. 데스크톱 커서까지 지우려면 `unclutter -idle 0` 을 병용한다.
- **팝업 차단**: 위 서비스의 `--noerrdialogs --disable-session-crashed-bubble` 플래그가 담당한다.
- **자동 업데이트 알림 끄기**: 배포판의 업데이트 알림 데몬을 비활성화한다.

### 5.6 스피커 (앱코 SLP20 기준, 실물에서 확인한 절차)

연결: **USB(전원) → 허브**, **3.5mm(소리) → 허브의 오디오 잭**.
뒷면 다이얼이 볼륨 겸 전원이다 — 끝까지 감겨 있으면 완전 무음이니 먼저 반쯤 연다.

```bash
wpctl status
```

`Sinks:` 에서 허브 오디오(예: **CS201 Analog Stereo**)에 `*` 가 붙어 있는지 확인.
안 붙어 있으면 그 번호로 지정한다:

```bash
wpctl set-default 번호
wpctl set-volume @DEFAULT_AUDIO_SINK@ 0.85
```

**여기까지 해도 소리가 없으면 카드 내부 음소거다** — 실물 1대가 정확히 이랬다:

```bash
alsamixer
```

1. `F6` → **CS201** 선택
2. 아래에 `MM` 표시된 채널로 이동해 **`M` 키** → `OO`(해제)
3. `↑` 로 볼륨 80쯤 → `Esc`
4. 설정이 재부팅 후에도 유지되게 저장: `sudo alsactl store`

확인:

```bash
speaker-test -t wav -c 2     # "front left / right" 음성. Ctrl+C 로 종료
```

> 이 보드에는 `pactl` 이 없다 — PipeWire 라서 `wpctl` 을 쓴다.
> 게임 효과음은 **첫 버튼 입력 후부터** 난다 (브라우저 정책, 정상).

원인 찾기 사다리 (위에서부터):
1. 스피커 뒷면 다이얼이 열려 있나 (전원 겸용)
2. 볼륨 최대에서 **"쉬—" 잡음**이 나나 → 안 나면 USB 전원 문제 (다른 포트/충전기)
3. 잡음은 나는데 테스트음이 안 들리면 → 위의 `alsamixer` 음소거 해제
4. 그래도 안 되면 → 3.5mm 를 모니터 이어폰 잭으로 옮기고 출력을 그쪽 sink 로

### 5.7 확인

재부팅 → 자동으로 타이틀 화면이 뜨면 완료. 버튼을 눌러 동작을 확인한다.
화면 **왼쪽 위 점**이 **초록**이면 브리지 연결 성공이다. 끊겨 있으면 점이 빨갛게
바뀌고 **"버튼 미연결"** 글자가 뜬다(이때도 키보드 1234 로는 플레이된다).

점을 못 찾겠으면 이 한 줄이 브리지·컨테이너·감시 상태를 한꺼번에 보여 준다:

```bash
bash scripts/bridge-watch.sh --once
```

```bash
bash scripts/install-kiosk.sh --status
journalctl --user -u torus-kiosk -n 50 --no-pager     # 화면이 안 뜰 때
journalctl --user -u torus-bridge -n 50 --no-pager    # 버튼이 안 먹을 때
```

### 5.8 브리지 감시 (버튼이 조용히 죽는 것을 막는다)

부스 운영 중에 겪은 고장이다. **게임은 멀쩡하고 키보드도 먹는데 아케이드
버튼만 안 먹었다.** 원인은 App Lab 의 브리지 앱이 멈춘 것이었고, App Lab 은
멈춘 앱을 되살리지 않는다. 화면에 표시도 없어서 체험객이 버튼을 눌러 보고서야
알 수 있었다.

두 가지로 막는다.

1. **화면 표시** — 키오스크에서 브리지가 끊기면 왼쪽 위 점이 **빨갛게** 바뀌고
   **"버튼 미연결"** 글자가 뜬다. 해설사가 화면만 보고 안다.
2. **자동 복구** — `torus-bridge-watch` 가 30초마다 8765 를 확인해서, 닫혀
   있으면 브리지를 다시 띄운다. 실제로 3초 안에 복구된다.

```bash
bash scripts/bridge-watch.sh --once       # 진단만 (아무것도 안 건드림)
bash scripts/bridge-watch.sh --restart    # 지금 당장 되살리기
bash scripts/bridge-watch.sh --status     # 감시 상태 + 최근 기록
bash scripts/bridge-watch.sh --pause      # 손으로 디버깅할 때 잠시 끄기
bash scripts/bridge-watch.sh --resume
cat ~/torus-bridge-watch.log              # 죽은 시각·복구 시각 기록
```

되살리는 방법은 알아서 찾는다 — ① `TORUS_BRIDGE_RESTART_CMD` 환경변수(비상
탈출구) → ② **App Lab 앱 컨테이너 재시작**(우노 Q. `docker`/`podman` 을 그냥,
안 되면 `sudo -n` 으로 시도한다) → ③ `torus-bridge.service` 재시작(USB 시리얼이
잡히는 보드). App Lab 앱 이름을 바꿨으면 `TORUS_BRIDGE_CONTAINER` 로
컨테이너 이름 조각을 알려 주면 된다 (기본 `button-bridge`).

감시가 문제를 만들지 않도록 이렇게 짰다.

- 포트는 `ss` 로 **듣고 있는지만** 본다. 접속해 보면 브리지 로그가 더러워진다.
- **2회 연속** 닫혀 있을 때만 손을 쓴다 (App Lab 이 스스로 재시작하는 중일 수 있다).
- 재시작 간격은 2분에서 시작해 계속 실패하면 30분까지 늘린다 (무한 재시작 방지).
- **정상일 때는 기록을 한 줄도 남기지 않는다.** 상태가 바뀔 때만 쓴다.

> 감시 로그는 원인 추적용이기도 하다. "죽은 시각"이 남으므로
> `journalctl -k | grep -i oom` 같은 것과 맞춰 보면 왜 죽었는지 좁힐 수 있다.

### 5.9 운영 기록 꺼내기 (월별 실적)

게임이 판마다 한 줄씩 기록을 남긴다 (개인정보 없음, 기기 안에만 저장).
**타이틀 화면에서 노랑 + 초록을 3초** 누르면 집계 화면이 뜬다 —
플레이 판 수, 완주율, 게임별 인기, 몇 개 기억에서 탈락하는지, 시간대별 분포.

| 버튼 | |
|---|---|
| 노랑 | 기간 바꾸기 (이번 달 → 지난 달 → 오늘 → 전체) |
| 초록 | CSV 저장 → `~/Downloads/torus-log-2026-09.csv` |
| 파랑 두 번 | 기록 지우기 |
| 빨강 | 닫기 |

월별 보고에는 화면을 **사진으로 찍는 것**으로 충분하게 만들어 두었다.
CSV 가 필요하면 초록을 누른 뒤 SSH 로 가져온다:

```bash
scp arduino@<보드주소>:~/Downloads/torus-log-*.csv .
```

기록은 크로미움 전용 프로필(`~/.torus-kiosk-profile`) 안의 localStorage 에
있다. 프로필 폴더를 지우면 기록도 사라지므로, 지우기 전에 CSV 부터 뽑는다.

---

## 6. 문제 해결

| 증상 | 확인할 것 |
|---|---|
| 버튼을 눌러도 반응 없음 | `bash scripts/bridge-watch.sh --once` 한 줄로 갈린다. **8765 닫힘** → 브리지가 죽은 것 (`--restart` 또는 App Lab 에서 Run) / **8765 열림** → 배선이다. 4개가 동시에 죽었으면 **GND 데이지체인**이 1순위 |
| 버튼이 계속 눌린 상태로 인식 | 스위치 NC 단자에 물렸는지 확인 (COM/NO 를 써야 한다) |
| 특정 버튼만 안 됨 | 해당 핀(D2~D5) 점퍼선과 GND 데이지체인 접점 |
| 잘 쓰다가 버튼이 조용히 죽음 | App Lab 앱이 멈춘 것이다. `cat ~/torus-bridge-watch.log` 로 죽은 시각을 확인하고 §5.8 의 감시가 등록돼 있는지 본다 (`bridge-watch.sh --status`) |
| 소리가 안 남 | §5.6 스피커 절차. 첫 버튼 입력 후부터 나는 것은 정상(브라우저 정책). 다이얼(전원 겸용) → 잡음 여부 → `alsamixer` 음소거 순으로 확인 |
| 화면이 꺼짐 | §5.4 의 절전·블랭킹 설정 |
| LED 안 켜짐 | 12V 어댑터 극성과 병렬 결선 (우노 Q 와 무관한 회로) |
| 예전 앱이 계속 뜸 | `bash scripts/survey.sh` 로 어디에 걸렸는지 확인 → §5.0. systemd·crontab 에 없으면 App Lab 쪽 설정이다 |
| 부팅해도 게임이 안 뜸 | `bash scripts/install-kiosk.sh --status`. 서비스가 `enabled` 인지, linger 가 `yes` 인지 확인 |
| SSH 로 설치했더니 서비스 등록 실패 | 보드 화면 앞 터미널에서 다시 `install-kiosk.sh` 실행. 급하면 `start-all.sh` 로 즉시 구동 |
| 껐던 앱을 되살리고 싶음 | `bash scripts/disable-autostart.sh --restore` |
