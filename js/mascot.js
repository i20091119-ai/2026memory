/**
 * mascot.js — 타이틀(메인 표지) 캐릭터.
 *
 * 그림은 `assets/mascot.png` 한 장이다. 파일을 덮어쓰면 코드 수정 없이 바뀐다.
 * (그림 규격은 docs/에셋시트.pdf 참조 — 정사각 · 투명 배경 · 800×800 권장)
 *
 * 말풍선은 토러스와 같은 클래스를 써서 스타일을 공유한다.
 */
import { el } from './util.js';

// 모듈 위치 기준으로 풀어, 이 모듈을 어느 페이지에서 불러도 경로가 맞는다
// (게임의 index.html 뿐 아니라 docs/assets.html 같은 문서에서도 쓰인다)
const MASCOT_SRC = new URL('../assets/mascot.png', import.meta.url).href;

/**
 * 크기는 CSS 가 화면 높이에 맞춰 정한다 (style.css 의 --char-h 참조).
 * 여기서 px 로 고정하면 화면이 낮을 때 다른 요소와 겹친다.
 * @returns {HTMLElement & {say: (text: string|null) => void}}
 */
export function createMascot() {
  const img = el('img.mascot-img', {
    src: MASCOT_SRC,
    alt: '',
    // 그림이 없거나 깨져도 화면이 무너지지 않게 자리만 비운다.
    onerror: (ev) => { ev.currentTarget.style.visibility = 'hidden'; },
  });

  const bubble = el('div.torus-bubble', { role: 'status', 'aria-live': 'polite' });
  bubble.hidden = true;

  const wrap = el('div.mascot', {}, bubble, el('div.mascot-body', {}, img));

  wrap.say = (text) => {
    if (!text) {
      bubble.hidden = true;
      bubble.textContent = '';
      return;
    }
    bubble.hidden = false;
    bubble.textContent = text;
    bubble.classList.remove('pop');
    void bubble.offsetWidth;
    bubble.classList.add('pop');
  };

  return wrap;
}
