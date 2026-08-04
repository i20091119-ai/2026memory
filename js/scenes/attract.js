/**
 * scenes/attract.js — 어트랙트 데모 (설계명세서 §4).
 *
 * 타이틀 60초 방치 시 진입해 1차 색깔게임 2~3단계를 자동 시연한다.
 * 구현 부담을 줄이기 위해 실제 present/recall 씬을 그대로 재사용하고,
 * 입력만 유령(script) 입력으로 주입한다.
 * 사람이 아무 버튼이나 누르면 즉시 타이틀로 돌아간다.
 */
import { el, isExit, sleep } from '../util.js';
import { STR } from '../strings.js';
import { CONFIG } from '../config.js';
import { createTorus } from '../torus.js';
import { buildRound, GAME_COLOR } from '../games.js';
import { presentScene } from './present.js';
import { recallScene } from './recall.js';
import { levelClearScene } from './feedback.js';

/** 데모가 시연할 단계들 — 2단계, 3단계를 번갈아 보여 준다 */
const DEMO_LEVELS = [2, 3];

/** 유령 입력이 "생각하는" 시간 */
const GHOST_DELAY_MS = 620;

/**
 * @param {import('../state.js').Ctx} ctx
 */
export async function attractScene(ctx) {
  const ac = new AbortController();
  const timers = new Set();

  // 사람이 누르면 즉시 중단. 유령(script) 입력은 무시한다.
  const off = ctx.input.onButton((ev) => {
    if (ev.source === 'human') ac.abort();
  });

  const badge = el('div.attract-badge', {},
    el('span.attract-dot'),
    el('span', { text: STR.ATTRACT_BADGE }),
  );
  const hint = el('div.attract-hint.blink', { text: STR.ATTRACT_PRESS });

  // 데모 내내 따라다니는 토러스 — 씬이 바뀌어도 사라지지 않도록 오버레이에 둔다.
  const guide = createTorus({ size: 175, mood: 'talk' });
  guide.say(STR.ATTRACT_SPEECH);
  const guideBox = el('div.attract-guide', {}, guide);

  ctx.overlay.append(badge, hint, guideBox);

  // 씬들이 ctx.signal 을 보고 대기하므로, 데모 전용 신호를 끼운 하위 ctx 를 넘긴다.
  const demoCtx = { ...ctx, signal: ac.signal };

  /** 정답 버튼을 잠시 뒤 눌러 주는 유령 입력 */
  const ghost = (_k, correctButton) => {
    const t = setTimeout(() => {
      timers.delete(t);
      if (!ac.signal.aborted) ctx.input.injectPress(correctButton);
    }, GHOST_DELAY_MS);
    timers.add(t);
  };

  try {
    let i = 0;
    while (!ac.signal.aborted) {
      const level = DEMO_LEVELS[i % DEMO_LEVELS.length];
      i++;

      const state = { game: GAME_COLOR, level, lives: CONFIG.LIVES };
      const round = buildRound(GAME_COLOR, level);

      await presentScene(demoCtx, state, round);
      const result = await recallScene(demoCtx, state, round, { onReady: ghost });
      if (result.cleared) await levelClearScene(demoCtx, state);
      await sleep(600, ac.signal);
    }
  } catch (err) {
    // 사람이 눌러서 중단된 것도, 전역 이탈도 결국 "타이틀로" 이므로 삼킨다.
    if (!isExit(err)) throw err;
  } finally {
    off();
    for (const t of timers) clearTimeout(t);
    badge.remove();
    hint.remove();
    guideBox.remove();
    ctx.input.reset();
    // 데모를 깨운 그 입력이 타이틀에서 곧바로 게임을 시작시키지 않도록 한 박자 쉰다.
    await sleep(150).catch(() => {});
  }

  ctx.audio.unlock();
}
