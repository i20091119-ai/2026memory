#!/usr/bin/env python3
"""
main.py — 우노 Q 리눅스 쪽 브리지 (설계명세서 §5.2, §5.3)

스케치(STM32)가 알려 준 버튼 눌림/뗌을 받아 WebSocket 으로 브로드캐스트한다.
웹앱은 ws://localhost:8765 에 붙어 아래 메시지를 받는다.

    {"type": "hello",  "source": "unoq"}                 # 접속 직후 1회
    {"type": "button", "id": 0, "state": "down"}         # 0=빨 1=노 2=초 3=파
    {"type": "button", "id": 0, "state": "up"}

입력 소스는 두 가지 — 스케치의 USE_BRIDGE 설정과 맞춰서 고른다.

    --source serial   (기본) 스케치가 시리얼로 뿌리는 "B0 D" 형식을 읽는다.
    --source bridge   App Lab Bridge RPC 콜백으로 받는다.

localhost 전용이며, 클라이언트가 없어도 조용히 계속 돈다.
"""

import argparse
import asyncio
import json
import logging
import os
import sys

try:
    import websockets
except ImportError:  # pragma: no cover
    sys.exit("websockets 패키지가 필요합니다:  pip3 install websockets")

LOG = logging.getLogger("button_bridge")

HOST = "localhost"
PORT = 8765
NUM_BUTTONS = 4

# 연결된 웹앱들 (보통 키오스크 크로미움 하나뿐)
CLIENTS: set = set()


async def broadcast(payload: dict) -> None:
    """붙어 있는 모든 클라이언트에 한 줄 보낸다. 끊긴 연결은 조용히 버린다."""
    if not CLIENTS:
        return
    message = json.dumps(payload)
    dead = []
    for ws in list(CLIENTS):
        try:
            await ws.send(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        CLIENTS.discard(ws)


def button_payload(button_id: int, pressed: bool) -> dict:
    return {"type": "button", "id": int(button_id), "state": "down" if pressed else "up"}


async def handle_client(ws) -> None:
    """웹앱 하나가 붙어 있는 동안 유지되는 핸들러."""
    CLIENTS.add(ws)
    LOG.info("웹앱 접속 (현재 %d개)", len(CLIENTS))
    try:
        await ws.send(json.dumps({"type": "hello", "source": "unoq"}))
        # 웹앱은 아무것도 보내지 않는다. 연결이 끊길 때까지 대기만 한다.
        async for _ in ws:
            pass
    except Exception:
        pass
    finally:
        CLIENTS.discard(ws)
        LOG.info("웹앱 접속 종료 (현재 %d개)", len(CLIENTS))


# --------------------------------------------------------------------- #
# 입력 소스 1: 시리얼 ("B0 D" / "B3 U")
# --------------------------------------------------------------------- #

def parse_serial_line(line: str):
    """'B0 D' → (0, True). 알아볼 수 없으면 None."""
    line = line.strip()
    if len(line) < 3 or line[0] != "B":
        return None
    try:
        button_id = int(line[1])
        state = line.split()[-1].upper()
    except (ValueError, IndexError):
        return None
    if not 0 <= button_id < NUM_BUTTONS or state not in ("D", "U"):
        return None
    return button_id, state == "D"


async def run_serial(port: str, baud: int) -> None:
    """스케치의 시리얼 출력을 계속 읽는다. 포트가 사라지면 재시도한다."""
    try:
        import serial  # pyserial
    except ImportError:
        sys.exit("pyserial 이 필요합니다:  pip3 install pyserial")

    while True:
        try:
            with serial.Serial(port, baud, timeout=0.05) as ser:
                LOG.info("시리얼 열림: %s @ %d", port, baud)
                buf = b""
                while True:
                    chunk = await asyncio.to_thread(ser.read, 64)
                    if chunk:
                        buf += chunk
                        while b"\n" in buf:
                            raw, buf = buf.split(b"\n", 1)
                            parsed = parse_serial_line(raw.decode("ascii", "ignore"))
                            if parsed:
                                await broadcast(button_payload(*parsed))
                    else:
                        await asyncio.sleep(0)  # 다른 태스크에 양보
        except Exception as exc:
            LOG.warning("시리얼 오류(%s) — 2초 후 재시도", exc)
            await asyncio.sleep(2)


# --------------------------------------------------------------------- #
# 입력 소스 2: App Lab Bridge RPC
# --------------------------------------------------------------------- #

async def run_bridge() -> None:
    """
    스케치의 Bridge.notify("button_event", id, state) 를 받아 브로드캐스트한다.

    NOTE: App Lab 버전에 따라 임포트 경로와 콜백 등록 방법이 다르다.
          설치된 App Lab 의 Bridge 예제를 열어 확인한 뒤 이 함수만 맞춰 주면 된다.
          나머지(웹소켓 서버·메시지 형식)는 그대로 쓸 수 있다.
    """
    try:
        from arduino.app_utils import Bridge  # type: ignore
    except ImportError:
        sys.exit(
            "App Lab Bridge 를 임포트하지 못했습니다.\n"
            "  - 우노 Q 의 App Lab 환경에서 실행 중인지 확인하세요.\n"
            "  - 또는 --source serial 로 시리얼 방식을 쓰세요."
        )

    loop = asyncio.get_running_loop()

    def on_button_event(button_id: int, state: int) -> None:
        # 콜백은 별도 스레드에서 올 수 있으므로 이벤트 루프로 넘긴다.
        asyncio.run_coroutine_threadsafe(
            broadcast(button_payload(int(button_id), bool(state))), loop
        )

    Bridge.provide("button_event", on_button_event)
    LOG.info("Bridge RPC 대기 중")
    while True:
        await asyncio.sleep(3600)


# --------------------------------------------------------------------- #

async def main_async(args) -> None:
    async with websockets.serve(handle_client, args.host, PORT):
        LOG.info("WebSocket 서버 시작: ws://%s:%d", args.host, PORT)
        if args.source == "bridge":
            await run_bridge()
        else:
            await run_serial(args.port, args.baud)


def main() -> None:
    parser = argparse.ArgumentParser(description="우노 Q 버튼 → WebSocket 브리지")
    parser.add_argument("--source", choices=("serial", "bridge"), default="serial",
                        help="스케치의 USE_BRIDGE 설정과 맞출 것 (기본: serial)")
    parser.add_argument("--port", default="/dev/ttyACM0", help="시리얼 포트")
    parser.add_argument("--baud", type=int, default=115200, help="시리얼 속도")
    # 기본은 localhost — 같은 기계의 키오스크 브라우저만 붙으면 되므로 밖으로 열 이유가 없다.
    # App Lab 앱으로 돌릴 때만 예외다. 그때는 파이썬이 컨테이너 안에서 돌아서
    # localhost 에 묶으면 호스트의 브라우저가 못 붙는다 → 0.0.0.0 이 필요하다.
    parser.add_argument("--host", default=os.environ.get("TORUS_BRIDGE_HOST", HOST),
                        help="바인드 주소 (기본 localhost, App Lab 컨테이너면 0.0.0.0)")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    try:
        asyncio.run(main_async(args))
    except KeyboardInterrupt:
        LOG.info("종료")


if __name__ == "__main__":
    main()
