/**
 * scenes/recall.js — 회상(입력) 화면 (설계명세서 §3.3~§3.5).
 *
 * 1차: 4색 버튼 모형에 직접 입력.
 * 2·3차: 항목마다 4지선다 카드(빨/노/초/파 고정 순서) — 외운 값이 있는 칸의 색 버튼을 누른다.
 *
 * 어느 쪽이든 오답이 나오는 순간 즉시 종료한다 (남은 항목은 묻지 않는다).
 */
import { el, mount, sleep, waitButton, edgeFlash } from '../util.js';
import { STR } from '../strings.js';
import { CONFIG, COLORS } from '../config.js';
import { createHud } from './hud.js';
import { createShape } from '../shapes.js';
import { judgeStep, GAME_COLOR, GAME_DIGIT } from '../games.js';

/** 화면 요소를 직접 탭/클릭했을 때도 실제 버튼처럼 동작시킨다 (모바일 테스트용) */
function makeTappable(node, id, input) {
  node.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    input.emit('down', id, 'human');
  });
  const release = () => input.emit('up', id, 'human');
  node.addEventListener('pointerup', release);
  node.addEventListener('pointercancel', release);
  node.addEventListener('pointerleave', release);
  return node;
}

/**
 * @typedef {{cleared: boolean, failedIndex: number, expected: number,
 *            expectedValue: number|string}} RecallResult
 */

/**
 * @param {import('../state.js').Ctx} ctx
 * @param {{game: number, level: number, lives: number}} state
 * @param {ReturnType<import('../games.js').buildRound>} round
 * @param {{onReady?: (k: number, correctButton: number) => void}} [opts]
 *   onReady 는 어트랙트 데모가 유령 입력을 넣을 시점을 잡는 데 쓴다.
 * @returns {Promise<RecallResult>}
 */
export async function recallScene(ctx, state, round, opts = {}) {
  return state.game === GAME_COLOR
    ? recallByButtons(ctx, state, round, opts)
    : recallByChoices(ctx, state, round, opts);
}

/* ------------------------------------------------------------------ *
 * 1차 — 버튼 직접 입력
 * ------------------------------------------------------------------ */
async function recallByButtons(ctx, state, round, opts) {
  const total = round.answers.length;
  const hud = createHud(state);

  const pads = COLORS.map((color, id) => {
    const pad = el('button.pad', {
      type: 'button',
      style: { background: color },
      'aria-label': STR.COLOR_NAME[id],
    });
    return makeTappable(pad, id, ctx.input);
  });

  const node = el('section.scene.scene-recall.recall-color', {},
    hud,
    el('div.recall-body', {},
      el('h2.recall-prompt', { text: STR.RECALL_COLOR_PROMPT }),
      el('div.pad-row', {}, ...pads),
    ),
  );
  mount(ctx.root, node);
  hud.setProgress(0, total);

  for (let k = 0; k < total; k++) {
    opts.onReady?.(k, round.answers[k]);

    const ev = await waitButton(ctx.input, ctx.signal, {
      timeoutMs: CONFIG.INPUT_TIMEOUT_MS,
    });
    // INPUT_TIMEOUT_MS 가 0(무제한)이면 null 이 올 수 없지만, 값을 켰을 때를 대비.
    if (ev === null) {
      return { cleared: false, failedIndex: k, expected: round.answers[k], expectedValue: round.sequence[k] };
    }

    const { ok, done } = judgeStep(round.answers, k, ev.id);
    const pad = pads[ev.id];

    // 눌림 애니메이션 + 톤 (§3.3)
    pad.classList.remove('press');
    void pad.offsetWidth;
    pad.classList.add('press');
    ctx.audio.press(state.game, ev.id);

    if (!ok) {
      pad.classList.add('wrong');
      pads[round.answers[k]].classList.add('reveal');
      edgeFlash(node, 'wrong');
      // 눌러야 했던 패드를 잠깐이라도 보여 주고 나서 MISS 씬으로 넘긴다.
      // (바로 return 하면 강조 연출이 한 프레임도 보이지 않는다)
      await sleep(CONFIG.FEEDBACK_MS, ctx.signal);
      return {
        cleared: false, failedIndex: k,
        expected: round.answers[k], expectedValue: round.sequence[k],
      };
    }

    hud.setProgress(k + 1, total);
    if (done) {
      await sleep(CONFIG.FEEDBACK_MS, ctx.signal);
      return { cleared: true, failedIndex: -1, expected: -1, expectedValue: null };
    }
  }

  return { cleared: true, failedIndex: -1, expected: -1, expectedValue: null };
}

