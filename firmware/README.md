# firmware/button_bridge — 아케이드 버튼 브리지

아케이드 버튼 4개의 눌림/뗌을 웹앱까지 나르는 두 조각.

```
버튼 4개 ──(D2~D5)──▶ sketch.ino (STM32)
                          │  시리얼 또는 Bridge RPC
                          ▼
                       main.py (리눅스)
                          │  WebSocket ws://localhost:8765
                          ▼
                       웹앱 (저장소 루트)
```

## 전송 방식 두 가지

우노 Q 는 App Lab 의 **Bridge RPC** 로 스케치와 파이썬을 잇는 것이 정석이지만,
App Lab 버전에 따라 헤더 이름·임포트 경로·콜백 등록 API 가 달라진다.
그래서 이 저장소는 **어디서나 확실히 동작하는 시리얼 방식을 기본값**으로 두고,
Bridge 방식을 선택지로 함께 넣어 두었다. 웹소켓 메시지 형식은 둘 다 똑같으므로
어느 쪽을 쓰든 웹앱은 손댈 필요가 없다.

| | 스케치 | 파이썬 | 비고 |
|---|---|---|---|
| 시리얼 (기본) | `#define USE_BRIDGE 0` | `--source serial` | 어느 보드에서나 동작, 디버깅 쉬움 |
| Bridge RPC | `#define USE_BRIDGE 1` | `--source bridge` | App Lab 정석. 아래 확인 절차 필요 |

### Bridge 방식을 쓰려면

App Lab 의 API 이름이 버전마다 다르므로, 켜기 전에 두 곳만 확인하면 된다.

1. App Lab 에서 **Bridge 예제**를 연다.
2. 스케치 쪽: 예제의 `#include` 줄과 통지 함수 이름을 확인해
   `sketch/sketch.ino` 의 `report()` 안 `Bridge.notify(...)` 를 맞춘다.
3. 파이썬 쪽: 예제의 임포트 경로와 콜백 등록 방식을 확인해
   `python/main.py` 의 `run_bridge()` 함수를 맞춘다.

`run_bridge()` 외의 코드(웹소켓 서버, 메시지 형식, 브로드캐스트)는 그대로 쓸 수 있다.

## 프로토콜

브리지 → 웹앱 (설계명세서 §5.2):

```json
{ "type": "hello",  "source": "unoq" }
{ "type": "button", "id": 0, "state": "down" }
{ "type": "button", "id": 0, "state": "up"   }
```

- `id` 는 **0=빨강, 1=노랑, 2=초록, 3=파랑** (함체 왼쪽→오른쪽). 이 순서는 전 코드베이스에서 고정이다.
- **눌림·뗌을 모두 보내야 한다.** 웹앱의 "빨강+파랑 2초 홀드 → 타이틀 복귀" 콤보가 뗌 이벤트에 의존한다.

시리얼 방식의 스케치 출력 형식은 사람이 읽을 수 있는 한 줄이다:

```
B0 D    ← 0번(빨강) 눌림
B3 U    ← 3번(파랑) 뗌
```

## 스케치 올리기 (App Lab)

`firmware/button_bridge` 자체가 App Lab 앱 폴더다 (`app.yaml` + `sketch/` + `python/`).
보드 설정은 `sketch/sketch.yaml` 에 있다 — FQBN 은 **`arduino:zephyr:unoq`**.

App Lab 이 이 폴더를 목록에 안 띄우면, **이미 등록된 앱을 Duplicate 해서**
그 폴더의 `sketch/sketch.ino` 만 이 저장소 것으로 덮어쓰는 방법이 확실하다.
App Lab 이 만든 앱 폴더는 이렇게 찾는다.

```bash
find ~ -maxdepth 6 -name "app.yaml" -newermt "-10 minutes" 2>/dev/null
```

arduino-cli 가 있으면 App Lab 없이도 된다.

```bash
arduino-cli compile --fqbn arduino:zephyr:unoq sketch
arduino-cli upload -p /dev/ttyACM0 --fqbn arduino:zephyr:unoq sketch
```

> **파이썬 쪽은 App Lab 에서 돌리지 않는 것을 권한다.** App Lab 은 파이썬을
> 컨테이너에서 실행하므로 포트 노출·바인드 주소를 신경 써야 한다
> (그 경우 `--host 0.0.0.0` 또는 `TORUS_BRIDGE_HOST=0.0.0.0` 이 필요하다).
> `scripts/install-kiosk.sh` 가 브리지를 systemd 서비스로 직접 돌리므로
> App Lab 은 **스케치를 STM32 에 굽는 용도로만** 쓰면 된다.

## 실행

```bash
# 의존성 (우노 Q 리눅스에서 1회)
sudo apt install -y python3-websockets python3-serial
# 또는
pip3 install websockets pyserial

# 시리얼 방식
python3 python/main.py --source serial --port /dev/ttyACM0

# Bridge 방식
python3 python/main.py --source bridge
```

포트 이름이 다르면 `ls /dev/ttyACM* /dev/ttyUSB*` 로 확인한다.

## 배선 확인

문제가 생기면 위에서부터 짚어 내려가면 된다.

1. **스위치**: 멀티미터 도통 모드로 COM–NO 가 눌렀을 때만 붙는지 확인 (NC 단자를 쓰면 반대로 동작한다).
2. **스케치**: 시리얼 모니터(115200)를 열고 버튼을 눌러 `B0 D` / `B0 U` 가 뜨는지 확인.
3. **브리지**: `python3 python/main.py -v` 로 띄우고 버튼을 눌러 로그를 확인.
4. **웹앱**: 화면 오른쪽 아래 점이 **초록**이면 브리지에 붙은 것이다 (회색이면 미연결 — 이때도 키보드로는 플레이된다).

자세한 배선표와 전원 구성은 [`../docs/hardware-guide.md`](../docs/hardware-guide.md) 참조.
