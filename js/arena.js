/**
 * arena.js — 두 좌석을 묶는 심판. 도전 신청/수락과 대결 진행을 맡는다.
 *
 * 도전 흐름 (흰색 버튼)
 *   1. 한쪽(도전자)이 흰색을 누른다 — 타이틀·선택·데모·결과 화면처럼 놀고 있지 않을 때만.
 *   2. 상대 화면에 "도전에 응하시겠습니까?"가 CHALLENGE_MS(10초) 동안 뜬다.
 *      상대는 하던 것을 그대로 계속할 수 있다. 흰색이 아닌 버튼을 누를 때마다
 *      남은 시간이 CHALLENGE_PENALTY_MS 씩 빨리 줄어든다 — "바빠요"의 뜻.
 *   3. 상대가 흰색을 누르면 수락. 두 좌석의 혼자 놀기를 멈추고(진행 중이던 판은
 *      '중도 이탈'로 기록) 대결로 들어간다. 시간이 다 되면 도전자에게 "응하지 않았어요".
 *
 * 대결 (규칙은 versus.js)
 *   게임 고르기(먼저 누르는 쪽) → 안내 → 라운드 반복(같은 문제 동시 제시 → 회상 경주
 *   → 라운드 결과) → 최종 결과 → 두 좌석 모두 타이틀로.
 *   어느 좌석이든 빨+파 홀드로 대결을 통째로 끝낼 수 있다.
 */
import { CONFIG } from './config.js';
import { STR } from './strings.js';
import { buildRound, GAME_MIXED } from './games.js';
import { isExit, sleep, waitButton, mount, ExitToTitle } from './util.js';
import { linked } from './state.js';
import { startRun, finishRun } from './playlog.js';
import {
  createMatch, currentLength, isSuddenDeath, applyRound, matchStatus, judgeRace, shrinkChallenge,
} from './versus.js';
import { presentScene } from './scenes/present.js';
import { recallScene } from './scenes/recall.js';
import {
  createChallengeIncoming, createChallengeOutgoing, toast, pickSceneNode,
  versusIntroScene, createVersusBar, versusWaitScene, versusRoundScene, versusResultScene,
} from './scenes/versus.js';

/** 도전을 걸어도 되는 화면 — 놀고 있는 중(play)이나 운영자 화면이면 안 된다 */
const IDLE_PHASES = new Set(['title', 'attract', 'select', 'gameover', 'allclear']);

/**
 * @param {Array<{index: number, root: HTMLElement, overlay: HTMLElement,
 *   input: import('./input.js').InputManager, audio: import('./audio.js').Audio,
 *   phase: string, run: () => Promise<void>, halt: () => Promise<void>}>} seats
 */
