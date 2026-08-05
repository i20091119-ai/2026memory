/**
 * strings.js — 모든 화면 문구를 한 곳에 모아 둔다 (설계명세서 §2, §4).
 * 화면에 보이는 텍스트를 고칠 일이 있으면 이 파일만 수정하면 된다.
 */

export const STR = {
  /* 게임 정체성 */
  TITLE: '토러스와 즐기는\n랜덤 메모리 게임',
  TITLE_START: '아무 버튼이나 눌러 시작',
  TITLE_NO_RECORD: '아직 기록이 없어요',
  TITLE_BEST: (game, level) => `최고 기록: ${game}차 ${level}단계`,
  TITLE_ALL_CLEAR_COUNT: (n) => `올클리어 ${n}회`,
  TITLE_GREETING: '안녕! 나는 토러스야. 같이 기억력 대결 해볼래?',

  /* 차수 안내 (GAME_INTRO) */
  GAME_NAME: {
    1: '1차 · 색깔 기억',
    2: '2차 · 숫자 기억',
    3: '3차 · 모양 기억',
  },
  GAME_RULE: {
    1: '나오는 색깔 순서를 외워서, 그 색 버튼을 똑같이 눌러줘!',
    2: '나오는 숫자를 외워둬. 그 숫자가 있는 칸의 색 버튼을 누르면 돼!',
    3: '모양만 외우면 돼 — 색깔은 함정이야! 그 모양이 있는 칸을 눌러줘!',
  },

  /* 조작 안내 */
  EXIT_HINT: '그만하려면 빨강 + 파랑을 2초 동안 함께 누르세요',
  INTRO_PRESS: '아무 버튼이나 누르면 시작!',

  /* 홈으로 돌아가기 */
  HOME_HINT: '빨강+파랑 2초 = 홈',
  HOME_HOLDING: '홈으로 돌아가는 중…',

  /* HUD */
  HUD_STAGE: (game, level) => `${game}차 ${level}단계`,
  HUD_ITEMS: (n) => `${n}개`,
  /** HUD 배지에 들어가는 짧은 차수 이름 */
  GAME_SHORT: { 1: '색깔', 2: '숫자', 3: '모양' },
  HUD_ROUND: (game) => `${game}차`,
  HUD_LEVEL: (level) => `${level}단계`,

  /* 기관 로고 */
  BRAND_ALT: '경상남도교육청 경남수학문화관',

  /* 답안 스트립 — 몇 개 중 몇 번째를 누르고 있는지 */
  STRIP_PRESENT: (total) => `${total}개를 외워주세요`,
  STRIP_RECALL: (k, total) => `${total}개 중 ${k}번째`,
  STRIP_DONE: '완성!',
  STRIP_WRONG: (k, total) => `${total}개 중 ${k}번째 — 틀렸어요!`,

  /* 제시(PRESENT) */
  PRESENT_WATCH: '잘 봐!',
  /* 카운트다운은 한글로 읽는다.
     2차(숫자)에서 3·2·1 을 아라비아 숫자로 띄우면 외워야 할 숫자와 생김새가
     똑같아서 "이게 카운트인가 문제인가" 헷갈린다. 한글이면 절대 안 겹친다. */
  COUNTDOWN_WORDS: ['셋', '둘', '하나'],
  COUNTDOWN_HINT: '곧 시작해요',
  PRESENT_READY: '시작!',

  /* 회상(RECALL) */
  RECALL_COLOR_PROMPT: '외운 순서대로 눌러!',
  RECALL_ORDINAL: ['첫 번째', '두 번째', '세 번째', '네 번째', '다섯 번째'],
  RECALL_DIGIT_PROMPT: (k) => `${STR.RECALL_ORDINAL[k]} 숫자는?`,
  RECALL_SHAPE_PROMPT: (k) => `${STR.RECALL_ORDINAL[k]} 모양은?`,

  /* 단계 클리어 */
  LEVEL_CLEAR: '단계 클리어!',
  LEVEL_CLEAR_CHEER: ['좋았어!', '완벽해!', '기억력 대단한데?', '역시!', '착착 맞추네!'],

  /* 오답 */
  MISS: '땡!',
  MISS_ANSWER: '정답은 이거였어!',
  MISS_ENCOURAGE: '괜찮아, 다시 해보자!',

  /* 게임 오버 */
  GAME_OVER: '게임 오버',
  GAME_OVER_REACHED: (game, level) => `도달 기록: ${game}차 ${level}단계`,
  GAME_OVER_BEST: (game, level) => `최고 기록: ${game}차 ${level}단계`,
  NEW_RECORD: '신기록!',
  CONTINUE_TITLE: '계속할래?',
  CONTINUE_GREEN: '초록 · 이번 차수부터 이어하기',
  CONTINUE_RED: '빨강 · 처음부터 다시',
  CONTINUE_COUNTDOWN: (sec) => `${sec}초 후 타이틀로 돌아가요`,
  GAME_OVER_SAD: '아쉽다… 한 번 더 해볼까?',

  /* 올클리어 */
  ALL_CLEAR: '올 클리어!',
  ALL_CLEAR_SUB: '3차 5단계까지 전부 클리어했어!',
  ALL_CLEAR_CHEER: '우와, 진짜 대단해! 너 기억력 천재구나!',
  ALL_CLEAR_PRESS: '아무 버튼이나 눌러 타이틀로',

  /* 어트랙트 데모 */
  ATTRACT_BADGE: '데모 플레이',
  ATTRACT_SPEECH: '이렇게 하는 거야!',
  ATTRACT_PRESS: '아무 버튼이나 눌러 시작',

  /* 접속 상태 아이콘 툴팁 */
  WS_CONNECTED: '아케이드 버튼 연결됨',
  WS_OFFLINE: '키보드 모드 (1·2·3·4)',

  /* 모양 이름 — 화면에는 쓰지 않지만 접근성 라벨용 */
  SHAPE_NAME: {
    circle: '동그라미', square: '네모', triangle: '세모', star: '별',
    heart: '하트', diamond: '다이아', moon: '달', cross: '십자',
  },

  /* 색 이름 — 접근성 라벨용 (게임 중 화면에는 표시하지 않는다) */
  COLOR_NAME: ['빨강', '노랑', '초록', '파랑'],
};
