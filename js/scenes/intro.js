/**
 * scenes/intro.js — 차수 안내 화면 (설계명세서 §4).
 *
 * "1차: 색깔 기억!" + 토러스의 규칙 한 줄 설명.
 * 규칙을 충분히 읽을 수 있도록 **아무 버튼이나 누를 때까지 기다린다.**
 * (자동으로 넘기면 읽는 속도가 사람마다 달라 놓치는 사람이 생긴다)
 * 다만 직전 입력이 튀어 곧바로 넘어가지 않도록 처음 INTRO_MIN_MS 는 입력을 무시한다.
 */
import { el, mount, sleep, waitButton } from '../util.js';
import { STR } from '../strings.js';
import { CONFIG, COLORS } from '../config.js';
import { createTorus } from '../torus.js';
import { createHud } from './hud.js';
import { createShape } from '../shapes.js';

/**
 * 게임을 한눈에 보여 주는 아이콘 묶음.
 * 색상=색칩, 숫자=숫자, 모양=도형, 혼합=셋을 섞어서.
 */
function introIcon(game) {
  if (game === 1) {
    return el('div.intro-icon', {}, ...COLORS.map((c) =>
      el('span.intro-swatch', { style: { background: c } })));
  }
  if (game === 2) {
    return el('div.intro-icon', {}, ...['3', '7', '5', '0'].map((d) =>
      el('span.intro-digit', { text: d })));
  }
  if (game === 3) {
    return el('div.intro-icon', {}, ...['star', 'heart', 'triangle', 'moon'].map((s) =>
      el('span.intro-shape', {}, createShape(s, { size: 52, color: '#fff' }))));
  }
  // 혼합 — 색칩·숫자·모양이 섞여 나온다는 걸 아이콘부터 보여 준다.
  return el('div.intro-icon', {},
    el('span.intro-swatch', { style: { background: COLORS[0] } }),
    el('span.intro-digit', { text: '7' }),
    el('span.intro-shape', {}, createShape('star', { size: 52, color: '#fff' })),
    el('span.intro-swatch', { style: { background: COLORS[3] } }),
  );
}

/**
 * @param {import('../state.js').Ctx} ctx
 * @param {{game: number, level: number, lives: number}} state
 */
export async function introScene(ctx, state) {
  const torus = createTorus({ mood: 'talk' });
  torus.say(STR.GAME_RULE[state.game]);

  // 최소 시간이 지나기 전에는 숨겨 둔다 — 누르라고 해놓고 안 받으면 더 헷갈린다.
  const press = el('div.intro-press', { text: STR.INTRO_PRESS });
  press.hidden = true;

  const hud = createHud(state);
  const node = el('section.scene.scene-intro', {},
    hud,
    el('div.intro-body', {},
      el('h2.intro-title', { text: STR.GAME_NAME[state.game] }),
      el('div.intro-flow', { text: STR.INTRO_FLOW }),
      introIcon(state.game),
      el('div.intro-torus', {}, torus),
      press,
    ),
    // 중도 이탈 방법은 차수 안내 화면에서 한 번 더 크게 알려 준다.
    el('div.exit-hint', { text: STR.EXIT_HINT }),
  );

  mount(ctx.root, node);
  ctx.audio.gameIntro();

  await sleep(CONFIG.INTRO_MIN_MS, ctx.signal);
  press.hidden = false;
  press.classList.add('blink');

  // 제한시간 없이 기다린다 (게임의 다른 입력과 같은 방침).
  await waitButton(ctx.input, ctx.signal, { timeoutMs: 0 });
  ctx.audio.blip();
}
