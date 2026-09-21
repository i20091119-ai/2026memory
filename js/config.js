/**
 * config.js — 모든 튜닝 상수를 모아 두는 단 하나의 장소.
 * 게임 난이도·연출 속도를 바꾸고 싶으면 여기만 고치면 된다 (설계명세서 §3.6).
 */

export const CONFIG = {
  GAME_TYPES: 4,             // 고를 수 있는 게임 종류 (색상·숫자·모양·혼합)
  LEVELS: 4,                 // 단계 수 = 기억할 항목 수 (1개→…→4개)
  ROUNDS_PER_LEVEL: 5,       // 단계마다 반복하는 라운드 수
  LIVES: 3,
  PRESENT_MS: 900,           // 항목 표시 시간
  GAP_MS: 350,               // 항목 간 공백
  COUNTDOWN_MS: 600,         // 3-2-1 한 칸
  FEEDBACK_MS: 400,          // 정답 카드 강조
  WRONG_HOLD_MS: 900,        // 틀린 자리 흔들기 — 오답 화면으로 넘어가기 전에 붙잡아 두는 시간
  MISS_MS: 2100,             // 오답 연출 (하트 깨짐 연출이 다 보일 만큼)
  HEART_BREAK_DELAY_MS: 220, // 화면이 뜬 뒤 하트가 깨지기까지 — 동시에 하면 묻힌다
  INPUT_TIMEOUT_MS: 0,       // 0 = 무제한 (확정), 값 주면 타임아웃 활성화
  DIGIT_MIN: 0, DIGIT_MAX: 9,
  SHAPES: ['circle', 'square', 'triangle', 'star', 'heart', 'diamond', 'moon', 'cross'],
  WS_URL: 'ws://localhost:8765',
  /* 버튼은 5개다: 0~3 = 빨·노·초·파 (게임 입력), 4 = 흰색 (도전 신청/수락 전용).
     키보드는 좌석마다 한 줄씩 — 왼쪽 좌석 1 2 3 4 5, 오른쪽 좌석 Q W E R T. */
  BUTTONS: 5,
  KEY_MAPS: [
    { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4 },
    { 'q': 0, 'w': 1, 'e': 2, 'r': 3, 't': 4 },
  ],
  /* 제로딜레이 USB 인코더(게임패드로 잡힘)의 버튼 번호 → 좌석별 버튼.
     인코더 입력 K1~K5 = 왼쪽 좌석 빨·노·초·파·흰, K6~K10 = 오른쪽 좌석. */
  GAMEPAD_MAPS: [
    [0, 1, 2, 3, 4],
    [5, 6, 7, 8, 9],
  ],
  ATTRACT_IDLE_MS: 60000,    // 타이틀 방치 → 어트랙트 데모
  EXIT_HOLD_MS: 2000,        // 빨+파 홀드 → 타이틀 복귀
  ADMIN_HOLD_MS: 3000,       // 타이틀에서 노+초 홀드 → 운영자 화면
  ADMIN_KEY: '0',            // 브라우저에서 운영자 화면을 여는 키
  ADMIN_IDLE_MS: 90000,      // 운영자 화면 방치 → 타이틀

  /* 2인 대결 (흰색 버튼) */
  CHALLENGE_MS: 10000,       // "도전에 응하시겠습니까?" 가 떠 있는 시간
  CHALLENGE_PENALTY_MS: 2500,// 상대가 흰색 아닌 버튼을 누를 때마다 이만큼 빨리 줄어든다
  CHALLENGE_DECLINED_MS: 2500,// 거절/무응답 안내가 떠 있는 시간
  VS_PICK_MS: 8000,          // 대결 게임 고르기 제한 — 지나면 혼합
  VS_ROUNDS: [1, 1, 2, 2, 3, 3, 4, 4],   // 라운드별 기억할 개수
  VS_WIN_POINTS: 5,          // 먼저 이만큼 따면 승리
  VS_INTRO_MS: 3200,         // 대결 안내 화면
  VS_ROUND_RESULT_MS: 1800,  // 라운드 결과 연출
  VS_RESULT_IDLE_MS: 20000,  // 최종 결과 방치 → 타이틀
  GAMEOVER_IDLE_MS: 15000,   // 게임오버 방치 → 타이틀
  INTRO_MIN_MS: 600,         // 차수 안내: 이 시간 동안은 입력을 안 받는다(오입력 방지)
  LEVEL_CLEAR_MS: 1000,      // 단계 클리어 연출
  DEBOUNCE_MS: 80,           // 연타 방지 최소 간격
  WS_RETRY_MS: 3000,         // WebSocket 재접속 간격
};

/** 버튼 색 (0=빨,1=노,2=초,3=파). 이 순서는 절대 바꾸지 않는다. */
export const COLORS = ['#e53935', '#fdd835', '#43a047', '#1e88e5'];

/** 예전 이름 — 왼쪽(첫) 좌석의 키보드 매핑 */
CONFIG.KEY_MAP = CONFIG.KEY_MAPS[0];

/**
 * 좌석 수. 실물 키오스크는 파이 한 대가 모니터 두 대를 한 화면(3840×1080)으로
 * 쓰므로 왼쪽 반 = 책상 1, 오른쪽 반 = 책상 2 다. ?seats=2 로 지정하거나,
 * 화면이 두 배로 넓으면(가로세로비 2.6 이상) 저절로 2좌석이 된다.
 * 보통 브라우저(github.io)에서는 1좌석이다.
 */
function readSeats() {
  const p = new URLSearchParams(globalThis.location?.search ?? '');
  const n = Number.parseInt(p.get('seats') ?? '', 10);
  if (n === 1 || n === 2) return n;
  const w = globalThis.innerWidth ?? 0, h = globalThis.innerHeight ?? 1;
  return w / h >= 2.6 ? 2 : 1;
}
export const SEATS = readSeats();

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
    'PRESENT_MS', 'GAP_MS', 'COUNTDOWN_MS', 'FEEDBACK_MS', 'WRONG_HOLD_MS',
    'MISS_MS', 'HEART_BREAK_DELAY_MS',
    'INTRO_MIN_MS', 'LEVEL_CLEAR_MS', 'ATTRACT_IDLE_MS', 'GAMEOVER_IDLE_MS',
  ]) {
    CONFIG[key] = Math.round(CONFIG[key] / 3);
  }
}

/**
 * ?game=4&level=3&round=2 → 해당 게임·단계·라운드에서 바로 시작 (목숨은 기본값).
 * 범위를 벗어난 값은 무시하고 정상 시작한다.
 */
function readCheat() {
  const clamp = (raw, min, max) => {
    const n = Number.parseInt(raw ?? '', 10);
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  const game = clamp(params.get('game'), 1, CONFIG.GAME_TYPES);
  const level = clamp(params.get('level'), 1, CONFIG.LEVELS);
  const round = clamp(params.get('round'), 1, CONFIG.ROUNDS_PER_LEVEL);
  if (game === null && level === null && round === null) return null;
  return { game: game ?? 1, level: level ?? 1, round: round ?? 1 };
}

export const CHEAT = readCheat();
