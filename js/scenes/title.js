/**
 * scenes/title.js — 타이틀 화면 (설계명세서 §4).
 * 아무 버튼이나 누르면 게임 시작, 60초 방치하면 어트랙트 데모로 넘어간다.
 */
import { el, multiline, mount, waitRelease } from '../util.js';
import { STR } from '../strings.js';
import { CONFIG } from '../config.js';
import { createMascot } from '../mascot.js';
import { totalClearCount } from '../storage.js';

/**
 * @param {import('../state.js').Ctx} ctx
 * @returns {Promise<'start'|'attract'>}
 */
export async function titleScene(ctx) {
  const mascot = createMascot();
  mascot.say(STR.TITLE_GREETING);

  // 종류별 상세 기록은 선택 화면의 각 카드에 있다. 타이틀엔 완주 합계만.
  const clears = totalClearCount();

  const node = el('section.scene.scene-title', {},
    multiline('h1.title-text', STR.TITLE),
    // 캐릭터 그림 안에 이미 4색 카드가 들어 있어서 따로 그리지 않는다.
    el('div.title-hero', {}, el('div.title-mascot', {}, mascot)),
    el('div.title-record', {},
      el('div.record-line', {
        text: clears > 0 ? STR.TITLE_ALL_CLEAR_COUNT(clears) : STR.TITLE_NO_RECORD,
      }),
    ),
    el('div.title-press.blink', { text: STR.TITLE_START }),
    // 좌석마다 키가 다르다 (왼쪽 1 2 3 4, 오른쪽 Q W E R). main.js 가 넣어 준다.
    el('div.title-keyhint', { text: ctx.keyHint ?? STR.TITLE_KEYHINT('1 2 3 4') }),
  );

  mount(ctx.root, node);
  // 타이틀에서는 중도 이탈 콤보가 의미 없다 (이미 타이틀이므로). 대신 운영자 콤보가 산다.
  ctx.input.exitComboEnabled = false;
  // 직전 화면에서 누른 버튼의 '뗌'이 여기로 넘어와 곧장 시작시키지 않도록 털어낸다.
  ctx.input.reset();

  // 뗌(up)에서 시작한다 — 노랑+초록을 누르고 있는 동안은 시작되지 않아야
  // 운영자 화면 홀드가 가능하다 (util.waitRelease 의 설명 참조).
  const pressed = await waitRelease(ctx.input, ctx.signal, {
    timeoutMs: CONFIG.ATTRACT_IDLE_MS,
  });

  if (pressed === null) return 'attract';

  // 브라우저 자동재생 정책: 첫 사용자 입력에서 오디오를 깨운다 (§4).
  ctx.audio.unlock();
  ctx.audio.blip();
  return 'start';
}
