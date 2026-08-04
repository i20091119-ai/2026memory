/**
 * torus.js — 게임 중 안내 캐릭터 "토러스" (설계명세서 §4).
 *
 * 표정마다 그림 한 장씩, 모두 4장을 쓴다:
 *   assets/torus-idle.png / -talk.png / -cheer.png / -sad.png
 * 파일을 덮어쓰면 코드 수정 없이 바뀐다.
 * (규격은 docs/에셋시트.pdf 참조 — 정사각 · 투명 배경 · 600×600 권장)
 *
 * 말풍선은 옆에 붙는 별도 노드다.
 */
import { el } from './util.js';

/**
 * 표정 목록.
 *
 * 기쁜 표정은 'cheer' 하나뿐이다. 예전엔 단계 클리어(cheer)와 올클리어(celebrate)를
 * 나눠 뒀는데, 눈·입·팔이 완전히 같아서 그릴 사람 입장에서 헛일이었다.
 * 올클리어를 더 요란하게 만드는 건 표정이 아니라 씬 쪽 연출로 처리한다
 * (style.css 의 `.scene-allclear .torus` 참조).
 */
export const MOODS = ['idle', 'talk', 'cheer', 'sad'];

/** 표정 이름 → 그림 경로 */
// 모듈 위치 기준으로 풀어, 어느 페이지에서 불러도 경로가 맞는다
const srcFor = (mood) => new URL(`../assets/torus-${mood}.png`, import.meta.url).href;

/**
 * 안내 캐릭터 노드를 만든다.
 * 크기는 CSS 가 화면 높이에 맞춰 정한다 (style.css 의 --char-h 참조).
 * @param {{mood?: string}} [opts]
 * @returns {HTMLElement & {setMood: (m: string) => void, say: (text: string|null) => void}}
 */
export function createTorus(opts = {}) {
  const { mood = 'idle' } = opts;

  const img = el('img.torus-img', {
    alt: '',
    onerror: (ev) => { ev.currentTarget.style.visibility = 'hidden'; },
  });

  const bubble = el('div.torus-bubble', { role: 'status', 'aria-live': 'polite' });
  bubble.hidden = true;

  const wrap = el('div.torus', {}, bubble, el('div.torus-body', {}, img));

  wrap.setMood = (next) => {
    const value = MOODS.includes(next) ? next : 'idle';
    wrap.dataset.mood = value;
    img.src = srcFor(value);
  };

  wrap.say = (text) => {
    if (!text) {
      bubble.hidden = true;
      bubble.textContent = '';
      return;
    }
    bubble.hidden = false;
    bubble.textContent = text;
    // 말풍선이 새로 뜰 때마다 톡 튀어나오는 애니메이션을 재시작한다.
    bubble.classList.remove('pop');
    void bubble.offsetWidth;
    bubble.classList.add('pop');
  };

  wrap.setMood(mood);
  return wrap;
}

/** 미리 받아 두면 표정이 바뀔 때 한 프레임 깜빡이지 않는다 */
export function preloadTorus() {
  for (const mood of MOODS) {
    const img = new Image();
    img.src = srcFor(mood);
  }
}
