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

## 전송 방식 — 우노 Q 는 Bridge RPC 뿐이다

**우노 Q 는 STM32 가 보드에 내장되어 USB 시리얼로 잡히지 않는다.**
실물에서 확인한 결과 `/dev/ttyACM*` · `/dev/ttyUSB*` 가 아예 없고
`ttyS0~S3` 만 있는데 그건 STM32 와 무관하다. 즉 이 보드에서 MCU 와 말할 방법은
App Lab 의 **Bridge RPC** 하나뿐이다.

| | 스케치 | 파이썬 | 쓰는 곳 |
|---|---|---|---|
| **Bridge RPC** (기본) | `#define USE_BRIDGE 1` | `--source bridge` | **우노 Q** |
| 시리얼 | `#define USE_BRIDGE 0` | `--source serial` | USB 시리얼이 잡히는 보드 |

파이썬의 `--source` 기본값은 `auto` 다. `arduino.app_utils` 임포트가 되면
(= App Lab 런타임 안이면) `bridge`, 아니면 `serial` 로 저절로 갈린다.
바인드 주소(`--host`)도 같은 기준으로 정해진다 — 아래 참조.

### API (실물 보드에서 확인한 것)

스케치 쪽:

```cpp
#include <Arduino_RouterBridge.h>   // 플랫폼 내장, sketch.yaml 에 안 적어도 된다

Bridge.begin();                              // setup()
Bridge.update();                             // loop() 마다 — 빠뜨리면 동작 안 함
Bridge.notify("button_event", id, state);    // MCU → 파이썬
```

파이썬 쪽:

```python
from arduino.app_utils import Bridge         # App Lab 런타임 안에서만 임포트된다
Bridge.provide("button_event", handler)      # MCU 의 통지를 받는 콜백 등록
```

이름(`button_event`)만 양쪽이 같으면 되고, 인자는 여러 개를 넘길 수 있다.

### 그래서 파이썬 브리지는 App Lab 앱으로 돌려야 한다

`arduino.app_utils` 는 App Lab 런타임(컨테이너) 안에서만 존재한다.
systemd 로 직접 띄우면 임포트가 안 되므로, 브리지는 **App Lab 앱으로 등록하고
`Run at startup` 을 켜서** 돌린다. 웹서버와 크로미움 키오스크만
`scripts/install-kiosk.sh` 가 systemd 로 맡는다.

| | 담당 | 자동시작 |
|---|---|---|
| 스케치 + 버튼 브리지 | App Lab 앱 (8765 노출) | App Lab 의 `Run at startup` |
| 웹서버 + 크로미움 | systemd | `install-kiosk.sh` |
| 브리지 감시 (죽으면 되살림) | systemd | `install-kiosk.sh` |

App Lab 은 **멈춘 앱을 저절로 되살리지 않는다.** 운영 중에 브리지 앱이 멈춰
아케이드 버튼만 죽은 일이 있었으므로, `scripts/bridge-watch.sh` 가 8765 를
지켜보다 닫히면 App Lab 앱 컨테이너를 다시 띄운다
(`docs/hardware-guide.md` §5.8).

컨테이너 안에서는 `localhost` 에 묶으면 호스트의 브라우저가 못 붙으므로
`0.0.0.0` 에 묶어야 하는데, 이것도 `--host` 기본값이 알아서 판단한다
(`app.yaml` 의 `ports: [8765]` 가 호스트로 게시해 준다).

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

> **파이썬 브리지도 App Lab 앱으로 돌린다** (§위 "그래서 파이썬 브리지는…" 참조).
> `arduino.app_utils` 가 App Lab 런타임 안에서만 임포트되기 때문이다.
> App Lab 이 파이썬을 컨테이너에서 실행하므로 바인드 주소는 `0.0.0.0` 이어야 하고
> `app.yaml` 의 `ports: [8765]` 로 호스트에 노출해야 하는데, 둘 다 기본값이
> 알아서 판단한다. 앱 카드의 **`Run at startup` 을 켜야** 부팅 시 뜬다.

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

0. **한 줄 진단 먼저**: `bash ../scripts/bridge-watch.sh --once` — 8765 가 열렸는지, 브리지 컨테이너가 살았는지를 한꺼번에 보여 준다. **닫혀 있으면 아래를 볼 필요 없이 브리지가 죽은 것**이다 (`--restart` 로 되살린다).
1. **스위치**: 멀티미터 도통 모드로 COM–NO 가 눌렀을 때만 붙는지 확인 (NC 단자를 쓰면 반대로 동작한다).
2. **스케치**: 시리얼 모니터(115200)를 열고 버튼을 눌러 `B0 D` / `B0 U` 가 뜨는지 확인.
3. **브리지**: `python3 python/main.py -v` 로 띄우고 버튼을 눌러 로그를 확인. (App Lab 앱을 먼저 Stop 해야 8765 가 겹치지 않는다. 감시가 자동으로 되살리므로 `bash ../scripts/bridge-watch.sh --pause` 로 잠시 재워 두고, 끝나면 `--resume`.)
4. **웹앱**: 화면 **왼쪽 위 점**이 **초록**이면 브리지에 붙은 것이다. 끊겨 있으면 점이 빨갛게 바뀌고 "버튼 미연결" 글자가 뜬다 (이때도 키보드로는 플레이된다).

버튼 4개가 **동시에** 죽었는데 8765 는 열려 있으면 배선이다. **GND 데이지체인**이
단일 고장점이므로 거기부터 본다.

자세한 배선표와 전원 구성은 [`../docs/hardware-guide.md`](../docs/hardware-guide.md) 참조.
