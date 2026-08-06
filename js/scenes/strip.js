/**
 * scenes/strip.js — 답안 스트립.
 *
 * "이번에 몇 개인지"와 "지금까지 뭘 눌렀는지"를 한 줄로 보여 준다.
 * 예를 들어 5개짜리 숫자 단계에서 4·5·7 을 맞혔다면:
 *
 *     [4] [5] [7] [?] [?]
 *              ↑ 지금 입력할 차례
 *
 * 칸의 내용물은 항목 종류(kind)에 따라 다르다 — 혼합 게임에서는 한 스트립 안에
 * 색칩·숫자·모양이 섞여 들어간다.
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
 * @param {number} kind 1|2|3
 * @param {number|string} value
 */
function slotContent(kind, value) {
  if (kind === GAME_COLOR) {
    return el('span.slot-color', { style: { background: COLORS[value] } });
  }
  if (kind === GAME_DIGIT) {
    return el('span.slot-digit', { text: String(value) });
  }
  return el('span.slot-shape', {}, createShape(value, { size: '78%', color: '#fff' }));
}

/**
 * 답안 스트립을 만든다.
 * @param {import('../games.js').RoundItem[]} items 이번 라운드 항목들
 * @returns {HTMLElement & {setEntered: Function, setCurrent: Function,
 *                          markWrong: Function, setLabel: Function}}
 */
export function createStrip(items) {
  const total = items.length;
  const label = el('div.strip-label');
  const slots = items.map(() => el('div.slot'));
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
   * @param {(number|string)[]} values 맞힌 값들 (앞에서부터, i번째 항목의 값)
   */
  node.setEntered = (values) => {
    slots.forEach((slot, i) => {
      if (i < values.length) {
        if (!slot.classList.contains('filled')) {
          slot.replaceChildren(slotContent(items[i].kind, values[i]));
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

  /**
   * 오답일 때 — 그 자리에 **누른 값 그대로** 넣고 틀렸다고 표시한다.
   *
   * 정답을 대신 넣으면 "나는 분명 이걸 눌렀는데?" 하는 오해를 부른다.
   * 누른 것은 누른 대로 두고, 빨간 테두리와 큰 흔들림으로 틀렸음을 알린다.
   * (정답이 무엇이었는지는 이어지는 오답 화면에서 따로 크게 보여 준다.)
   *
   * @param {number} index 틀린 자리
   * @param {number|string} value 그 자리에 **실제로 누른** 값
   */
  node.markWrong = (index, value) => {
    const slot = slots[index];
    if (!slot) return;
    slot.replaceChildren(slotContent(items[index].kind, value));
    slot.classList.remove('current', 'pop');
    slot.classList.add('filled', 'wrong');
    label.textContent = STR.STRIP_WRONG(index + 1, total);
  };

  node.setLabel = (text) => { label.textContent = text; };

  return node;
}
