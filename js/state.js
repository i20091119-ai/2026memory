/**
 * state.js — 게임 상태 머신 (구조 v2). 좌석 하나의 혼자 놀기 루프다.
 *
 * TITLE ─(아무 버튼)→ SELECT(게임 고르기) → GAME_INTRO → 라운드 반복:
 *   PRESENT → RECALL →
 *     ├ 전부 정답 → ROUND_CLEAR → 다음 라운드(5회) / 다음 단계(1~4개) / 완주
 *     └ 오답 → MISS, 목숨-1 → 같은 라운드 재도전 / GAME_OVER(컨티뉴)
 *
 * 전역: 플레이 중 빨강+파랑 2초 홀드 → 즉시 TITLE.
 *       타이틀에서 노랑+초록 3초 홀드 → ADMIN(운영 기록) → TITLE.
 *
 * 바깥 신호(opts.signal)가 중단되면 어느 화면에 있든 루프를 빠져나와 돌아온다.
 * 옆 좌석과의 대결이 시작될 때 arena.js 가 이렇게 두 좌석의 혼자 놀기를 멈춘다.
 * 지금 어느 화면인지는 base.onPhase 로 알린다 (도전을 걸어도 되는 때인지 판단용).
 *
 * 판(playCourse)마다 플레이 기록 한 줄을 남긴다 (playlog.js).
 */
import { CONFIG, CHEAT } from './config.js';
import { buildRound, nextAfterClear, nextAfterMiss, compareRecord } from './games.js';
import { isExit } from './util.js';
import { bumpAllClear } from './storage.js';
import { startRun, finishRun } from './playlog.js';

import { titleScene } from './scenes/title.js';
import { adminScene } from './scenes/admin.js';
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
 * 좌석 하나의 혼자 놀기 루프. 바깥 신호가 중단될 때까지 돌고, 중단되면 돌아온다.
 * @param {Omit<Ctx, 'signal'> & {onPhase?: (phase: string) => void}} base
 * @param {{signal?: AbortSignal, cheat?: boolean}} [opts]
 *   cheat: URL 치트를 이 루프에 적용할지 (좌석이 둘이면 왼쪽만 true)
 */
export async function runApp(base, opts = {}) {
  const outer = opts.signal ?? new AbortController().signal;
  const app = { ...base, outer };
  const phase = (p) => base.onPhase?.(p);

  // 첫 실행이 URL 치트로 시작하는지 기억해 둔다 (한 번만 적용).
  let pendingCheat = opts.cheat === false ? null : CHEAT;

  for (;;) {
    if (outer.aborted) return;

    let action;
    if (pendingCheat) {
      action = 'start';
    } else {
      // 타이틀은 운영자 콤보로 중단될 수 있다. 중단되면 운영 기록 화면으로.
      phase('title');
      const ac = linked(outer);
      let adminWanted = false;
      const offAdmin = base.input.onAdmin(() => { adminWanted = true; ac.abort(); });
      try {
        action = await titleScene({ ...base, signal: ac.signal });
      } catch (err) {
        if (!isExit(err)) throw err;
        action = adminWanted ? 'admin' : 'title';
      } finally {
        offAdmin();
        ac.release();
      }
    }

    if (outer.aborted) return;
    if (action === 'title') continue;

    if (action === 'admin') {
      phase('admin');
      await safeScene(app, (ctx2) => adminScene(ctx2));
      continue;
    }

    if (action === 'attract') {
      phase('attract');
      await safeScene(app, (ctx2) => attractScene(ctx2));
      continue;
    }

    // 게임 선택 → 플레이. 게임오버에서 "다른 게임 고르기"를 누르면
    // 타이틀을 거치지 않고 선택 화면으로 곧장 돌아온다.
    for (;;) {
      if (outer.aborted) return;
      let start;
      if (pendingCheat) {
        // 개발용 치트로 시작한 판은 기록에 남기지 않는다
        start = { ...pendingCheat, cheat: true };
        pendingCheat = null;
      } else {
        phase('select');
        const picked = await safeScene(app, (ctx2) => selectScene(ctx2));
        if (picked === 'title' || picked === undefined) break;
        start = { game: picked, level: 1, round: 1 };
      }

      const outcome = await playCourse(app, start);
      if (outcome !== 'select') break; // 'title'
    }
  }
}

/**
 * 고른 게임 한 판. 게임오버에서 컨티뉴를 고르면 같은 판 안에서 이어진다.
 * @param {object} app runApp 이 만든 좌석 컨텍스트 (outer 신호 포함)
 * @param {{game: number, level: number, round: number, cheat?: boolean}} start
 * @returns {Promise<'title'|'select'>} 다음에 보여 줄 화면
 */
