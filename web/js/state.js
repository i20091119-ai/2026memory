/**
 * state.js — 게임 상태 머신 (설계명세서 §3.1).
 *
 * TITLE ─(아무 버튼)→ GAME_INTRO(i) → LEVEL(n) → PRESENT → RECALL →
 *   ├ 전부 정답 → LEVEL_CLEAR → 다음 단계 / 다음 차수 / ALL_CLEAR
 *   └ 오답 → MISS, 목숨-1 → 재도전 / GAME_OVER(컨티뉴)
 *
 * 전역: 플레이 중 빨강+파랑 2초 홀드 → 즉시 TITLE.
 */
import { CONFIG, CHEAT } from './config.js';
import { buildRound, nextAfterClear, nextAfterMiss, compareRecord } from './games.js';
import { isExit } from './util.js';
import { submitRecord, bumpAllClear } from './storage.js';

import { titleScene } from './scenes/title.js';
import { introScene } from './scenes/intro.js';
import { presentScene } from './scenes/present.js';
import { recallScene } from './scenes/recall.js';
import { levelClearScene, missScene } from './scenes/feedback.js';
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

    const start = pendingCheat ?? { game: 1, level: 1 };
    pendingCheat = null;
    await playCourse(base, start);
  }
}

/**
 * 코스 한 판. 게임오버에서 컨티뉴를 고르면 같은 판 안에서 이어진다.
 * @param {Omit<Ctx, 'signal'>} base
 * @param {{game: number, level: number}} start
 */
async function playCourse(base, start) {
  let game = start.game;
  let level = start.level;
  let lives = CONFIG.LIVES;
  /** 이번 판에서 도달한 가장 좋은 지점 */
  let reached = { game, level };

  for (;;) {
    // 중도 이탈(빨+파 2초)은 판 단위로 신호를 새로 건다.
    const ac = new AbortController();
    const ctx = { ...base, signal: ac.signal };
    ctx.input.exitComboEnabled = true;
    const offExit = ctx.input.onExit(() => ac.abort());

    let outcome;
    try {
      outcome = await runFrom(ctx, { game, level, lives, reached });
    } catch (err) {
      if (!isExit(err)) throw err;
      // 중도 이탈 — 기록만 남기고 타이틀로
      submitRecord(reached.game, reached.level);
      return;
    } finally {
      offExit();
      ctx.input.exitComboEnabled = false;
      ctx.input.reset();
    }

    reached = outcome.reached;

    if (outcome.kind === 'allClear') {
      const record = submitRecord(reached.game, reached.level);
      const best = bumpAllClear();
      await safeScene(base, (ctx2) => allClearScene(ctx2, { updated: record.updated, best }));
      return;
    }

    // 게임 오버 → 컨티뉴 선택
    const record = submitRecord(reached.game, reached.level);
    const choice = await safeScene(base, (ctx2) =>
      gameOverScene(ctx2, reached, { updated: record.updated, best: record.best }));

    if (choice === 'continue') {
      // 죽은 차수의 1단계부터, 목숨 3 회복
      game = outcome.diedAt.game;
      level = 1;
      lives = CONFIG.LIVES;
      reached = { game, level };
      continue;
    }
    if (choice === 'restart') {
      game = 1; level = 1; lives = CONFIG.LIVES;
      reached = { game, level };
      continue;
    }
    return; // 'title'
  }
}

/**
 * 주어진 지점부터 게임오버나 올클리어가 나올 때까지 진행한다.
 * @param {Ctx} ctx
 * @param {{game: number, level: number, lives: number, reached: {game:number,level:number}}} init
 * @returns {Promise<{kind: 'allClear'|'gameOver', reached: object, diedAt: object}>}
 */
async function runFrom(ctx, init) {
  let { game, level, lives, reached } = init;
  let needIntro = true;

  for (;;) {
    const state = { game, level, lives };

    if (needIntro) {
      await introScene(ctx, state);
      needIntro = false;
    }

    // 도달 기록 갱신 — 단계에 "들어선" 시점 기준
    if (compareRecord({ game, level }, reached) > 0) reached = { game, level };

    const round = buildRound(game, level, {
      digitMin: CONFIG.DIGIT_MIN,
      digitMax: CONFIG.DIGIT_MAX,
      shapes: CONFIG.SHAPES,
    });

    await presentScene(ctx, state, round);
    const result = await recallScene(ctx, state, round);

    if (result.cleared) {
      await levelClearScene(ctx, state);
      const next = nextAfterClear(game, level, {
        levelsPerGame: CONFIG.LEVELS_PER_GAME,
        totalGames: CONFIG.TOTAL_GAMES,
      });

      if (next.kind === 'allClear') {
        reached = { game, level };
        return { kind: 'allClear', reached, diedAt: { game, level } };
      }
      game = next.game;
      level = next.level;
      needIntro = next.kind === 'nextGame';
      continue;
    }

    // 오답 — 정답 공개 후 목숨 차감
    await missScene(ctx, state, {
      expectedValue: result.expectedValue,
      expectedColor: round.presentColors ? round.presentColors[result.failedIndex] : null,
    });

    const after = nextAfterMiss(lives);
    lives = after.lives;

    if (after.kind === 'gameOver') {
      return { kind: 'gameOver', reached, diedAt: { game, level } };
    }
    // 같은 단계를 새 시퀀스로 재도전 (다음 루프에서 buildRound 가 다시 돌아간다)
  }
}

/**
 * 중도 이탈이 의미 없는 씬(게임오버·올클리어)을 안전하게 실행한다.
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
