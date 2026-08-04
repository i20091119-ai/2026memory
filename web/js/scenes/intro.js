/**
 * scenes/intro.js — 차수 안내 화면 (설계명세서 §4).
 * "1차: 색깔 기억!" + 토러스의 규칙 한 줄 설명. 2.5초 후 자동 진행.
 */
import { el, mount, sleep } from '../util.js';
import { STR } from '../strings.js';
import { CONFIG, COLORS } from '../config.js';
import { createTorus } from '../torus.js';
import { createHud } from './hud.js';
import { createShape } from '../shapes.js';

/**
 * 차수를 한눈에 보여 주는 아이콘 묶음.
 * 1차=색칩, 2차=숫자, 3차=도형.
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
  return el('div.intro-icon', {}, ...['star', 'heart', 'triangle', 'moon'].map((s) =>
    el('span.intro-shape', {}, createShape(s, { size: 52, color: '#fff' }))));
}

/**
 * @param {import('../state.js').Ctx} ctx
 * @param {{game: number, level: number, lives: number}} state
 */
export async function introScene(ctx, state) {
  const torus = createTorus({ size: 190, mood: 'talk' });
  torus.say(STR.GAME_RULE[state.game]);

  const hud = createHud(state);
  const node = el('section.scene.scene-intro', {},
    hud,
    el('div.intro-body', {},
      el('h2.intro-title', { text: STR.GAME_NAME[state.game] }),
      introIcon(state.game),
      el('div.intro-torus', {}, torus),
    ),
    // 중도 이탈 방법은 차수 안내 화면에서만 조용히 알려 준다.
    // (플레이 중에는 화면을 어지럽히지 않으면서도 존재를 알 수 있게)
    el('div.exit-hint', { text: STR.EXIT_HINT }),
  );

  mount(ctx.root, node);
  ctx.audio.gameIntro();

  await sleep(CONFIG.INTRO_MS, ctx.signal);
}
