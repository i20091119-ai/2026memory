/**
 * main.js — 부트스트랩.
 * 입력 소스를 붙이고, 상태 머신 루프를 돌리고, 키오스크 편의 설정을 건다.
 */
import { CONFIG } from './config.js';
import { STR } from './strings.js';
import { InputManager, KeyboardInput, SocketInput } from './input.js';
import { audio } from './audio.js';
import { runApp } from './state.js';
import { createBrand } from './logo.js';
import { el } from './util.js';

const root = document.getElementById('app');
const overlay = document.getElementById('overlay');

// ?cursor=1 — 개발 중 마우스로 화면을 직접 탭해 보고 싶을 때만 커서를 되살린다.
if (new URLSearchParams(location.search).get('cursor') === '1') {
  document.body.classList.add('show-cursor');
}

/* ---------------- 입력 ---------------- */

// 기관 로고는 씬이 바뀌어도 남아야 하므로 오버레이에 한 번만 붙인다.
// 타이틀에서 크게 보이는 것은 CSS 가 처리한다 (style.css 의 .brand 참조).
overlay.append(createBrand());

const input = new InputManager(CONFIG);
new KeyboardInput(input, CONFIG).attach(window);

// WebSocket 브리지: 없어도 조용히 키보드 모드로만 동작한다 (§2).
const socket = new SocketInput(input, CONFIG);

const statusIcon = el('div.ws-status', { title: STR.WS_OFFLINE });
overlay.append(statusIcon);
socket.onStatus((connected) => {
  statusIcon.classList.toggle('on', connected);
  statusIcon.title = connected ? STR.WS_CONNECTED : STR.WS_OFFLINE;
});
socket.connect();

/* ---------------- 중도 이탈 홀드 게이지 ---------------- */
// 빨+파를 누르고 있는 동안 진행률을 보여 준다. 실수로 눌렀을 때
// "뭔가 일어나려 한다"를 알 수 있어야 당황하지 않는다.

const holdBar = el('div.hold-bar');
const holdGauge = el('div.hold-gauge', {},
  holdBar,
  el('div.hold-text', { text: STR.HOME_HOLDING }),
);
overlay.append(holdGauge);

let holdRaf = null;

input.onRaw(() => {
  if (!input.isHolding() || holdRaf !== null) return;
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

/* ---------------- 키오스크 편의 ---------------- */

// 첫 사용자 제스처에서 오디오 잠금 해제 (버튼·키·탭 어느 쪽이든).
const unlockOnce = () => audio.unlock();
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

runApp({ root, overlay, input, audio }).catch((err) => {
  // 여기까지 오면 진짜 예외다. 키오스크에서 멈춰 있는 것보다 재시작이 낫다.
  console.error('[torus-memory] 치명적 오류, 3초 후 재시작합니다', err);
  setTimeout(() => location.reload(), 3000);
});