export function createArena(seats) {
  /** 'idle' | 'pending' | 'match' */
  let status = 'idle';

  for (const seat of seats) {
    seat.input.onWhite(() => onWhite(seat.index));
  }

  function onWhite(from) {
    if (status !== 'idle') return;
    const challenger = seats[from];
    const target = seats[1 - from];
    if (!IDLE_PHASES.has(challenger.phase)) return;   // 놀고 있는 중엔 도전 못 건다
    if (target.phase === 'admin') return;
    challenge(challenger, target);
  }

  /**
   * 도전 프롬프트. 수락되면 대결로, 아니면 조용히 사라진다.
   */
  async function challenge(challenger, target) {
    status = 'pending';
    const total = CONFIG.CHALLENGE_MS;
    let remaining = total;
    let accepted = false;

    const incoming = createChallengeIncoming();
    const outgoing = createChallengeOutgoing();
    target.overlay.append(incoming);
    challenger.overlay.append(outgoing);
    target.audio.unlock();
    target.audio.challenge();
    challenger.audio.blip();

    // 상대: 흰색 = 수락, 다른 버튼 = 시간이 빨리 줄어든다
    const offWhite = target.input.onWhite(() => { accepted = true; });
    const offOther = target.input.onButton(() => {
      remaining = shrinkChallenge(remaining, CONFIG.CHALLENGE_PENALTY_MS);
    });

    let last = performance.now();
    while (remaining > 0 && !accepted) {
      await sleep(50);
      const now = performance.now();
      remaining = Math.max(0, remaining - (now - last));
      last = now;
      incoming.setRemaining(remaining, total);
      outgoing.setRemaining(remaining, total);
    }
    offWhite();
    offOther();
    incoming.remove();
    outgoing.remove();

    if (!accepted) {
      status = 'idle';
      challenger.audio.challengeDeclined();
      toast(challenger.overlay, STR.CHALLENGE_DECLINED, CONFIG.CHALLENGE_DECLINED_MS);
      return;
    }

    status = 'match';
    for (const s of seats) {
      s.audio.challengeAccepted();
      toast(s.overlay, STR.CHALLENGE_ACCEPTED, 1200);
    }
    try {
      // 두 좌석의 혼자 놀기를 멈춘다. 진행 중이던 판은 '중도 이탈'로 기록된다.
      await Promise.all(seats.map((s) => s.halt()));
      await runMatch();
    } catch (err) {
      console.error('[torus-memory] 대결 중 오류', err);
    } finally {
      status = 'idle';
      for (const s of seats) {
        s.input.exitComboEnabled = false;
        s.input.reset();
        s.run();
      }
    }
  }

  /**
   * 대결 한 판. 어느 좌석이든 빨+파 홀드로 끝낼 수 있다 (신호 하나를 둘이 같이 쓴다).
   */
  async function runMatch() {
    const ac = new AbortController();
    const offExits = seats.map((s) => {
      s.input.exitComboEnabled = true;
      return s.input.onExit(() => ac.abort());
    });
    const ctxs = seats.map((s) => ({
      root: s.root, overlay: s.overlay, input: s.input, audio: s.audio, signal: ac.signal,
    }));
    const run = startRun(GAME_MIXED);   // 게임 종류는 고른 뒤에 바꾼다
    let match = createMatch({ rounds: CONFIG.VS_ROUNDS, winPoints: CONFIG.VS_WIN_POINTS });
    let game = GAME_MIXED;

    try {
      game = await pickGame(ctxs);
      run.g = game;
      await Promise.all(ctxs.map((c) => versusIntroScene(c, game)));

      const bars = seats.map((s) => {
        const bar = createVersusBar();
        s.overlay.append(bar);
        return bar;
      });
      const refreshBars = () => {
        bars.forEach((bar, i) => bar.set({
          me: match.scores[i], opp: match.scores[1 - i],
          round: match.index + 1, total: match.rounds.length, sudden: isSuddenDeath(match),
        }));
      };

      try {
        for (;;) {
          refreshBars();
          const winner = await playRound(ctxs, bars, game, match);
          const before = match;
          match = applyRound(match, winner);
          const st = matchStatus(match);
          refreshBars();

          await Promise.all(ctxs.map((c, i) => versusRoundScene(c, {
            outcome: winner === null ? 'draw' : (winner === i ? 'won' : 'lost'),
            sudden: st.suddenDeath && !isSuddenDeath(before),
            me: match.scores[i], opp: match.scores[1 - i],
          })));

          if (st.done) {
            finishRun(run, {
              level: match.index, round: 1, result: 'vs', winner: st.winner,
            });
            // 어느 쪽이든 버튼을 누르면 둘 다 끝난다 — 한쪽만 남아 기다리지 않게
            await untilFirst(ctxs, (c, i) => versusResultScene(c, {
              won: st.winner === i, me: match.scores[i], opp: match.scores[1 - i],
            }));
            return;
          }
        }
      } finally {
        bars.forEach((b) => b.remove());
      }
    } catch (err) {
      if (!isExit(err)) throw err;
      // 빨+파로 중단 — 기록은 남기지 않는다
    } finally {
      offExits.forEach((off) => off());
    }
  }

  /**
   * 게임 고르기 — 두 화면에 같은 카드. 아무 좌석이나 먼저 누른 색이 정한다.
   * VS_PICK_MS 안에 아무도 안 누르면 혼합.
   */
  async function pickGame(ctxs) {
    for (const c of ctxs) mount(c.root, pickSceneNode());
    // 좌석마다 대기를 걸고, 하나가 끝나면 나머지는 끊는다 — 남은 대기가
    // 다음 화면의 첫 버튼을 삼키면 안 된다.
    const acs = ctxs.map((c) => linked(c.signal));
    const picks = ctxs.map((c, i) =>
      waitButton(c.input, acs[i].signal, { timeoutMs: CONFIG.VS_PICK_MS })
        .catch((err) => { if (isExit(err) && !c.signal.aborted) return undefined; throw err; }));
    let ev;
    try {
      ev = await Promise.race(picks);
    } finally {
      acs.forEach((a) => { a.abort(); a.release(); });
      await Promise.allSettled(picks);
    }
    const game = ev == null ? GAME_MIXED : ev.id + 1;
    for (const c of ctxs) { c.audio.gamePick(game); c.input.reset(); }
    return game;
  }

  /**
   * 라운드 하나 — 같은 문제를 두 좌석에 동시에 제시하고 회상을 경주시킨다.
   * @returns {Promise<0|1|null>} 이긴 좌석, 무효면 null
   */
  async function playRound(ctxs, bars, game, match) {
    const len = currentLength(match);
    const round = buildRound(game, len, {
      digitMin: CONFIG.DIGIT_MIN, digitMax: CONFIG.DIGIT_MAX, shapes: CONFIG.SHAPES,
    });
    const state = { game, level: len, round: match.index + 1, lives: 0, versus: true };
    bars.forEach((b) => b.setOpponent(0, len));
    // 검증 자동화가 정답을 읽을 수 있게 (?debug=1 일 때만 존재)
    if (globalThis.__torus) globalThis.__torus.round = round;

    await Promise.all(ctxs.map((c) => presentScene(c, state, round)));

    /** @type {import('./versus.js').SeatRecall[]} */
    const results = [{ state: 'pending' }, { state: 'pending' }];
    const acs = ctxs.map((c) => linked(c.signal));
    let settle;
    const decided = new Promise((resolve) => { settle = resolve; });

    const check = () => {
      const j = judgeRace(results[0], results[1]);
      if (j.decided) settle(j.winner);
    };

    const runs = ctxs.map(async (c, i) => {
      const seatCtx = { ...c, signal: acs[i].signal };
      try {
        const res = await recallScene(seatCtx, state, round, {
          onProgress: (done, total) => bars[1 - i].setOpponent(done, total),
        });
        results[i] = { state: res.cleared ? 'cleared' : 'failed', at: performance.now() };
        check();
        if (!res.cleared) {
          // 틀렸다 — 상대가 끝날 때까지 기다리는 화면. 결정되면 arena 가 끊는다.
          await versusWaitScene(seatCtx);
        }
      } catch (err) {
        if (!isExit(err)) throw err;
        // 라운드가 결정되어 끊긴 것 — 정상. 바깥(빨+파) 중단이면 아래에서 다시 던진다.
        if (c.signal.aborted) throw err;
      }
    });

    // 빨+파로 대결이 통째로 끊기면 결정을 기다리지 않고 바로 빠져나온다.
    const outer = ctxs[0].signal;
    let onOuterAbort;
    const aborted = new Promise((_, reject) => {
      onOuterAbort = () => reject(new ExitToTitle());
      if (outer.aborted) onOuterAbort();
      else outer.addEventListener('abort', onOuterAbort, { once: true });
    });

    let winner;
    try {
      winner = await Promise.race([decided, aborted]);
    } finally {
      outer.removeEventListener('abort', onOuterAbort);
      acs.forEach((a) => a.abort());
      await Promise.allSettled(runs);
      acs.forEach((a) => a.release());
      for (const c of ctxs) c.input.reset();
    }
    return winner;
  }

  /**
   * 두 좌석에 같은 씬을 띄우고, 하나가 끝나는 순간 나머지를 끊는다.
   * 바깥(빨+파) 중단은 그대로 위로 던진다.
   */
  async function untilFirst(ctxs, fn) {
    const acs = ctxs.map((c) => linked(c.signal));
    const runs = ctxs.map((c, i) =>
      fn({ ...c, signal: acs[i].signal }, i)
        .catch((err) => { if (isExit(err) && !c.signal.aborted) return undefined; throw err; }));
    try {
      await Promise.race(runs);
    } finally {
      acs.forEach((a) => a.abort());
      await Promise.allSettled(runs);
      acs.forEach((a) => a.release());
    }
    if (ctxs[0].signal.aborted) throw new ExitToTitle();
  }

  return { get status() { return status; } };
}
