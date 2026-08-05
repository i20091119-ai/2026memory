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

> **App Lab 으로 등록한 앱이면** systemd·crontab 이 아니라 App Lab 자체가 띄운다.
> 이때는 위 스크립트에 안 잡히므로 **App Lab 화면에서 그 앱의 "부팅 시 실행"을
> 끄는 것이 정답**이다. `survey.sh` 의 7번 항목에 App Lab 앱 디렉터리가 나온다.

스케치(STM32)는 앱 하나만 올라간다. 다음 절에서 버튼 브리지 스케치를 올리면
모스부호 스케치는 자연히 지워진다.

### 5.1 설치

```bash
git clone https://github.com/i20091119-ai/2026memory.git ~/torus-memory-game
cd ~/torus-memory-game
pip3 install websockets pyserial      # 버튼 브리지용
bash scripts/install-kiosk.sh
```

스크립트가 하는 일 — 몇 번을 돌려도 결과가 같다(멱등).

| | |
|---|---|
| `torus-web` | 정적 웹서버 (`python3 -m http.server 8000`, localhost 전용) |
| `torus-bridge` | 버튼 → WebSocket 브리지 |
| `torus-kiosk` | 크로미움 전체화면 |
| linger | 로그인 없이도 부팅 시 뜨게 |
| 절전 | 화면 블랭킹·자동 잠금 해제 시도 |

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

### 5.2 스케치 올리기

버튼을 읽는 쪽은 App Lab 으로 올려야 한다. `firmware/button_bridge/sketch` 를
App Lab 에서 열어 우노 Q 에 업로드한다. 전송 방식(시리얼/Bridge RPC) 선택과
확인 절차는 [`../firmware/README.md`](../firmware/README.md) 참조.

올린 뒤 확인:

```bash
python3 firmware/button_bridge/python/main.py -v   # 버튼을 누르면 로그가 뜬다
```

### 5.3 업데이트

```bash
cd ~/torus-memory-game && git pull
systemctl --user restart torus-web torus-kiosk
```

### 5.4 장시간 구동 설정 (필수)

전시·상시 운영이므로 아래를 반드시 적용한다.

- **화면 절전·블랭킹 끄기**
  - X11: `xset s off -dpms` (자동시작 스크립트에 추가)
  - Wayland: 컴포지터의 idle/blank 설정에서 해제
  - 웹앱도 Screen Wake Lock API 로 한 번 더 막지만, OS 설정이 우선이다.
- **마우스 커서 숨김**: 웹앱이 CSS `cursor:none` 을 이미 적용한다. 데스크톱 커서까지 지우려면 `unclutter -idle 0` 을 병용한다.
- **팝업 차단**: 위 서비스의 `--noerrdialogs --disable-session-crashed-bubble` 플래그가 담당한다.
- **자동 업데이트 알림 끄기**: 배포판의 업데이트 알림 데몬을 비활성화한다.

### 5.5 확인

재부팅 → 자동으로 타이틀 화면이 뜨면 완료. 버튼을 눌러 동작을 확인한다.
화면 오른쪽 아래 점이 **초록**이면 브리지 연결 성공이다(회색이면 미연결 —
이때도 키보드 1234 로는 플레이된다).

```bash
bash scripts/install-kiosk.sh --status
journalctl --user -u torus-kiosk -n 50 --no-pager     # 화면이 안 뜰 때
journalctl --user -u torus-bridge -n 50 --no-pager    # 버튼이 안 먹을 때
```

---

## 6. 문제 해결

| 증상 | 확인할 것 |
|---|---|
| 버튼을 눌러도 반응 없음 | 우측 하단 점이 회색이면 브리지 미연결 → `firmware/README.md` 의 배선 확인 절차 |
| 버튼이 계속 눌린 상태로 인식 | 스위치 NC 단자에 물렸는지 확인 (COM/NO 를 써야 한다) |
| 특정 버튼만 안 됨 | 해당 핀(D2~D5) 점퍼선과 GND 데이지체인 접점 |
| 소리가 안 남 | 브라우저 자동재생 정책 — 첫 버튼 입력 후부터 소리가 난다(정상). 계속 안 나면 키오스크 플래그의 `--autoplay-policy` 확인 |
| 화면이 꺼짐 | §5.4 의 절전·블랭킹 설정 |
| LED 안 켜짐 | 12V 어댑터 극성과 병렬 결선 (우노 Q 와 무관한 회로) |
| 예전 앱이 계속 뜸 | `bash scripts/survey.sh` 로 어디에 걸렸는지 확인 → §5.0. systemd·crontab 에 없으면 App Lab 쪽 설정이다 |
| 부팅해도 게임이 안 뜸 | `bash scripts/install-kiosk.sh --status`. 서비스가 `enabled` 인지, linger 가 `yes` 인지 확인 |
| SSH 로 설치했더니 서비스 등록 실패 | 보드 화면 앞 터미널에서 다시 `install-kiosk.sh` 실행. 급하면 `start-all.sh` 로 즉시 구동 |
| 껐던 앱을 되살리고 싶음 | `bash scripts/disable-autostart.sh --restore` |
