/**
 * scenes/hud.js — 화면 상단 공통 HUD (설계명세서 §4).
 * 목숨 하트, 차수/단계, 그리고 회상 진행 표시(k/n)를 담당한다.
 */
import { el } from '../util.js';
import { STR } from '../strings.js';
import { CONFIG } from '../config.js';

/**
 * @param {{game: number, level: number, lives: number, maxLives?: number}} state
 * @returns {HTMLElement & {setLives: Function, setProgress: Function, breakHeart: Function}}
 */
export function createHud(state) {
  const maxLives = state.maxLives ?? CONFIG.LIVES;

  const hearts = el('div.hud-hearts', { 'aria-label': '남은 목숨' });
  const stage = el('div.hud-stage', { text: STR.HUD_STAGE(state.game, state.level) });
  const dots = el('div.hud-dots', { 'aria-label': '회상 진행' });

  const node = el('header.hud', {},
    el('div.hud-left', {}, hearts),
    el('div.hud-center', {}, stage),
    el('div.hud-right', {}, dots),
  );

  /** 하트를 lives 개만큼 채운다 */
  node.setLives = (lives) => {
    hearts.replaceChildren(
      ...Array.from({ length: maxLives }, (_, i) =>
        el('span.heart', { class: i < lives ? 'on' : 'off', text: '♥' })),
    );
  };

  /**
   * 회상 진행 점 — "3개 중 2번째 입력 중"을 점으로 보여 준다.
   * @param {number} done 맞춘 개수
   * @param {number} total 전체 항목 수
   */
  node.setProgress = (done, total) => {
    if (!total) {
      dots.replaceChildren();
      return;
    }
    dots.replaceChildren(
      ...Array.from({ length: total }, (_, i) => {
        const cls = i < done ? 'done' : (i === done ? 'current' : '');
        return el('span.dot', { class: cls });
      }),
    );
  };

  /** 목숨이 깨지는 연출 — 방금 잃은 하트를 지목해 애니메이션을 건다 */
  node.breakHeart = (livesAfter) => {
    const target = hearts.children[livesAfter];
    if (!target) return;
    target.classList.add('breaking');
    // 애니메이션이 끝나면 꺼진 하트로 확정
    target.addEventListener('animationend', () => {
      target.classList.remove('breaking');
      target.classList.replace('on', 'off');
    }, { once: true });
  };

  node.setStage = (game, level) => { stage.textContent = STR.HUD_STAGE(game, level); };

  node.setLives(state.lives);
  node.setProgress(0, 0);
  return node;
}
