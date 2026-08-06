/**
 * scenes/select.js — 게임 종류 선택 화면 (구조 v2).
 *
 * 버튼 색이 곧 선택지다:
 *   빨강 = 색상 · 노랑 = 숫자 · 초록 = 모양 · 파랑 = 혼합
 * 그래서 각 선택지 카드가 해당 버튼 색으로 크게 칠해져 있어야 한다 —
 * "저 색 버튼을 누르면 저걸 고른다"가 설명 없이 보이게.
 */
import { el, mount, waitButton } from '../util.js';
import { STR } from '../strings.js';
import { CONFIG, COLORS } from '../config.js';
import { createTorus } from '../torus.js';
import { bestFor, hasRecord } from '../storage.js';

/** 화면 요소를 직접 탭해도 실제 버튼처럼 동작시킨다 (모바일 테스트용) */
function makeTappable(node, id, input) {
  node.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    input.emit('down', id, 'human');
  });
  const release = () => input.emit('up', id, 'human');
  node.addEventListener('pointerup', release);
  node.addEventListener('pointercancel', release);
  return node;
}

/** 종류 하나의 기록 요약 한 줄 */
function recordLine(game) {
  const best = bestFor(game);
  if (best.clearCount > 0) return STR.SELECT_CLEARED(best.clearCount);
  if (hasRecord(best)) return STR.SELECT_BEST(best.level, best.round);
  return STR.SELECT_NO_RECORD;
}

/**
 * @param {import('../state.js').Ctx} ctx
 * @returns {Promise<number|'title'>} 고른 게임 종류(1..4), 방치하면 'title'
 */
export async function selectScene(ctx) {
  const torus = createTorus({ mood: 'talk' });
  torus.say(STR.SELECT_GREETING);

  const cards = Array.from({ length: CONFIG.GAME_TYPES }, (_, i) => {
    const game = i + 1;
    const card = el('button.select-card', {
      type: 'button',
      style: { background: COLORS[i], animationDelay: `${i * 60}ms` },
      'aria-label': `${STR.COLOR_NAME[i]} — ${STR.GAME_NAME[game]}`,
    },
      el('span.select-name', { text: STR.GAME_NAME[game] }),
      el('span.select-desc', { text: STR.SELECT_DESC[game] }),
      el('span.select-record', { text: recordLine(game) }),
    );
    return makeTappable(card, i, ctx.input);
  });

  const node = el('section.scene.scene-select', {},
    el('div.select-body', {},
      el('h2.select-title', { text: STR.SELECT_TITLE }),
      el('div.select-grid', {}, ...cards),
      el('div.select-torus', {}, torus),
    ),
  );
  mount(ctx.root, node);
  ctx.input.exitComboEnabled = false;

  const ev = await waitButton(ctx.input, ctx.signal, {
    timeoutMs: CONFIG.ATTRACT_IDLE_MS,
  });
  if (ev === null) return 'title';

  ctx.audio.blip();
  cards[ev.id].classList.add('press');
  return ev.id + 1;
}
