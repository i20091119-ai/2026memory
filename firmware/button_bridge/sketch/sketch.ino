/*
 * sketch.ino — 아케이드 버튼 4개를 읽어 리눅스 쪽으로 알린다.
 * 대상: 아두이노 우노 Q 의 STM32 마이크로컨트롤러 (설계명세서 §5.3)
 *
 * 배선 (docs/hardware-guide.md 와 동일)
 *   D2 = 빨강(0)  D3 = 노랑(1)  D4 = 초록(2)  D5 = 파랑(3)
 *   스위치 COM 은 전부 GND 데이지체인, NO 를 각 핀에.
 *   INPUT_PULLUP 이므로 평상시 HIGH, 누르면 LOW. 외부 저항 불필요.
 *
 * 눌림·뗌 양쪽 엣지를 모두 보낸다. 웹앱의 "빨강+파랑 2초 홀드" 콤보를
 * 감지하려면 뗌 이벤트가 반드시 필요하다 (§5.2).
 *
 * 전송 방식이 두 가지다:
 *   USE_BRIDGE 1 → App Lab Bridge RPC 로 파이썬에 직접 통지 (우노 Q 는 이것만 된다)
 *   USE_BRIDGE 0 → 시리얼로 한 줄씩 출력 (USB 시리얼이 잡히는 보드용, 디버깅 쉬움)
 * 두 경우 모두 python/main.py 가 받아 처리한다. firmware/README.md 참조.
 *
 * 우노 Q 는 STM32 가 보드에 내장되어 USB 시리얼(/dev/ttyACM*)로 잡히지 않는다.
 * 그래서 이 보드에서는 Bridge 방식이 유일한 통로이고, 기본값을 1 로 둔다.
 */

#define USE_BRIDGE 1   // 우노 Q 기본값. USB 시리얼이 잡히는 보드에서만 0 으로.

#if USE_BRIDGE
  // 우노 Q 의 App Lab 이 제공하는 MPU↔MCU RPC. 플랫폼(arduino:zephyr)에 들어 있어
  // sketch.yaml 의 libraries 에 따로 적지 않는다.
  #include <Arduino_RouterBridge.h>
#endif

static const uint8_t PINS[4]   = { 2, 3, 4, 5 };   // 0=빨 1=노 2=초 3=파
static const uint8_t NUM_BTN   = 4;
static const uint16_t DEBOUNCE_MS = 10;            // 채터링 제거 (§5.3)

// 각 버튼의 "확정된" 상태와, 마지막으로 흔들림이 관측된 시각
static bool     stableLow[NUM_BTN];      // true = 눌림(LOW)
static bool     lastRead[NUM_BTN];
static uint32_t lastChangeMs[NUM_BTN];

static void report(uint8_t id, bool pressed) {
#if USE_BRIDGE
  // 리눅스 쪽 파이썬의 button_event(id, state) 콜백을 깨운다.
  Bridge.notify("button_event", id, pressed ? 1 : 0);
#else
  // 사람이 읽어도 알아볼 수 있는 짧은 한 줄: "B0 D" / "B3 U"
  Serial.print('B');
  Serial.print(id);
  Serial.print(' ');
  Serial.println(pressed ? 'D' : 'U');
#endif
}

void setup() {
  for (uint8_t i = 0; i < NUM_BTN; i++) {
    pinMode(PINS[i], INPUT_PULLUP);
    bool low      = (digitalRead(PINS[i]) == LOW);
    stableLow[i]  = low;
    lastRead[i]   = low;
    lastChangeMs[i] = 0;
  }

#if USE_BRIDGE
  Bridge.begin();
#else
  Serial.begin(115200);
#endif
}

void loop() {
#if USE_BRIDGE
  // 들어온 RPC 를 처리한다. 이 호출이 빠지면 Bridge 가 동작하지 않는다.
  Bridge.update();
#endif

  const uint32_t now = millis();

  for (uint8_t i = 0; i < NUM_BTN; i++) {
    const bool low = (digitalRead(PINS[i]) == LOW);

    // 읽은 값이 흔들리면 타이머를 리셋한다.
    if (low != lastRead[i]) {
      lastRead[i]     = low;
      lastChangeMs[i] = now;
      continue;
    }

    // DEBOUNCE_MS 동안 같은 값이 유지되어야 상태 변화로 인정한다.
    if (low != stableLow[i] && (now - lastChangeMs[i]) >= DEBOUNCE_MS) {
      stableLow[i] = low;
      report(i, low);
    }
  }

  delay(1);   // 폴링 1ms — 사람 손가락 기준으로 충분히 즉각적이다
}
