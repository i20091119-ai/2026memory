/**
 * config.js — 모든 튜닝 상수를 모아 두는 단 하나의 장소.
 * 게임 난이도·연출 속도를 바꾸고 싶으면 여기만 고치면 된다 (설계명세서 §3.6).
 */

export const CONFIG = {
  LEVELS_PER_GAME: 5,        // 차수당 단계 수
  TOTAL_GAMES: 3,            // 코스 전체 차수 수
  LIVES: 3,
  PRESENT_MS: 900,           // 항목 표시 시간
  GAP_MS: 350,               // 항목 간 공백
  COUNTDOWN_MS: 600,         // 3-2-1 한 칸
  FEEDBACK_MS: 400,          // 정답 카드 강조
  MISS_MS: 1200,             // 오답 연출
  INPUT_TIMEOUT_MS: 0,       // 0 = 무제한 (확정), 값 주면 타임아웃 활성화
  DIGIT_MIN: 0, DIGIT_MAX: 9,
  SHAPES: ['circle', 'square', 'triangle', 'star', 'heart', 'diamond', 'moon', 'cross'],
  WS_URL: 'ws://localhost:8765',
  KEY_MAP: { '1': 0, '2': 1, '3': 2, '4': 3 },   // 테스트용 키보드
  ATTRACT_IDLE_MS: 60000,    // 타이틀 방치 → 어트랙트 데모
  EXIT_HOLD_MS: 2000,        // 빨+파 홀드 → 타이틀 복귀
  GAMEOVER_IDLE_MS: 15000,   // 게임오버 방치 → 타이틀
  INTRO_MIN_MS: 600,         // 차수 안내: 이 시간 동안은 입력을 안 받는다(오입력 방지)
  LEVEL_CLEAR_MS: 1000,      // 단계 클리어 연출
  DEBOUNCE_MS: 80,           // 연타 방지 최소 간격
  WS_RETRY_MS: 3000,         // WebSocket 재접속 간격
};

/** 버튼 색 (0=빨,1=노,2=초,3=파). 이 순서는 절대 바꾸지 않는다. */
export const COLORS = ['#e53935', '#fdd835', '#43a047', '#1e88e5'];

/** 1차 제시음·입력음 음높이 (도/미/솔/도′) */
export const COLOR_TONES = [261.63, 329.63, 392.00, 523.25];

/* ------------------------------------------------------------------ *
 * 개발용 URL 치트 (설계명세서 §3.6)
 * 프로덕션 키오스크는 파라미터 없는 URL 로 뜨므로 자연히 비활성화된다.
 * ------------------------------------------------------------------ */

const params = new URLSearchParams(globalThis.location?.search ?? '');

/** ?fast=1 → 연출 타이밍 1/3 (반복 확인용) */
export const FAST = params.get('fast') === '1';

if (FAST) {
  for (const key of [
    'PRESENT_MS', 'GAP_MS', 'COUNTDOWN_MS', 'FEEDBACK_MS', 'MISS_MS',
    'INTRO_MIN_MS', 'LEVEL_CLEAR_MS', 'ATTRACT_IDLE_MS', 'GAMEOVER_IDLE_MS',
  ]) {
    CONFIG[key] = Math.round(CONFIG[key] / 3);
  }
}

/**
 * ?game=3&level=4 → 해당 차수·단계에서 바로 시작 (목숨은 기본값).
 * 범위를 벗어난 값은 무시하고 정상 시작한다.
 */
function readCheat() {
  const clamp = (raw, min, max) => {
    const n = Number.parseInt(raw ?? '', 10);
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  const game = clamp(params.get('game'), 1, CONFIG.TOTAL_GAMES);
  const level = clamp(params.get('level'), 1, CONFIG.LEVELS_PER_GAME);
  if (game === null && level === null) return null;
  return { game: game ?? 1, level: level ?? 1 };
}

export const CHEAT = readCheat();
