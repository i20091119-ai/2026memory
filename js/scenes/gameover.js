/**
 * scenes/gameover.js — 게임 오버 + 컨티뉴 선택 (설계명세서 §3.1, §4).
 *
 * 초록 = 죽은 차수 1단계부터 (목숨 3 회복)
 * 빨강 = 처음부터
 * 15초 무입력 = 타이틀
 */
import { el, mount, waitButton } from '../util.js';
import { STR } from '../strings.js';
import { CONFIG, COLORS } from '../config.js';
import { createTorus } from '../torus.js';
import { GREEN, RED } from '../games.js';

/**
 * @param {import('../state.js').Ctx} ctx
 * @param {{game: number, level: number}} reached 이번 판 도달 기록
 * @param {{updated: boolean, best: object}} record submitRecord 결과
 * @returns {Promise<'continue'|'restart'|'title'>}
 */
export async function gameOverScene(ctx, reached, record) {
  const torus = createTorus({ size: 180, mood: 'sad' });
  torus.say(STR.GAME_OVER_SAD);

  const countdown = el('div.gameover-countdown');

  const choice = (colorIndex, text) => el('div.continue-row', {},
    el('span.continue-dot', { style: { background: COLORS[colorIndex] } }),
    el('span.continue-text', { text }),
  );

  const node = el('section.scene.scene-gameover', {},
    el('div.gameover-body', {},
      el('h2.gameover-title', { text: STR.GAME_OVER }),
      record.updated ? el('div.new-record.pop-in', { text: STR.NEW_RECORD }) : null,
      el('div.gameover-record', {},
        el('div.record-line', { text: STR.GAME_OVER_REACHED(reached.game, reached.level) }),
        el('div.record-sub', {
          text: STR.GAME_OVER_BEST(record.best.bestGame, record.best.bestLevel),
        }),
      ),
      el('div.gameover-torus', {}, torus),
      el('div.continue-box', {},
        el('div.continue-title', { text: STR.CONTINUE_TITLE }),
        choice(GREEN, STR.CONTINUE_GREEN),
        choice(RED, STR.CONTINUE_RED),
      ),
      countdown,
    ),
  );
  mount(ctx.root, node);

  ctx.audio.gameOver();
  if (record.updated) setTimeout(() => ctx.audio.newRecord(), 900);

  // 남은 시간을 1초 단위로 보여 준다 — "갑자기 타이틀로 튕겼다"는 인상을 없앤다.
  const deadline = performance.now() + CONFIG.GAMEOVER_IDLE_MS;
  const tick = setInterval(() => {
    const sec = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
    countdown.textContent = STR.CONTINUE_COUNTDOWN(sec);
  }, 200);

  try {
    // 초록/빨강만 받는다. 노랑·파랑은 무시하고 계속 기다린다.
    const ev = await waitButton(ctx.input, ctx.signal, {
      timeoutMs: CONFIG.GAMEOVER_IDLE_MS,
      accept: (id) => id === GREEN || id === RED,
    });
    if (ev === null) return 'title';
    ctx.audio.blip();
    return ev.id === GREEN ? 'continue' : 'restart';
  } finally {
    clearInterval(tick);
  }
}
