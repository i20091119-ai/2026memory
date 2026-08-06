/**
 * state.js — 게임 상태 머신 (구조 v2).
 *
 * TITLE ─(아무 버튼)→ SELECT(게임 고르기) → GAME_INTRO → 라운드 반복:
 *   PRESENT → RECALL →
 *     ├ 전부 정답 → ROUND_CLEAR → 다음 라운드(5회) / 다음 단계(1~4개) / 완주
 *     └ 오답 → MISS, 목숨-1 → 같은 라운드 재도전 / GAME_OVER(컨티뉴)
 *
 * 전역: 플레이 중 빨강+파랑 2초 홀드 → 즉시 TITLE.
 */
import { CONFIG, CHEAT } from './config.js';
import { buildRound, nextAfterClear, nextAfterMiss, compareRecord } from './games.js';
import { isExit } from './util.js';
import { submitRecord, bumpAllClear } from './storage.js';

import { titleScene } from './scenes/title.js';
import { selectScene } from './scenes/select.js';
import { introScene } from './scenes/intro.js';
import { presentScene } from './scenes/present.js';
import { recallScene } from './scenes/recall.js';
import { roundClearScene, missScene } from './scenes/feedback.js';
import { gameOverScene } from './scenes/gameover.js';
import { allClearScene } from './scenes/allclear.js';
import { attractScene } from './scenes/attract.js';

/**
 * @typedef {{root: HTMLElement, overlay: HTMLElement,
 *            input: import('./input.js').InputManager,
 *            audio: import('./audio.js').Audio,
 *            signal: AbortSignal}} Ctx
 */

/**
 * 앱 최상위 루프. 절대 끝나지 않는다 (키오스크).
 * @param {Omit<Ctx, 'signal'>} base
 */
export async function runApp(base) {
  // 첫 실행이 URL 치트로 시작하는지 기억해 둔다 (한 번만 적용).
  let pendingCheat = CHEAT;

  for (;;) {
    const idle = { ...base, signal: neverAbort() };

    let action;
    try {
      action = pendingCheat ? 'start' : await titleScene(idle);
    } catch (err) {
      if (!isExit(err)) throw err;
      continue;
    }

    if (action === 'attract') {
      await attractScene(idle);
      continue;
    }

    // 게임 선택 → 플레이. 게임오버에서 "다른 게임 고르기"를 누르면
    // 타이틀을 거치지 않고 선택 화면으로 곧장 돌아온다.
    for (;;) {
      let start;
      if (pendingCheat) {
        start = pendingCheat;
        pendingCheat = null;
      } else {
        const picked = await safeScene(base, (ctx2) => selectScene(ctx2));
        if (picked === 'title' || picked === undefined) break;
        start = { game: picked, level: 1, round: 1 };
      }

      const outcome = await playCourse(base, start);
      if (outcome !== 'select') break; // 'title'
    }
  }
}

/**
 * 고른 게임 한 판. 게임오버에서 컨티뉴를 고르면 같은 판 안에서 이어진다.
 * @param {Omit<Ctx, 'signal'>} base
 * @param {{game: number, level: number, round: number}} start
 * @returns {Promise<'title'|'select'>} 다음에 보여 줄 화면
 */
