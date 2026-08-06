/**
 * scenes/recall.js — 회상(입력) 화면.
 *
 * 항목 종류(kind)에 따라 입력 방식이 달라진다:
 *   색상 항목 → 4색 버튼 모형에 직접 입력.
 *   숫자·모양 항목 → 4지선다 카드(빨/노/초/파 고정 순서) — 외운 값이 있는 칸의 색 버튼.
 * 혼합 게임에서는 한 시퀀스 안에서 이 둘이 항목마다 갈린다.
 *
 * 어느 쪽이든 오답이 나오는 순간 즉시 종료한다 (남은 항목은 묻지 않는다).
 */
import { el, mount, sleep, waitButton, edgeFlash } from '../util.js';
import { STR } from '../strings.js';
import { CONFIG, COLORS } from '../config.js';
import { createHud } from './hud.js';
import { createStrip } from './strip.js';
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

/** 카드 한 장의 내용물 (숫자 또는 흰색 모양 실루엣) */
function cardContent(kind, value) {
  return kind === GAME_DIGIT
    ? el('span.card-digit', { text: String(value) })
    : el('span.card-shape', {}, createShape(value, { size: '68%', color: '#fff' }));
}

/**
 * @typedef {{cleared: boolean, failedIndex: number,
 *            expectedItem: import('../games.js').RoundItem|null,
 *            pressedValue: number|string|null}} RecallResult
 */

/**
 * @param {import('../state.js').Ctx} ctx
 * @param {{game: number, level: number, round?: number, lives: number}} state
 * @param {ReturnType<import('../games.js').buildRound>} round
 * @param {{onReady?: (k: number, correctButton: number) => void}} [opts]
 *   onReady 는 어트랙트 데모가 유령 입력을 넣을 시점을 잡는 데 쓴다.
 * @returns {Promise<RecallResult>}
 */
export async function recallScene(ctx, state, round, opts = {}) {
  const items = round.items;
  const total = items.length;
  const answers = items.map((it) => it.answer);
  const hud = createHud(state);
  const prompt = el('h2.recall-prompt');
  const inputRow = el('div.recall-input-row');

  // 지금까지 무엇을 눌렀는지 보여 주는 답안 스트립 (예: 4 ● ☆ ? ?)
  const strip = createStrip(items);
  const entered = [];
  strip.setEntered(entered);

  const node = el('section.scene.scene-recall', {},
    hud,
    el('div.recall-body', {}, prompt, strip, inputRow),
  );
  mount(ctx.root, node);
  hud.setProgress(0, total);

  for (let k = 0; k < total; k++) {
    const item = items[k];
    prompt.textContent = STR.RECALL_PROMPT[item.kind](k);

    // 이번 항목의 입력 UI 를 세운다.
    // 색상 → 큰 색 버튼 4개(누른 버튼이 곧 답), 숫자·모양 → 4지선다 카드.
    let targets;
    if (item.kind === GAME_COLOR) {
      node.classList.remove('recall-choice');
      node.classList.add('recall-color');
      targets = COLORS.map((color, id) => makeTappable(
        el('button.pad', {
          type: 'button',
          style: { background: color },
          'aria-label': STR.COLOR_NAME[id],
        }), id, ctx.input));
    } else {
      node.classList.remove('recall-color');
      node.classList.add('recall-choice');
      targets = item.choices.map((value, id) => makeTappable(
        el('button.card', {
          type: 'button',
          // 카드가 좌→우로 차례차례 올라오는 등장 연출.
          style: { background: COLORS[id], animationDelay: `${id * 45}ms` },
          'aria-label': `${STR.COLOR_NAME[id]} 칸`,
        }, cardContent(item.kind, value)), id, ctx.input));
    }
    inputRow.replaceChildren(...targets);

    opts.onReady?.(k, item.answer);

    const ev = await waitButton(ctx.input, ctx.signal, {
      timeoutMs: CONFIG.INPUT_TIMEOUT_MS,
    });
    // INPUT_TIMEOUT_MS 가 0(무제한)이면 null 이 올 수 없지만, 값을 켰을 때를 대비.
    if (ev === null) {
      return { cleared: false, failedIndex: k, expectedItem: item, pressedValue: null };
    }

    const { ok, done } = judgeStep(answers, k, ev.id);
    const target = targets[ev.id];
    // 실제로 누른 값 — 색상 항목은 버튼 인덱스가 곧 색, 카드는 그 칸의 값.
    const pressedValue = item.kind === GAME_COLOR ? ev.id : item.choices[ev.id];

    // 눌림 애니메이션 + 톤
    target.classList.remove('press');
    void target.offsetWidth;
    target.classList.add('press');
    ctx.audio.press(item.kind, ev.id);

    if (!ok) {
      target.classList.add('wrong');
      targets[item.answer].classList.add('reveal');
      // 스트립에는 **누른 값 그대로** 넣고 틀렸다고 표시한다.
      strip.markWrong(k, pressedValue);
      edgeFlash(node, 'wrong');
      // 흔들리는 스트립과 정답 표시를 충분히 보여 주고 나서 MISS 씬으로.
      await sleep(CONFIG.WRONG_HOLD_MS, ctx.signal);
      return { cleared: false, failedIndex: k, expectedItem: item, pressedValue };
    }

    // 정답 — 카드일 때는 강조 연출을 함께 (색 버튼은 눌림 자체가 피드백)
    if (item.kind !== GAME_COLOR) {
      target.classList.add('correct');
      edgeFlash(node, 'correct');
      ctx.audio.correct();
    }
    entered.push(item.value);
    strip.setEntered(entered);
    hud.setProgress(k + 1, total);
    await sleep(CONFIG.FEEDBACK_MS, ctx.signal);

    if (done) return { cleared: true, failedIndex: -1, expectedItem: null, pressedValue: null };
  }

  return { cleared: true, failedIndex: -1, expectedItem: null, pressedValue: null };
}
