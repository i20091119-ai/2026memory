/**
 * main.js — 부트스트랩.
 *
 * 좌석(책상)을 만들고, 좌석마다 입력·소리·상태 머신을 붙이고, 키오스크 편의 설정을 건다.
 *
 * 좌석은 보통 하나다(브라우저, github.io). 실물 키오스크는 라즈베리파이 한 대가
 * 모니터 두 대를 한 화면(3840×1080)으로 쓰므로 좌석이 둘 — 왼쪽 반이 책상 1,
 * 오른쪽 반이 책상 2 다. 두 좌석은 각자 독립적으로 혼자 놀기를 돌리다가,
 * 흰색 버튼으로 도전을 걸면 arena.js 가 둘을 묶어 대결을 진행한다.
 */
import { CONFIG, SEATS } from './config.js';
import { STR } from './strings.js';
import { InputManager, KeyboardInput, GamepadInput, SocketInput } from './input.js';
import { Audio } from './audio.js';
import { runApp } from './state.js';
import { createBrand } from './logo.js';
import { preloadTorus } from './torus.js';
import { el } from './util.js';
import { createArena } from './arena.js';

const app = document.getElementById('app');
const overlay = document.getElementById('overlay');
document.body.dataset.seats = String(SEATS);

// ?cursor=1 — 개발 중 마우스로 화면을 직접 탭해 보고 싶을 때만 커서를 되살린다.
if (new URLSearchParams(location.search).get('cursor') === '1') {
  document.body.classList.add('show-cursor');
}

// 안내 캐릭터 표정 4장을 미리 받아 둔다 — 표정이 바뀔 때 깜빡이지 않게.
preloadTorus();

/* ---------------- 좌석 ---------------- */

/**
 * 좌석 하나를 만든다: 씬 자리, 상주 요소 자리, 입력 허브, 소리, 홀드 게이지.
 * @param {number} index 0 = 왼쪽(또는 유일한) 좌석, 1 = 오른쪽
 */
function createSeat(index) {
  const root = el('div.seat-app');
  const seatOverlay = el('div.seat-overlay', { 'aria-hidden': 'true' });
  const node = el('div.seat', { 'data-seat': String(index) }, root, seatOverlay);
  app.append(node);

  // 기관 로고는 씬이 바뀌어도 남아야 하므로 좌석 오버레이에 한 번만 붙인다.
  seatOverlay.append(createBrand());

  const input = new InputManager(CONFIG);
  new KeyboardInput(input, CONFIG, {
    keyMap: CONFIG.KEY_MAPS[index] ?? CONFIG.KEY_MAPS[0],
    // 운영자 키(0)는 왼쪽 좌석만 받는다 — 둘 다 받으면 두 번 열린다.
    adminKey: index === 0 ? CONFIG.ADMIN_KEY : null,
  }).attach(window);

  // 좌석이 둘이면 소리를 좌우로 나눈다 — 왼쪽 책상 소리는 왼쪽 스피커에서.
  const pan = SEATS === 1 ? 0 : (index === 0 ? -0.8 : 0.8);
  const audio = new Audio({ pan });

  // 홀드 게이지 — 콤보(빨+파 = 홈, 노+초 = 운영자 화면)를 누르고 있는 동안 진행률을
  // 보여 준다. 실수로 눌렀을 때 "뭔가 일어나려 한다"를 알 수 있어야 당황하지 않는다.
  const holdBar = el('div.hold-bar');
  const holdText = el('div.hold-text', { text: STR.HOME_HOLDING });
  const holdGauge = el('div.hold-gauge', {}, holdBar, holdText);
  seatOverlay.append(holdGauge);
  let holdRaf = null;
  input.onRaw(() => {
    if (!input.isHolding() || holdRaf !== null) return;
    holdText.textContent = input.holdKind() === 'admin' ? STR.ADMIN_HOLDING : STR.HOME_HOLDING;
    const step = () => {
      if (!input.isHolding()) {          // 콤보가 풀렸다 — 게이지를 접는다
        holdGauge.classList.remove('on');
        holdBar.style.width = '0%';
        holdRaf = null;
        return;
      }
      holdGauge.classList.add('on');
      holdBar.style.width = `${Math.round(input.holdProgress() * 100)}%`;
      holdRaf = requestAnimationFrame(step);
    };
    holdRaf = requestAnimationFrame(step);
  });

  const seat = {
    index,
    node,
    root,
    overlay: seatOverlay,
    input,
    audio,
    /** 지금 어느 화면인지 — arena 가 도전을 걸어도 되는 때인지 볼 때 쓴다 */
    phase: 'title',
    _ac: null,
    _loop: null,
  };

  /** 혼자 놀기 루프를 (다시) 시작한다. */
  const keyHint = STR.TITLE_KEYHINT(
    Object.keys(CONFIG.KEY_MAPS[index] ?? CONFIG.KEY_MAPS[0]).slice(0, 4).join(' ').toUpperCase());

  seat.run = () => {
    seat._ac = new AbortController();
    seat._loop = runApp({
      root, overlay: seatOverlay, input, audio, keyHint,
      onPhase: (p) => { seat.phase = p; },
    }, {
      signal: seat._ac.signal,
      // URL 치트(?game=…)는 왼쪽 좌석에만 건다
      cheat: index === 0,
    }).catch((err) => {
      // 여기까지 오면 진짜 예외다. 키오스크에서 멈춰 있는 것보다 재시작이 낫다.
      console.error('[torus-memory] 치명적 오류, 3초 후 재시작합니다', err);
      setTimeout(() => location.reload(), 3000);
    });
    return seat._loop;
  };

  /** 혼자 놀기 루프를 멈추고, 완전히 빠져나올 때까지 기다린다. */
  seat.halt = async () => {
    seat._ac?.abort();
    input.reset();
    await seat._loop;
    seat._loop = null;
  };

  return seat;
}

