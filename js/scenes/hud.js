/**
 * scenes/hud.js — 화면 상단 공통 HUD (설계명세서 §4).
 * 목숨 하트, 차수/단계, 그리고 회상 진행 표시(k/n)를 담당한다.
 */
import { el } from '../util.js';
import { STR } from '../strings.js';
import { CONFIG } from '../config.js';

/**
 * 목숨 하트 그림 3종. 파일을 덮어쓰면 그대로 바뀐다 (코드 수정 불필요).
 *   heart        — 남아 있는 목숨
 *   heart-off    — 이미 잃은 목숨
 *   heart-broken — 막 잃는 순간에만 잠깐 보이는 깨진 하트
 */
const HEART_ON = new URL('../../assets/heart.png', import.meta.url).href;
const HEART_OFF = new URL('../../assets/heart-off.png', import.meta.url).href;
const HEART_BROKEN = new URL('../../assets/heart-broken.png', import.meta.url).href;

/**
 * @param {{game: number, level: number, lives: number, maxLives?: number}} state
 * @returns {HTMLElement & {setLives: Function, setProgress: Function, breakHeart: Function}}
 */
export function createHud(state) {
  const maxLives = state.maxLives ?? CONFIG.LIVES;

  const hearts = el('div.hud-hearts', { 'aria-label': '남은 목숨' });

  // 차수·단계는 글자만 두면 밋밋해서 배지(글상자)로 감싼다.
  // 왼쪽 칸은 차수별 색이 달라 지금 어느 게임인지 색으로도 구분된다.
  const stageRound = el('span.stage-round');
  const stageLevel = el('span.stage-level');
  const stage = el('div.hud-stage', {
    'aria-label': STR.HUD_STAGE(state.game, state.level),
  }, stageRound, stageLevel);

  const dots = el('div.hud-dots', { 'aria-label': '회상 진행' });

  // 홈으로 돌아가는 방법을 항상 눈에 띄게 둔다.
  // 콤보를 모르면 게임 중에 빠져나갈 방법이 없다시피 하다.
  const home = el('div.hud-home', {}, el('span.home-key'), el('span', { text: STR.HOME_HINT }));

  const node = el('header.hud', {},
    el('div.hud-left', {}, hearts, home),
    el('div.hud-center', {}, stage),
    el('div.hud-right', {}, dots),
  );

  /** 하트를 lives 개만큼 채운다 */
  node.setLives = (lives) => {
    hearts.replaceChildren(
      ...Array.from({ length: maxLives }, (_, i) =>
        el('span.heart', { class: i < lives ? 'on' : 'off' },
          el('img.heart-img', { src: i < lives ? HEART_ON : HEART_OFF, alt: '' }))),
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
    const img = target.querySelector('.heart-img');
    target.classList.add('breaking');
    if (img) img.src = HEART_BROKEN;          // 깨지는 동안만 '깨진 하트' 그림
    // 애니메이션이 끝나면 꺼진 하트로 확정
    target.addEventListener('animationend', () => {
      target.classList.remove('breaking');
      target.classList.replace('on', 'off');
      if (img) img.src = HEART_OFF;
    }, { once: true });
  };

  node.setStage = (game, level) => {
    stage.dataset.game = String(game);
    stage.setAttribute('aria-label', STR.HUD_STAGE(game, level));
    stageRound.textContent = `${STR.HUD_ROUND(game)} ${STR.GAME_SHORT[game] ?? ''}`.trim();
    stageLevel.textContent = STR.HUD_LEVEL(level);
  };
  node.setStage(state.game, state.level);

  node.setLives(state.lives);
  node.setProgress(0, 0);
  return node;
}
