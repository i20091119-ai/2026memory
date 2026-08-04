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

## 실행

```bash
# 의존성 (우노 Q 리눅스에서 1회)
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