/* ------------------------------------------------------------------ *
 * 2·3차 — 4지선다
 * ------------------------------------------------------------------ */

/** 카드 한 장의 내용물 (숫자 또는 흰색 모양 실루엣) */
function cardContent(game, value) {
  return game === GAME_DIGIT
    ? el('span.card-digit', { text: String(value) })
    : el('span.card-shape', {}, createShape(value, { size: '68%', color: '#fff' }));
}

async function recallByChoices(ctx, state, round, opts) {
  const total = round.answers.length;
  const hud = createHud(state);
  const prompt = el('h2.recall-prompt');
  const cardRow = el('div.card-row');

  const node = el('section.scene.scene-recall.recall-choice', {},
    hud,
    el('div.recall-body', {}, prompt, cardRow),
  );
  mount(ctx.root, node);
  hud.setProgress(0, total);

  const promptText = state.game === GAME_DIGIT ? STR.RECALL_DIGIT_PROMPT : STR.RECALL_SHAPE_PROMPT;

  for (let k = 0; k < total; k++) {
    prompt.textContent = promptText(k);

    // 카드 4장을 빨/노/초/파 고정 순서로 세운다. 인덱스 = 눌러야 할 버튼.
    const cards = round.choices[k].map((value, id) => {
      const card = el('button.card', {
        type: 'button',
        // 카드가 좌→우로 차례차례 올라오는 등장 연출.
        // 등장 애니메이션이 시작되기 전에 지연값을 넣어야 해서 생성 시점에 지정한다.
        style: { background: COLORS[id], animationDelay: `${id * 45}ms` },
        'aria-label': `${STR.COLOR_NAME[id]} 칸`,
      }, cardContent(state.game, value));
      return makeTappable(card, id, ctx.input);
    });
    cardRow.replaceChildren(...cards);

    opts.onReady?.(k, round.answers[k]);

    const ev = await waitButton(ctx.input, ctx.signal, {
      timeoutMs: CONFIG.INPUT_TIMEOUT_MS,
    });
    if (ev === null) {
      return { cleared: false, failedIndex: k, expected: round.answers[k], expectedValue: round.sequence[k] };
    }

    const { ok, done } = judgeStep(round.answers, k, ev.id);
    ctx.audio.press(state.game, ev.id);
    cards[ev.id].classList.add('press');

    if (!ok) {
      cards[ev.id].classList.add('wrong');
      cards[round.answers[k]].classList.add('reveal');
      edgeFlash(node, 'wrong');
      // 정답 카드를 잠깐 보여 주고 나서 MISS 씬으로 (바로 return 하면 안 보인다)
      await sleep(CONFIG.FEEDBACK_MS, ctx.signal);
      return {
        cleared: false, failedIndex: k,
        expected: round.answers[k], expectedValue: round.sequence[k],
      };
    }

    // 정답 카드 강조 연출 400ms 후 다음 항목으로 (§3.4)
    cards[ev.id].classList.add('correct');
    edgeFlash(node, 'correct');
    ctx.audio.correct();
    hud.setProgress(k + 1, total);
    await sleep(CONFIG.FEEDBACK_MS, ctx.signal);

    if (done) return { cleared: true, failedIndex: -1, expected: -1, expectedValue: null };
  }

  return { cleared: true, failedIndex: -1, expected: -1, expectedValue: null };
}
