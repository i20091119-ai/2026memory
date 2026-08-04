/**
 * mascot.js — 타이틀(메인 표지) 캐릭터.
 *
 * 흰 몸통에 남색 바이저를 쓴 로봇. 한 손은 엄지척, 다른 손은 카드를 가리킨다.
 * 발주자가 준 캐릭터 시안을 인라인 SVG 로 옮긴 것이다.
 * (이미지 파일을 쓰지 않는 이유: 오프라인 키오스크에서 해상도와 무관하게
 *  선명해야 하고, 저장소에 바이너리를 늘리지 않기 위해서다.)
 *
 * 말풍선은 토러스와 같은 클래스를 써서 스타일을 공유한다.
 */
import { el } from './util.js';
import { COLORS } from './config.js';

const INK = '#232c52';          // 외곽선·바이저 남색
const INK_SOFT = '#3b4a7a';

/**
 * @param {{size?: number}} [opts]
 * @returns {HTMLElement & {say: (text: string|null) => void}}
 */
export function createMascot(opts = {}) {
  const { size = 260 } = opts;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 200 200');
  svg.setAttribute('class', 'mascot-svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.width = `${size}px`;
  svg.style.height = `${size}px`;
  svg.innerHTML = MASCOT_MARKUP;

  const bubble = el('div.torus-bubble', { role: 'status', 'aria-live': 'polite' });
  bubble.hidden = true;

  const wrap = el('div.mascot', {}, bubble, el('div.mascot-body', {}, svg));

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

/** 가슴에 박힌 4색 마크 — 게임의 빨·노·초·파와 같은 색을 쓴다 */
const CHEST_MARK = COLORS.map((c, i) => {
  const x = 86 + i * 9;
  return `<circle cx="${x}" cy="126" r="3.4" fill="${c}"/>`;
}).join('');

const MASCOT_MARKUP = `
  <defs>
    <linearGradient id="ms-body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#eef1fa"/>
    </linearGradient>
  </defs>

  <!-- 바닥 그림자 -->
  <ellipse cx="100" cy="184" rx="54" ry="9" fill="#4b3f57" opacity="0.22"/>

  <!-- 안테나: 머리 위 동그란 고리 -->
  <path class="ms-antenna" d="M112 30 C112 16 126 12 128 21 C130 30 118 31 118 22"
        fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>

  <!-- 다리 -->
  <g stroke="${INK}" stroke-width="3.5">
    <rect x="83"  y="150" width="14" height="28" rx="7" fill="url(#ms-body)"/>
    <rect x="103" y="150" width="14" height="28" rx="7" fill="url(#ms-body)"/>
  </g>

  <!-- 몸통 -->
  <ellipse cx="100" cy="122" rx="38" ry="36"
           fill="url(#ms-body)" stroke="${INK}" stroke-width="3.5"/>
  ${CHEST_MARK}

  <!-- 왼팔: 엄지척 -->
  <g class="ms-arm-l">
    <path d="M70 118 C58 116 50 110 46 104" fill="none"
          stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
    <!-- 주먹 -->
    <rect x="26" y="92" width="34" height="32" rx="15"
          fill="url(#ms-body)" stroke="${INK}" stroke-width="3.5"/>
    <!-- 엄지 -->
    <rect x="32" y="58" width="17" height="40" rx="8.5"
          fill="url(#ms-body)" stroke="${INK}" stroke-width="3.5"
          transform="rotate(-8 40.5 78)"/>
    <!-- 손가락 접힌 선 -->
    <path d="M36 106 h16 M36 114 h14" stroke="${INK_SOFT}"
          stroke-width="2.4" stroke-linecap="round" opacity="0.55"/>
  </g>

  <!-- 오른팔: 검지로 가리키기 -->
  <g class="ms-arm-r">
    <path d="M130 118 C142 116 150 112 154 108" fill="none"
          stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
    <rect x="140" y="94" width="32" height="30" rx="14"
          fill="url(#ms-body)" stroke="${INK}" stroke-width="3.5"/>
    <rect x="166" y="98" width="30" height="15" rx="7.5"
          fill="url(#ms-body)" stroke="${INK}" stroke-width="3.5"/>
    <path d="M148 112 h14" stroke="${INK_SOFT}"
          stroke-width="2.4" stroke-linecap="round" opacity="0.55"/>
  </g>

  <!-- 머리 -->
  <rect x="52" y="28" width="96" height="74" rx="34"
        fill="url(#ms-body)" stroke="${INK}" stroke-width="3.5"/>

  <!-- 바이저(눈가리개) -->
  <rect x="60" y="46" width="80" height="36" rx="18" fill="${INK}"/>

  <!-- 눈: 동심원 두 개가 이어져 ∞ 처럼 보인다 -->
  <g class="ms-eyes">
    <circle cx="82"  cy="64" r="13" fill="#fff"/>
    <circle cx="118" cy="64" r="13" fill="#fff"/>
    <circle cx="82"  cy="64" r="8.5" fill="none" stroke="${INK}" stroke-width="3"/>
    <circle cx="118" cy="64" r="8.5" fill="none" stroke="${INK}" stroke-width="3"/>
    <circle cx="82"  cy="64" r="3.4" fill="${INK}"/>
    <circle cx="118" cy="64" r="3.4" fill="${INK}"/>
  </g>

  <!-- 입 -->
  <path d="M92 92 q8 7 16 0" fill="none" stroke="${INK}"
        stroke-width="3.2" stroke-linecap="round"/>
`;
