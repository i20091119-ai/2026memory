/**
 * shapes.js — 3차 모양 게임에 쓰는 도형 8종 (설계명세서 §3.5).
 * 전부 인라인 SVG path 로 그린다. 100×100 뷰박스 기준.
 */

/** 모양 이름 → SVG path d 속성 */
export const SHAPE_PATHS = {
  circle: 'M50 6 a44 44 0 1 0 0.1 0 z',
  square: 'M12 12 h76 a6 6 0 0 1 6 6 v64 a6 6 0 0 1 -6 6 h-76 a6 6 0 0 1 -6 -6 v-64 a6 6 0 0 1 6 -6 z',
  triangle: 'M50 8 L94 86 a5 5 0 0 1 -4 7 H14 a5 5 0 0 1 -4 -7 Z',
  star: 'M50 6 L61.8 38.2 L96 40 L69 61.4 L78 94 L50 75 L22 94 L31 61.4 L4 40 L38.2 38.2 Z',
  heart: 'M50 90 C18 68 6 52 6 36 A24 24 0 0 1 50 24 A24 24 0 0 1 94 36 C94 52 82 68 50 90 Z',
  diamond: 'M50 5 L95 50 L50 95 L5 50 Z',
  // 초승달: 바깥 반원을 왼쪽으로 두른 뒤, 안쪽을 타원 호로 파고들어와 초승달을 만든다.
  moon: 'M62 6 A44 44 0 1 0 62 94 A34 44 0 1 1 62 6 Z',
  cross: 'M38 6 h24 v32 h32 v24 h-32 v32 h-24 v-32 h-32 v-24 h32 z',
};

/** 화면에 쓰는 모양 순서 (config.SHAPES 와 동일해야 한다) */
export const SHAPE_NAMES = Object.keys(SHAPE_PATHS);

/**
 * 모양 하나를 SVG 엘리먼트로 만든다.
 * @param {string} name SHAPE_PATHS 의 키
 * @param {{size?: number|string, color?: string, className?: string}} [opts]
 * @returns {SVGSVGElement}
 */
export function createShape(name, opts = {}) {
  const { size = '100%', color = '#ffffff', className = '' } = opts;
  const NS = 'http://www.w3.org/2000/svg';

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');
  if (className) svg.setAttribute('class', className);
  const dim = typeof size === 'number' ? `${size}px` : size;
  svg.style.width = dim;
  svg.style.height = dim;

  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', SHAPE_PATHS[name] ?? SHAPE_PATHS.circle);
  path.setAttribute('fill', color);
  // 달 모양은 큰 원에서 작은 원을 파내야 하므로 evenodd 가 필요하다.
  path.setAttribute('fill-rule', 'evenodd');
  svg.append(path);

  return svg;
}
