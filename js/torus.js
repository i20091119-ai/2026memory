/**
 * torus.js — 마스코트 캐릭터 "토러스" (설계명세서 §4).
 *
 * 도넛(토러스) 한 마리를 인라인 SVG 하나로 그리고, 표정 부품을 CSS 클래스로
 * 갈아 끼워 상태를 바꾼다: idle / talk / cheer / sad / celebrate.
 * 말풍선은 옆에 붙는 별도 노드다.
 */
import { el } from './util.js';

const MOODS = ['idle', 'talk', 'cheer', 'sad', 'celebrate'];

/** 도넛 위 스프링클: [x, y, 회전각, 색] */
const SPRINKLES = [
  [50, 26, -20, '#ff6f91'], [72, 34, 35, '#ffd166'], [82, 58, 80, '#6ee7b7'],
  [30, 34, 25, '#7dd3fc'], [22, 60, -60, '#ff6f91'], [63, 21, 10, '#c4b5fd'],
  [38, 22, -40, '#6ee7b7'], [78, 46, -15, '#ffd166'],
];

/**
 * 토러스 캐릭터 노드를 만든다.
 * @param {{size?: number, mood?: string}} [opts]
 * @returns {HTMLElement & {setMood: (m: string) => void, say: (text: string|null) => void}}
 */
export function createTorus(opts = {}) {
  const { size = 220, mood = 'idle' } = opts;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('class', 'torus-svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.width = `${size}px`;
  svg.style.height = `${size}px`;
  svg.innerHTML = TORUS_MARKUP;

  const bubble = el('div.torus-bubble', { role: 'status', 'aria-live': 'polite' });
  bubble.hidden = true;

  const wrap = el('div.torus', {}, bubble, el('div.torus-body', {}, svg));

  wrap.setMood = (next) => {
    const value = MOODS.includes(next) ? next : 'idle';
    wrap.dataset.mood = value;
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

/**
 * 도넛 본체 + 표정 부품.
 * 표정은 전부 그려 두고 CSS 의 [data-mood] 선택자로 하나만 보여 준다.
 * (눈·입을 매번 새로 만들지 않아 전환이 매끄럽다.)
 */
const TORUS_MARKUP = `
  <defs>
    <radialGradient id="tr-dough" cx="38%" cy="30%" r="75%">
      <stop offset="0%" stop-color="#ffd9a8"/>
      <stop offset="100%" stop-color="#e8ab6a"/>
    </radialGradient>
    <linearGradient id="tr-glaze" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffb3c9"/>
      <stop offset="100%" stop-color="#f472a6"/>
    </linearGradient>
    <mask id="tr-hole">
      <rect width="120" height="120" fill="white"/>
      <!-- 구멍은 눈보다 위쪽에 작게 — 눈과 붙어 보이지 않게 한다 -->
      <circle cx="60" cy="50" r="13" fill="black"/>
    </mask>
  </defs>

  <!-- 팔 (몸통 뒤에 그려 자연스럽게 붙어 보이게) -->
  <g class="tr-arms" stroke="#e8ab6a" stroke-width="6" stroke-linecap="round">
    <line class="tr-arm-l" x1="16" y1="66" x2="4" y2="76"/>
    <line class="tr-arm-r" x1="104" y1="66" x2="116" y2="76"/>
  </g>

  <g mask="url(#tr-hole)">
    <!-- 반죽 -->
    <circle cx="60" cy="62" r="44" fill="url(#tr-dough)"/>
    <!-- 분홍 글레이즈: 위쪽을 덮는 물결 -->
    <path d="M16 62
             a44 44 0 0 1 88 0
             q-6 9 -12 1 q-7 10 -14 1 q-7 10 -14 1 q-7 10 -14 1 q-7 10 -14 1 q-6 8 -10 -6 z"
          fill="url(#tr-glaze)"/>
    <g class="tr-sprinkles">${SPRINKLES.map(
      ([x, y, r, c]) =>
        `<rect x="${x}" y="${y}" width="7" height="3" rx="1.5" fill="${c}"
               transform="rotate(${r} ${x + 3.5} ${y + 1.5})"/>`,
    ).join('')}</g>
  </g>

  <!-- 눈: 구멍 아래, 좌우로 벌려 배치 -->
  <g class="tr-eyes">
    <g class="tr-eye-open">
      <ellipse cx="40" cy="73" rx="7" ry="8" fill="#2b2b33"/>
      <ellipse cx="80" cy="73" rx="7" ry="8" fill="#2b2b33"/>
      <circle cx="42.5" cy="70" r="2.4" fill="#fff"/>
      <circle cx="82.5" cy="70" r="2.4" fill="#fff"/>
    </g>
    <g class="tr-eye-happy" stroke="#2b2b33" stroke-width="3.4"
       stroke-linecap="round" fill="none">
      <path d="M33 75 q7 -9 14 0"/>
      <path d="M73 75 q7 -9 14 0"/>
    </g>
    <g class="tr-eye-sad" stroke="#2b2b33" stroke-width="3.4"
       stroke-linecap="round" fill="none">
      <path d="M33 71 q7 8 14 0"/>
      <path d="M73 71 q7 8 14 0"/>
    </g>
  </g>

  <!-- 입: 눈 아래 -->
  <g class="tr-mouth" fill="#2b2b33">
    <path class="tr-mouth-smile" d="M53 90 q7 8 14 0" fill="none"
          stroke="#2b2b33" stroke-width="3.4" stroke-linecap="round"/>
    <ellipse class="tr-mouth-open" cx="60" cy="93" rx="6.5" ry="7.5"/>
    <path class="tr-mouth-frown" d="M53 96 q7 -8 14 0" fill="none"
          stroke="#2b2b33" stroke-width="3.4" stroke-linecap="round"/>
  </g>

  <!-- 볼터치 -->
  <g class="tr-blush" fill="#f9a8c4" opacity="0.75">
    <ellipse cx="27" cy="84" rx="6" ry="4"/>
    <ellipse cx="93" cy="84" rx="6" ry="4"/>
  </g>
`;
