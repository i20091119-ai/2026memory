/**
 * scenes/versus.js — 2인 대결에 쓰이는 화면 조각들.
 *
 * 한 좌석에 그려지는 것들이다. 두 좌석을 묶어 진행하는 것은 arena.js 의 몫이고,
 * 문제 제시·회상 자체는 혼자 놀기와 같은 present/recall 씬을 그대로 쓴다.
 */
import { el, mount, sleep, waitButton } from '../util.js';
import { STR } from '../strings.js';
import { CONFIG, COLORS } from '../config.js';
import { createTorus } from '../torus.js';
import { createShape } from '../shapes.js';

/** 도전 프롬프트의 남은 시간 게이지 — 흰색 버튼을 누를지 말지 정할 시간 */
function countdownBar() {
  const fill = el('div.challenge-fill');
  const bar = el('div.challenge-bar', {}, fill);
  bar.setRatio = (ratio) => { fill.style.width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`; };
  return bar;
}

/**
 * 도전을 **받는** 좌석에 띄우는 프롬프트. 씬 위에 얹히므로 하던 게임은 그대로 보인다.
 * @returns {HTMLElement & {setRemaining: (ms: number, total: number) => void}}
 */
export function createChallengeIncoming() {
  const bar = countdownBar();
  const node = el('div.challenge.challenge-in', {},
    el('div.challenge-title', { text: STR.CHALLENGE_INCOMING }),
    el('div.challenge-question', { text: STR.CHALLENGE_QUESTION }),
    el('div.challenge-keys', {},
      el('span.challenge-key.accept', {}, el('span.challenge-dot.white'), el('span', { text: STR.CHALLENGE_ACCEPT_HINT })),
      el('span.challenge-key', { text: STR.CHALLENGE_IGNORE_HINT }),
    ),
    bar,
  );
  node.setRemaining = (ms, total) => bar.setRatio(ms / total);
  return node;
}

/**
 * 도전을 **건** 좌석에 띄우는 안내.
 * @returns {HTMLElement & {setRemaining: (ms: number, total: number) => void, setText: Function}}
 */
export function createChallengeOutgoing() {
  const bar = countdownBar();
  const title = el('div.challenge-title', { text: STR.CHALLENGE_SENT });
  const sub = el('div.challenge-question', { text: STR.CHALLENGE_WAITING });
  const node = el('div.challenge.challenge-out', {}, title, sub, bar);
  node.setRemaining = (ms, total) => bar.setRatio(ms / total);
  node.setText = (t, s) => { title.textContent = t; sub.textContent = s ?? ''; };
  return node;
}

/** 짧은 안내 토스트 (거절·수락) — 오버레이에 얹었다가 알아서 사라진다 */
export function toast(overlay, text, ms) {
  // 먼저 떠 있던 토스트는 치운다 — 겹치면 글자가 포개져 둘 다 못 읽는다
  overlay.querySelectorAll('.vs-toast').forEach((n) => n.remove());
  const node = el('div.vs-toast', { text });
  overlay.append(node);
  requestAnimationFrame(() => node.classList.add('on'));
  setTimeout(() => {
    node.classList.remove('on');
    setTimeout(() => node.remove(), 300);
  }, ms);
  return node;
}

/**
 * "무슨 게임으로 겨룰까?" — 두 좌석에 같은 화면. 아무 좌석이나 먼저 누르면 정해진다.
 * 입력은 arena 가 두 좌석에서 같이 기다리므로 여기서는 그리기만 한다.
 */
export function pickSceneNode() {
  const cards = Array.from({ length: CONFIG.GAME_TYPES }, (_, i) =>
    el('div.vs-pick-card', { style: { background: COLORS[i], animationDelay: `${i * 60}ms` } },
      el('span.vs-pick-name', { text: STR.GAME_SHORT[i + 1] })));
  return el('section.scene.scene-vs-pick', {},
    el('div.vs-body', {},
      el('h2.vs-title', { text: STR.VS_PICK_TITLE }),
      el('div.vs-sub', { text: STR.VS_PICK_SUB }),
      el('div.vs-pick-grid', {}, ...cards),
    ),
  );
}

/**
 * 대결 안내 — 규칙 한 줄. VS_INTRO_MS 동안 보이고 저절로 넘어간다.
 * @param {import('../state.js').Ctx} ctx
 * @param {number} game
 */
export async function versusIntroScene(ctx, game) {
  const torus = createTorus({ mood: 'talk' });
  torus.say(STR.VS_INTRO_WRONG);
  const node = el('section.scene.scene-vs-intro', {},
    el('div.vs-body', {},
      el('h2.vs-title.pop-in', { text: STR.VS_INTRO_TITLE }),
      el('div.vs-game', { style: { background: COLORS[game - 1] } },
        el('span', { text: STR.GAME_NAME[game] })),
      el('div.vs-rule', { text: STR.VS_INTRO_RULE(CONFIG.VS_WIN_POINTS) }),
      el('div.vs-sub', { text: STR.VS_INTRO_FLOW }),
      el('div.vs-torus', {}, torus),
    ),
  );
  mount(ctx.root, node);
  ctx.audio.gameIntro();
  await sleep(CONFIG.VS_INTRO_MS, ctx.signal);
}

/**
 * 대결 점수판 — HUD 자리에 얹히는 상주 요소. 라운드 내내 남는다.
 * @returns {HTMLElement & {set: Function, setOpponent: Function}}
 */
export function createVersusBar() {
  const me = el('span.vs-score.me', { text: '0' });
  const opp = el('span.vs-score.opp', { text: '0' });
  const round = el('span.vs-round');
  const oppDots = el('span.vs-opp-dots');
  const node = el('div.vs-bar', {},
    el('span.vs-side', {}, el('span.vs-label', { text: STR.VS_BAR_ME }), me),
    el('span.vs-mid', {}, round, oppDots),
    el('span.vs-side', {}, opp, el('span.vs-label', { text: STR.VS_BAR_OPP })),
  );
  /**
   * @param {{me: number, opp: number, round: number, total: number, sudden: boolean}} s
   */
  node.set = (s) => {
    me.textContent = String(s.me);
    opp.textContent = String(s.opp);
    round.textContent = s.sudden ? STR.VS_BAR_SUDDEN : STR.VS_BAR_ROUND(s.round, s.total);
    node.classList.toggle('sudden', !!s.sudden);
  };
  /** 상대가 몇 개째 맞히고 있는지 — 긴장감은 여기서 온다 */
  node.setOpponent = (done, total) => {
    oppDots.replaceChildren(
      el('span.vs-opp-label', { text: STR.VS_OPP_PROGRESS }),
      ...Array.from({ length: total }, (_, i) => el('span.vs-dot', { class: i < done ? 'done' : '' })),
    );
  };
  return node;
}

/**
 * 틀린 좌석이 상대의 결과를 기다리는 화면. arena 가 라운드를 결정하면 중단된다.
 * @param {import('../state.js').Ctx} ctx
 */
export async function versusWaitScene(ctx) {
  const torus = createTorus({ mood: 'sad' });
  torus.say(STR.VS_WAIT_SUB);
  const node = el('section.scene.scene-vs-wait', {},
    el('div.vs-body', {},
      el('h2.vs-title.wrong', { text: STR.VS_WAIT_TITLE }),
      el('div.vs-torus', {}, torus),
    ),
  );
  mount(ctx.root, node);
  ctx.audio.wrong();
  // 결정될 때까지 — arena 가 신호를 끊는다
  await sleep(10 * 60 * 1000, ctx.signal);
}

/**
 * 라운드 결과 — 이 좌석 기준으로 이겼는지/졌는지/무효인지.
 * @param {import('../state.js').Ctx} ctx
 * @param {{outcome: 'won'|'lost'|'draw', sudden?: boolean, me: number, opp: number}} r
 */
export async function versusRoundScene(ctx, r) {
  const text = r.outcome === 'won' ? STR.VS_ROUND_WON
    : r.outcome === 'lost' ? STR.VS_ROUND_LOST
    : (r.sudden ? STR.VS_ROUND_SUDDEN : STR.VS_ROUND_DRAW);
  const torus = createTorus({ mood: r.outcome === 'won' ? 'cheer' : (r.outcome === 'lost' ? 'sad' : 'talk') });
  const node = el('section.scene.scene-vs-round', { class: r.outcome },
    el('div.vs-body', {},
      el('h2.vs-title.pop-in', { text }),
      el('div.vs-scoreline', {},
        el('span.vs-big.me', { text: String(r.me) }),
        el('span.vs-colon', { text: ':' }),
        el('span.vs-big.opp', { text: String(r.opp) }),
      ),
      el('div.vs-torus', {}, torus),
    ),
  );
  mount(ctx.root, node);
  if (r.outcome === 'won') ctx.audio.roundWon();
  else if (r.outcome === 'lost') ctx.audio.roundLost();
  else ctx.audio.blip();
  await sleep(CONFIG.VS_ROUND_RESULT_MS, ctx.signal);
}

/** 색종이 — allclear 와 같은 연출을 승자 화면에 */
function confetti(count = 50) {
  const layer = el('div.confetti', { 'aria-hidden': 'true' });
  for (let i = 0; i < count; i++) {
    layer.append(el('span.confetti-bit', {
      style: {
        left: `${Math.random() * 100}%`,
        background: COLORS[i % COLORS.length],
        animationDelay: `${Math.random() * 2.5}s`,
        animationDuration: `${2.4 + Math.random() * 2}s`,
        transform: `rotate(${Math.random() * 360}deg)`,
      },
    }));
  }
  return layer;
}

/**
 * 최종 결과. 아무 버튼이나 누르거나 방치하면 끝난다.
 * @param {import('../state.js').Ctx} ctx
 * @param {{won: boolean, me: number, opp: number}} r
 */
export async function versusResultScene(ctx, r) {
  const torus = createTorus({ mood: r.won ? 'cheer' : 'sad' });
  torus.say(r.won ? STR.VS_WIN_CHEER : STR.VS_LOSE_CHEER);
  const node = el('section.scene.scene-vs-result', { class: r.won ? 'won' : 'lost' },
    r.won ? confetti() : null,
    el('div.vs-body', {},
      el('h2.vs-title.pop-in.final', { text: r.won ? STR.VS_WIN : STR.VS_LOSE }),
      el('div.vs-scoreline', {},
        el('span.vs-big.me', { text: String(r.me) }),
        el('span.vs-colon', { text: ':' }),
        el('span.vs-big.opp', { text: String(r.opp) }),
      ),
      el('div.vs-torus', {}, torus),
      el('div.vs-press.blink', { text: STR.VS_RESULT_PRESS }),
    ),
  );
  mount(ctx.root, node);
  if (r.won) ctx.audio.matchWon(); else ctx.audio.matchLost();
  await waitButton(ctx.input, ctx.signal, { timeoutMs: CONFIG.VS_RESULT_IDLE_MS });
}

/** 대결 게임 고르기 카드에 쓰는 미니 아이콘 (모양 게임 표시용, 선택 화면과 통일) */
export function miniShape(name) {
  return createShape(name, { size: '70%', color: '#fff' });
}
