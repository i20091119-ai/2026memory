/**
 * scenes/feedback.js — 단계 클리어 / 오답 연출 (설계명세서 §4).
 */
import { el, mount, sleep } from '../util.js';
import { STR } from '../strings.js';
import { CONFIG, COLORS } from '../config.js';
import { createTorus } from '../torus.js';
import { createHud } from './hud.js';
import { createShape } from '../shapes.js';
import { GAME_COLOR, GAME_DIGIT } from '../games.js';

/**
 * 단계 클리어 연출 — 토러스 환호 후 다음 단계로.
 * @param {import('../state.js').Ctx} ctx
 * @param {{game: number, level: number, lives: number}} state
 */
export async function levelClearScene(ctx, state) {
  const torus = createTorus({ mood: 'cheer' });
  const cheer = STR.LEVEL_CLEAR_CHEER[(state.level - 1) % STR.LEVEL_CLEAR_CHEER.length];
  torus.say(cheer);

  const node = el('section.scene.scene-clear', {},
    createHud(state),
    el('div.clear-body', {},
      el('h2.clear-title.pop-in', { text: STR.LEVEL_CLEAR }),
      el('div.clear-torus', {}, torus),
    ),
  );
  mount(ctx.root, node);
  ctx.audio.levelClear();

  await sleep(CONFIG.LEVEL_CLEAR_MS, ctx.signal);
}

/** 오답 화면에서 "정답은 이거였어!" 로 보여 줄 값 */
function answerVisual(game, value, colorIndex) {
  if (game === GAME_COLOR) {
    return el('div.miss-answer-color', { style: { background: COLORS[value] } });
  }
  if (game === GAME_DIGIT) {
    return el('div.miss-answer-digit', { text: String(value) });
  }
  return el('div.miss-answer-shape', {}, createShape(value, { size: 180, color: '#fff' }));
}

/**
 * 오답 연출 — 화면 흔들림 + 하트 깨짐 + 정답 공개.
 * @param {import('../state.js').Ctx} ctx
 * @param {{game: number, level: number, lives: number}} state 목숨은 "차감 전" 값
 * @param {{expectedValue: number|string, expectedColor: number|null}} miss
 */
export async function missScene(ctx, state, miss) {
  const torus = createTorus({ mood: 'sad' });
  torus.say(STR.MISS_ENCOURAGE);

  const hud = createHud(state);
  const node = el('section.scene.scene-miss.shake', {},
    hud,
    el('div.miss-body', {},
      el('h2.miss-title', { text: STR.MISS }),
      el('div.miss-answer-label', { text: STR.MISS_ANSWER }),
      answerVisual(state.game, miss.expectedValue, miss.expectedColor),
      el('div.miss-torus', {}, torus),
    ),
  );
  mount(ctx.root, node);

  ctx.audio.wrong();
  // 하트가 깨지는 연출 — 차감 후 남는 개수를 넘긴다.
  hud.breakHeart(Math.max(0, state.lives - 1));

  await sleep(CONFIG.MISS_MS, ctx.signal);
}