async function playCourse(app, start) {
  const phase = (p) => app.onPhase?.(p);
  const game = start.game;
  let level = start.level;
  let round = start.round;
  let lives = CONFIG.LIVES;
  /**
   * 이번 판의 진행 상황. runFrom 이 직접 갱신한다 — 중도 이탈로 예외가 튀어도
   * 어디까지 갔는지가 남아 있어야 기록에 적을 수 있다.
   *   reached  도달한 가장 먼 지점 (게임오버 화면 표시 + 기록)
   *   misses   오답 횟수 (기록)
   */
  const progress = { reached: { level, round }, misses: 0 };
  let continues = 0;
  const run = start.cheat ? null : startRun(game);
  const record = (result) => finishRun(run, {
    level: progress.reached.level,
    round: progress.reached.round,
    result,
    continues,
    misses: progress.misses,
  });

  for (;;) {
    // 중도 이탈(빨+파 2초)은 판 단위로 신호를 새로 건다.
    const ac = linked(app.outer);
    const ctx = { ...app, signal: ac.signal };
    ctx.input.exitComboEnabled = true;
    const offExit = ctx.input.onExit(() => ac.abort());
    phase('play');

    let outcome;
    try {
      outcome = await runFrom(ctx, { game, level, round, lives, progress });
    } catch (err) {
      if (!isExit(err)) throw err;
      record('quit');
      return 'title';
    } finally {
      offExit();
      ac.release();
      ctx.input.exitComboEnabled = false;
      ctx.input.reset();
    }

    if (outcome.kind === 'allClear') {
      record('clear');
      const clearCount = bumpAllClear(game);
      phase('allclear');
      await safeScene(app, (ctx2) => allClearScene(ctx2, { game, clearCount }));
      return 'title';
    }

    // 게임 오버 → 컨티뉴 선택
    phase('gameover');
    const choice = await safeScene(app, (ctx2) =>
      gameOverScene(ctx2, { game, ...progress.reached }));

    if (choice === 'continue') {
      // 죽은 단계의 1라운드부터, 목숨 3 회복. 같은 판으로 친다.
      continues++;
      level = outcome.diedAt.level;
      round = 1;
      lives = CONFIG.LIVES;
      continue;
    }
    record('over');
    if (choice === 'select') return 'select';
    return 'title';
  }
}

/**
 * 주어진 지점부터 게임오버나 완주가 나올 때까지 진행한다.
 * @param {Ctx} ctx
 * @param {{game: number, level: number, round: number, lives: number,
 *          progress: {reached: {level: number, round: number}, misses: number}}} init
 * @returns {Promise<{kind: 'allClear'|'gameOver', diedAt: object}>}
 */
async function runFrom(ctx, init) {
  let { game, level, round, lives } = init;
  const { progress } = init;
  let needIntro = true;

  for (;;) {
    const state = { game, level, round, lives };

    if (needIntro) {
      await introScene(ctx, state);
      needIntro = false;
    }

    // 도달 기록 갱신 — 라운드에 "들어선" 시점 기준
    if (compareRecord({ level, round }, progress.reached) > 0) progress.reached = { level, round };

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
        return { kind: 'allClear', diedAt: { level, round } };
      }
      // 단계가 올라가면 "이제 n개 기억!"으로 승급을 알린다.
      await roundClearScene(ctx, state,
        next.kind === 'nextLevel' ? { levelUp: next.level } : {});
      level = next.level;
      round = next.round;
      continue;
    }

    // 오답 — 정답 공개 후 목숨 차감
    progress.misses++;
    await missScene(ctx, state, { expectedItem: result.expectedItem });

    const after = nextAfterMiss(lives);
    lives = after.lives;

    if (after.kind === 'gameOver') {
      return { kind: 'gameOver', diedAt: { level, round } };
    }
    // 같은 라운드를 새 시퀀스로 재도전 (다음 루프에서 buildRound 가 다시 돌아간다)
  }
}

/**
 * 중도 이탈이 의미 없는 씬(선택·게임오버·완주)을 안전하게 실행한다.
 * 바깥 신호가 중단되면 그 씬도 함께 끝난다.
 * @template T
 * @param {{outer: AbortSignal}} app
 * @param {(ctx: Ctx) => Promise<T>} fn
 * @returns {Promise<T|undefined>}
 */
async function safeScene(app, fn) {
  const ac = linked(app.outer);
  const ctx = { ...app, signal: ac.signal };
  try {
    return await fn(ctx);
  } catch (err) {
    if (isExit(err)) return undefined;
    throw err;
  } finally {
    ac.release();
  }
}

/**
 * 바깥 신호에 딸린 AbortController. 바깥이 중단되면 같이 중단된다.
 * 씬이 끝나면 release() 로 바깥에 건 리스너를 떼어 낸다 — 좌석 하나가 하루에
 * 수백 씬을 돌므로 떼지 않으면 리스너가 쌓인다.
 * @param {AbortSignal} outer
 * @returns {AbortController & {release: () => void}}
 */
export function linked(outer) {
  const ac = new AbortController();
  const onAbort = () => ac.abort();
  if (outer.aborted) ac.abort();
  else outer.addEventListener('abort', onAbort, { once: true });
  ac.release = () => outer.removeEventListener('abort', onAbort);
  return ac;
}