async function playCourse(base, start) {
  const game = start.game;
  let level = start.level;
  let round = start.round;
  let lives = CONFIG.LIVES;
  /** 이번 판에서 도달한 가장 좋은 지점 */
  let reached = { level, round };

  for (;;) {
    // 중도 이탈(빨+파 2초)은 판 단위로 신호를 새로 건다.
    const ac = new AbortController();
    const ctx = { ...base, signal: ac.signal };
    ctx.input.exitComboEnabled = true;
    const offExit = ctx.input.onExit(() => ac.abort());

    let outcome;
    try {
      outcome = await runFrom(ctx, { game, level, round, lives, reached });
    } catch (err) {
      if (!isExit(err)) throw err;
      // 중도 이탈 — 기록만 남기고 타이틀로
      submitRecord(game, reached);
      return 'title';
    } finally {
      offExit();
      ctx.input.exitComboEnabled = false;
      ctx.input.reset();
    }

    reached = outcome.reached;

    if (outcome.kind === 'allClear') {
      const record = submitRecord(game, reached);
      const best = bumpAllClear(game);
      await safeScene(base, (ctx2) =>
        allClearScene(ctx2, { game, updated: record.updated, clearCount: best.clearCount }));
      return 'title';
    }

    // 게임 오버 → 컨티뉴 선택
    const record = submitRecord(game, reached);
    const choice = await safeScene(base, (ctx2) =>
      gameOverScene(ctx2, { game, ...reached }, record));

    if (choice === 'continue') {
      // 죽은 단계의 1라운드부터, 목숨 3 회복
      level = outcome.diedAt.level;
      round = 1;
      lives = CONFIG.LIVES;
      continue;
    }
    if (choice === 'select') return 'select';
    return 'title';
  }
}

/**
 * 주어진 지점부터 게임오버나 완주가 나올 때까지 진행한다.
 * @param {Ctx} ctx
 * @param {{game: number, level: number, round: number, lives: number,
 *          reached: {level: number, round: number}}} init
 * @returns {Promise<{kind: 'allClear'|'gameOver', reached: object, diedAt: object}>}
 */
async function runFrom(ctx, init) {
  let { game, level, round, lives, reached } = init;
  let needIntro = true;

  for (;;) {
    const state = { game, level, round, lives };

    if (needIntro) {
      await introScene(ctx, state);
      needIntro = false;
    }

    // 도달 기록 갱신 — 라운드에 "들어선" 시점 기준
    if (compareRecord({ level, round }, reached) > 0) reached = { level, round };

    const roundData = buildRound(game, level, {
      digitMin: CONFIG.DIGIT_MIN,
      digitMax: CONFIG.DIGIT_MAX,
      shapes: CONFIG.SHAPES,
    });

    await presentScene(ctx, state, roundData);
    const result = await recallScene(ctx, state, roundData);

    if (result.cleared) {
      const next = nextAfterClear(level, round, {
        levels: CONFIG.LEVELS,
        roundsPerLevel: CONFIG.ROUNDS_PER_LEVEL,
      });

      if (next.kind === 'allClear') {
        await roundClearScene(ctx, state);
        reached = { level, round };
        return { kind: 'allClear', reached, diedAt: { level, round } };
      }
      // 단계가 올라가면 "이제 n개 기억!"으로 승급을 알린다.
      await roundClearScene(ctx, state,
        next.kind === 'nextLevel' ? { levelUp: next.level } : {});
      level = next.level;
      round = next.round;
      continue;
    }

    // 오답 — 정답 공개 후 목숨 차감
    await missScene(ctx, state, { expectedItem: result.expectedItem });

    const after = nextAfterMiss(lives);
    lives = after.lives;

    if (after.kind === 'gameOver') {
      return { kind: 'gameOver', reached, diedAt: { level, round } };
    }
    // 같은 라운드를 새 시퀀스로 재도전 (다음 루프에서 buildRound 가 다시 돌아간다)
  }
}

/**
 * 중도 이탈이 의미 없는 씬(선택·게임오버·완주)을 안전하게 실행한다.
 * @template T
 * @param {Omit<Ctx, 'signal'>} base
 * @param {(ctx: Ctx) => Promise<T>} fn
 * @returns {Promise<T|undefined>}
 */
async function safeScene(base, fn) {
  const ctx = { ...base, signal: neverAbort() };
  try {
    return await fn(ctx);
  } catch (err) {
    if (isExit(err)) return undefined;
    throw err;
  }
}

/** 절대 중단되지 않는 신호 — 타이틀·결과 화면처럼 이탈 개념이 없는 곳에서 쓴다. */
function neverAbort() {
  return new AbortController().signal;
}
