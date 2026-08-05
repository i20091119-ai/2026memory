/**
 * scenes/present.js — 제시(암기) 화면 (설계명세서 §3.2).
 *
 * 3-2-1 카운트다운 후 항목을 한 개씩 순서대로 보여 준다.
 * 제시 중 버튼 입력은 무시한다(대기 함수를 걸지 않으므로 자연히 무시된다).
 */
import { el, mount, sleep } from '../util.js';
import { STR } from '../strings.js';
import { CONFIG, COLORS } from '../config.js';
import { createTorus } from '../torus.js';
import { createHud } from './hud.js';
import { createStrip } from './strip.js';
import { createShape } from '../shapes.js';
import { GAME_COLOR, GAME_DIGIT } from '../games.js';

/**
 * 제시 항목 하나를 그린다.
 * @param {number} game
 * @param {number|string} value
 * @param {number|null} color 3차 교란용 색 인덱스
 */
function renderItem(game, value, color) {
  if (game === GAME_COLOR) {
    // 색 자체가 정보이므로 색 이름 텍스트는 표시하지 않는다 (§3.3).
    return el('div.present-color', { style: { background: COLORS[value] } });
  }
  if (game === GAME_DIGIT) {
    // 숫자는 항상 흰색 (§3.4).
    return el('div.present-digit', { text: String(value) });
  }
  // 3차: 모양이 기억 대상, 색은 순수 교란 요소 (§3.5).
  return el('div.present-shape', {}, createShape(value, { size: 380, color: COLORS[color] }));
}

/**
 * 카운트다운 한 칸.
 *
 * 외울 항목과 절대 헷갈리지 않아야 한다. 네 가지를 한꺼번에 다르게 둔다.
 *   글자 — 아라비아 숫자가 아니라 한글 (셋·둘·하나)
 *   색   — 외울 숫자는 흰색, 카운트는 노란색
 *   모양 — 시간이 줄어드는 원형 게이지 링 안에 넣어 "타이머"로 보이게
 *   문구 — 위에 '곧 시작해요'
 *
 * @param {string} word 셋 | 둘 | 하나
 * @param {number} ms 이 칸이 화면에 머무는 시간 (링이 도는 시간)
 */
function countdownTick(word, ms) {
  const NS = 'http://www.w3.org/2000/svg';
  const R = 90;
  const CIRC = 2 * Math.PI * R;

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.setAttribute('class', 'count-ring');
  svg.setAttribute('aria-hidden', 'true');

  for (const cls of ['count-ring-bg', 'count-ring-fg']) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', '100');
    c.setAttribute('cy', '100');
    c.setAttribute('r', String(R));
    c.setAttribute('class', cls);
    if (cls === 'count-ring-fg') {
      // 링이 한 칸 시간에 정확히 한 바퀴 비도록 JS 상수를 그대로 넘긴다.
      c.style.strokeDasharray = String(CIRC);
      c.style.animationDuration = `${ms}ms`;
    }
    svg.append(c);
  }

  return el('div.countdown', {},
    el('div.count-hint', { text: STR.COUNTDOWN_HINT }),
    el('div.count-dial', {}, svg, el('span.count-word', { text: word })),
  );
}

/**
 * @param {import('../state.js').Ctx} ctx
 * @param {{game: number, level: number, lives: number}} state
 * @param {{sequence: (number|string)[], presentColors: number[]|null}} round
 */
export async function presentScene(ctx, state, round) {
  const torus = createTorus({ mood: 'talk' });
  torus.say(STR.PRESENT_WATCH);

  const total = round.sequence.length;
  const stage = el('div.present-stage');
  const hud = createHud(state);

  // 답안 스트립을 여기서도 쓴다. 단, 값은 채우지 않는다 — 채우면 외울 필요가 없어진다.
  // 몇 개짜리인지, 지금 몇 번째를 보여 주는지만 알린다.
  const strip = createStrip(state.game, total);
  strip.setLabel(STR.STRIP_PRESENT(total));

  const node = el('section.scene.scene-present', {},
    hud,
    el('div.present-body', {}, stage, strip),
    el('div.present-torus', {}, torus),
  );
  mount(ctx.root, node);

  // 몇 개를 외워야 하는지 카운트다운 전에 미리 보여 준다.
  // (마음의 준비를 하고 시작하는 것과 아닌 것은 체감 난이도가 꽤 다르다)
  hud.setProgress(0, total);

  // 셋-둘-하나 카운트다운 (각 COUNTDOWN_MS)
  for (const [i, n] of [3, 2, 1].entries()) {
    stage.replaceChildren(countdownTick(STR.COUNTDOWN_WORDS[i], CONFIG.COUNTDOWN_MS));
    ctx.audio.countdown(n);
    await sleep(CONFIG.COUNTDOWN_MS, ctx.signal);
  }
  stage.replaceChildren(el('div.countdown.go', { text: STR.PRESENT_READY }));
  ctx.audio.countdown(0);
  await sleep(CONFIG.COUNTDOWN_MS, ctx.signal);

  torus.setMood('idle');
  torus.say(null);

  // 항목을 하나씩 제시. 스트립의 현재 칸이 함께 움직여 "몇 개 중 몇 번째"를 알린다.
  for (let i = 0; i < total; i++) {
    const value = round.sequence[i];
    const color = round.presentColors ? round.presentColors[i] : null;

    hud.setProgress(i, total);
    strip.setCurrent(i);
    strip.setLabel(STR.STRIP_RECALL(i + 1, total));
    stage.replaceChildren(renderItem(state.game, value, color));
    ctx.audio.present(state.game, state.game === GAME_COLOR ? value : i);

    await sleep(CONFIG.PRESENT_MS, ctx.signal);

    // 항목 간 공백 — 같은 값이 연달아 나와도 두 번임을 알 수 있게 반드시 비운다.
    stage.replaceChildren();
    await sleep(CONFIG.GAP_MS, ctx.signal);
  }

  hud.setProgress(total, total);
  strip.setCurrent(-1);
}