const seats = Array.from({ length: SEATS }, (_, i) => createSeat(i));

/* ---------------- 입력 소스 ---------------- */

// USB 아케이드 인코더(게임패드). 좌석 순서대로 버튼 번호표를 나눠 갖는다.
new GamepadInput(seats.map((s) => s.input), CONFIG.GAMEPAD_MAPS).start();

// 우노 Q 브리지(WebSocket) — 예전 구성. 왼쪽 좌석에만 붙는다.
// 없어도 조용히 키보드/게임패드로만 동작한다 (§2).
const socket = new SocketInput(seats[0].input, CONFIG);

// 버튼 연결 표시등 — 화면 왼쪽 위.
//
// 운영자가 "버튼이 왜 안 먹지?" 할 때 제일 먼저 볼 곳이라, 팔 길이에서 색이
// 구분될 만큼은 커야 한다. 실물 키오스크(localhost)에서 **끊긴 동안에만** 글자까지
// 띄운다. 게임패드(인코더) 구성에서는 브리지가 원래 없으므로 글자를 띄우지 않는다.
const isKiosk = (globalThis.location?.hostname === 'localhost'
  || globalThis.location?.hostname === '127.0.0.1')
  && new URLSearchParams(location.search).get('bridge') !== '0';

const statusDot = el('span.ws-dot');
const statusLabel = el('span.ws-label', { text: STR.WS_OFFLINE_SHORT });
const statusIcon = el('div.ws-status', { title: STR.WS_OFFLINE }, statusDot, statusLabel);
if (isKiosk) statusIcon.classList.add('kiosk');
overlay.append(statusIcon);

socket.onStatus((connected) => {
  statusIcon.classList.toggle('on', connected);
  statusIcon.title = connected ? STR.WS_CONNECTED : STR.WS_OFFLINE;
});
socket.connect();

/* ---------------- 키오스크 편의 ---------------- */

// 첫 사용자 제스처에서 오디오 잠금 해제 (버튼·키·탭 어느 쪽이든).
const unlockOnce = () => seats.forEach((s) => s.audio.unlock());
window.addEventListener('pointerdown', unlockOnce, { once: true });
window.addEventListener('keydown', unlockOnce, { once: true });

// 1시간 방치해도 화면이 꺼지면 안 된다 (§7 수용 기준).
// Wake Lock 은 지원하는 브라우저에서만 동작하며, 실패해도 게임에는 영향이 없다.
async function keepAwake() {
  if (!('wakeLock' in navigator)) return;
  try {
    const lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => {
      // 탭이 백그라운드로 갔다 오면 잠금이 풀리므로 다시 건다.
      if (document.visibilityState === 'visible') keepAwake();
    });
  } catch {
    /* 사용자 제스처 전이거나 미지원 — 조용히 무시 */
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') keepAwake();
});
window.addEventListener('pointerdown', keepAwake, { once: true });
window.addEventListener('keydown', keepAwake, { once: true });
keepAwake();

// 키오스크에서 우클릭 메뉴·드래그·확대는 전부 사고의 원인일 뿐이다.
window.addEventListener('contextmenu', (ev) => ev.preventDefault());
window.addEventListener('dragstart', (ev) => ev.preventDefault());
window.addEventListener('gesturestart', (ev) => ev.preventDefault());

/* ---------------- 시작 ---------------- */

// 개발·검증용 훅 (?debug=1 일 때만). 브라우저 자동화가 좌석 상태를 들여다본다.
if (new URLSearchParams(location.search).get('debug') === '1') {
  globalThis.__torus = { seats, arena: null, round: null };
}

for (const seat of seats) seat.run();

// 좌석이 둘이면 흰색 버튼으로 서로 도전할 수 있다.
if (seats.length === 2) {
  const arena = createArena(seats);
  if (globalThis.__torus) globalThis.__torus.arena = arena;
}
