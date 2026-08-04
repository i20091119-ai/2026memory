/**
 * logo.js — 기관 로고(경남수학문화관).
 *
 * 모든 화면에 계속 떠 있어야 하므로 씬이 아니라 오버레이에 한 번만 붙인다.
 * 크기는 CSS 가 정한다 — 타이틀에서는 크게, 게임 중에는 구석에 작게.
 *
 * 로고를 교체할 때는 `assets/logo.svg` 파일만 덮어쓰면 된다.
 * (<img> 로 불러오므로 코드를 고칠 필요가 없다. PNG 로 바꾸려면 아래 경로만 수정)
 */
import { el } from './util.js';
import { STR } from './strings.js';

const LOGO_SRC = 'assets/logo.svg';

/**
 * @returns {HTMLElement}
 */
export function createBrand() {
  const img = el('img.brand-img', {
    src: LOGO_SRC,
    alt: STR.BRAND_ALT,
    // 로고 파일이 없거나 깨져도 게임 화면이 망가지지 않게 조용히 숨긴다.
    onerror: (ev) => { ev.currentTarget.closest('.brand')?.remove(); },
  });
  return el('div.brand', {}, img);
}
