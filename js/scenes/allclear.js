/**
 * scenes/allclear.js — 완주(올클리어) 축하 화면 (설계명세서 §4).
 * 폭죽/색종이 연출 + 토러스 만세 + 기록 표시 → 아무 버튼이나 누르면 타이틀.
 */
import { el, mount, waitButton } from '../util.js';
import { STR } from '../strings.js';
import { COLORS } from '../config.js';
import { createTorus } from '../torus.js';

/** 색종이 조각을 흩뿌린다. 순수 CSS 애니메이션이라 비용이 거의 없다. */
function confetti(count = 60) {
  const layer = el('div.confetti', { 'aria-hidden': 'true' });
  for (let i = 0; i < count; i++) {
    layer.append(el('span.confetti-bit', {
      style: {
        left: `${Math.random() * 100}%`,
        background: COLORS[i % COLORS.length],
        animationDelay: `${Math.random() * 2.5}s`,
        animationDuration: `${2.4 + Math.random() * 2}s`,
        transform: `rotate(${Math.random() * 360}deg)`,
      },
    }));
  }
  return layer;
}

/**
 * @param {import('../state.js').Ctx} ctx
 * @param {{game: number, clearCount: number}} record
 */
export async function allClearScene(ctx, record) {
  // 기쁜 표정은 라운드 클리어와 같은 'cheer' 하나를 쓴다.
  // 완주의 '더 요란한' 느낌은 씬 쪽 연출(색종이·스프링클 반짝임)이 만든다.
  const torus = createTorus({ mood: 'cheer' });
  torus.say(STR.ALL_CLEAR_CHEER);

  const node = el('section.scene.scene-allclear', {},
    confetti(),
    el('div.allclear-body', {},
      el('h2.allclear-title.pop-in', { text: STR.ALL_CLEAR }),
      el('div.allclear-sub', { text: STR.ALL_CLEAR_SUB(record.game) }),
      el('div.allclear-torus', {}, torus),
      el('div.record-sub', {
        text: STR.TITLE_ALL_CLEAR_COUNT(record.clearCount),
      }),
      el('div.allclear-press.blink', { text: STR.ALL_CLEAR_PRESS }),
    ),
  );
  mount(ctx.root, node);

  ctx.audio.allClear();

  await waitButton(ctx.input, ctx.signal, { timeoutMs: 0 });
  ctx.audio.blip();
}
