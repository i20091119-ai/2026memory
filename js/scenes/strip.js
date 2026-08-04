/**
 * scenes/strip.js — 답안 스트립.
 *
 * "이번에 몇 개인지"와 "지금까지 뭘 눌렀는지"를 한 줄로 보여 준다.
 * 예를 들어 5개짜리 숫자 단계에서 4·5·7 을 맞혔다면:
 *
 *     [4] [5] [7] [?] [?]
 *              ↑ 지금 입력할 차례
 *
 * 제시(암기) 중에는 값을 채우지 않는다 — 채우면 외울 필요가 없어진다.
 * 이때는 칸 개수와 현재 위치만 알려 주는 용도로 쓴다.
 */
import { el } from '../util.js';
import { STR } from '../strings.js';
import { COLORS } from '../config.js';
import { createShape } from '../shapes.js';
import { GAME_COLOR, GAME_DIGIT } from '../games.js';

/**
 * 칸 하나에 들어갈 내용물을 만든다.
 * @param {number} game 1|2|3
 * @param {number|string} value
 */
function slotContent(game, value) {
  if (game === GAME_COLOR) {
    return el('span.slot-color', { style: { background: COLORS[value] } });
  }
  if (game === GAME_DIGIT) {
    return el('span.slot-digit', { text: String(value) });
  }
  return el('span.slot-shape', {}, createShape(value, { size: '78%', color: '#fff' }));
}

/**
 * 답안 스트립을 만든다.
 * @param {number} game 1|2|3
 * @param {number} total 이번 단계 항목 수
 * @returns {HTMLElement & {setEntered: Function, setCurrent: Function, reveal: Function}}
 */
export function createStrip(game, total) {
  const label = el('div.strip-label');
  const slots = Array.from({ length: total }, () => el('div.slot'));
  const row = el('div.strip-row', {}, ...slots);
  const node = el('div.strip', {}, label, row);

  /** 지금 입력할 차례를 표시한다 (제시 중에는 지금 보여 주는 항목) */
  node.setCurrent = (k) => {
    slots.forEach((slot, i) => {
      slot.classList.toggle('current', i === k);
    });
  };

  /**
   * 지금까지 입력한 값들을 채운다.
   * @param {(number|string)[]} values 맞힌 값들 (앞에서부터)
   */
  node.setEntered = (values) => {
    slots.forEach((slot, i) => {
      if (i < values.length) {
        if (!slot.classList.contains('filled')) {
          slot.replaceChildren(slotContent(game, values[i]));
          slot.classList.add('filled', 'pop');
        }
      } else {
        slot.replaceChildren();
        slot.classList.remove('filled', 'pop');
      }
    });
    node.setCurrent(values.length < total ? values.length : -1);
    label.textContent = values.length >= total
      ? STR.STRIP_DONE
      : STR.STRIP_RECALL(values.length + 1, total);
  };

  /** 오답으로 끝났을 때, 놓친 자리에 정답을 회색으로 밝혀 준다 */
  node.reveal = (index, value) => {
    const slot = slots[index];
    if (!slot) return;
    slot.replaceChildren(slotContent(game, value));
    slot.classList.add('filled', 'revealed');
    slot.classList.remove('current');
  };

  node.setLabel = (text) => { label.textContent = text; };

  return node;
}
