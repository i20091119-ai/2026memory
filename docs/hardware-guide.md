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

## 2. 버튼 → 우노 Q 배선

| 버튼(좌→우) | 색 | 스위치 NO → | 스위치 COM → |
|---|---|---|---|
| 1 | 빨강 | D2 | GND (4개 데이지체인) |
| 2 | 노랑 | D3 | GND |
| 3 | 초록 | D4 | GND |
| 4 | 파랑 | D5 | GND |

- 마이크로스위치의 **COM/NO 단자**를 사용한다. **NC 사용 금지** (반대로 동작한다).
- 스페이드 단자로 무납땜 연결.
- 내부 풀업(`INPUT_PULLUP`)을 쓰므로 외부 저항이 필요 없다. 평상시 HIGH, 누르면 LOW.
- 우노 Q 헤더는 **3.3V 로직**이지만 단순 스위치 입력에는 영향이 없다.

버튼 인덱스 **0=빨강, 1=노랑, 2=초록, 3=파랑** 은 함체 왼쪽→오른쪽 순서와 같고,
펌웨어·웹앱 전체에서 이 순서를 절대 바꾸지 않는다.

---

## 3. 버튼 LED (상시 점등, 게임 제어 없음)

- LED 스펙 4~12V, **9V 이상 권장**.
- **12V 어댑터 → LED 4개 병렬** 연결. 극성(+/−) 주의.
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

### 5.1 버튼 브리지

App Lab 에서 `firmware/button_bridge` 앱을 배포하고 자동시작에 등록한다.
전송 방식(시리얼/Bridge RPC) 선택과 확인 절차는
[`../firmware/README.md`](../firmware/README.md) 를 따른다.

```bash
pip3 install websockets pyserial
```

### 5.2 웹앱 정적 서빙

```bash
git clone <이 저장소> ~/torus-memory-game
```

`~/.config/systemd/user/torus-web.service`

```ini
[Unit]
Description=Torus Memory Game (static web)
After=network.target

[Service]
ExecStart=/usr/bin/python3 -m http.server 8000 -d %h/torus-memory-game/web
Restart=always

[Install]
WantedBy=default.target
```

### 5.3 Chromium 키오스크

`~/.config/systemd/user/torus-kiosk.service`

```ini
[Unit]
Description=Torus Memory Game (kiosk browser)
After=torus-web.service

[Service]
ExecStart=/usr/bin/chromium --kiosk --noerrdialogs --disable-infobars \
          --disable-session-crashed-bubble --disable-features=Translate \
          --autoplay-policy=no-user-gesture-required \
          http://localhost:8000
Restart=always

[Install]
WantedBy=default.target
```

등록:

```bash
systemctl --user daemon-reload
systemctl --user enable --now torus-web torus-kiosk
loginctl enable-linger $USER     # 로그인 없이도 부팅 시 뜨게
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

부팅 → 자동으로 타이틀 화면이 뜨면 완료. 버튼을 눌러 동작을 확인한다.
화면 오른쪽 아래 점이 **초록**이면 브리지 연결 성공이다.

업데이트는 `git pull` 후 재부팅(또는 `systemctl --user restart torus-web torus-kiosk`).

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
