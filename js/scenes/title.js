/**
 * scenes/title.js — 타이틀 화면 (설계명세서 §4).
 * 아무 버튼이나 누르면 게임 시작, 60초 방치하면 어트랙트 데모로 넘어간다.
 */
import { el, multiline, mount, waitButton } from '../util.js';
import { STR } from '../strings.js';
import { CONFIG } from '../config.js';
import { createMascot } from '../mascot.js';
import { loadBest, hasRecord } from '../storage.js';

/**
 * @param {import('../state.js').Ctx} ctx
 * @returns {Promise<'start'|'attract'>}
 */
export async function titleScene(ctx) {
  const best = loadBest();
  const mascot = createMascot();
  mascot.say(STR.TITLE_GREETING);

  const recordLine = hasRecord(best)
    ? STR.TITLE_BEST(best.bestGame, best.bestLevel)
    : STR.TITLE_NO_RECORD;

  const node = el('section.scene.scene-title', {},
    multiline('h1.title-text', STR.TITLE),
    // 캐릭터 그림 안에 이미 4색 카드가 들어 있어서 따로 그리지 않는다.
    el('div.title-hero', {}, el('div.title-mascot', {}, mascot)),
    el('div.title-record', {},
      el('div.record-line', { text: recordLine }),
      best.allClearCount > 0
        ? el('div.record-sub', { text: STR.TITLE_ALL_CLEAR_COUNT(best.allClearCount) })
        : null,
    ),
    el('div.title-press.blink', { text: STR.TITLE_START }),
    el('div.title-keyhint', { text: '키보드 1 2 3 4 = 빨 노 초 파' }),
  );

  mount(ctx.root, node);
  // 타이틀에서는 중도 이탈 콤보가 의미 없다 (이미 타이틀이므로).
  ctx.input.exitComboEnabled = false;

  const pressed = await waitButton(ctx.input, ctx.signal, {
    timeoutMs: CONFIG.ATTRACT_IDLE_MS,
  });

  if (pressed === null) return 'attract';

  // 브라우저 자동재생 정책: 첫 사용자 입력에서 오디오를 깨운다 (§4).
  ctx.audio.unlock();
  ctx.audio.blip();
  return 'start';
}
