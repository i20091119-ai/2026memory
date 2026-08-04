/**
 * games.js — 3개 게임의 시퀀스 생성·보기 생성·판정 로직.
 *
 * 이 파일은 순수 함수만 담는다. DOM·config.js·브라우저 API에 의존하지 않으므로
 * `node --test` 로 그대로 테스트할 수 있다 (설계명세서 §7).
 * 난수는 항상 인자로 주입받아(rng) 테스트에서 결정적으로 만들 수 있게 한다.
 */

/** 버튼 인덱스 표준: 0=빨강, 1=노랑, 2=초록, 3=파랑 (전 코드베이스 고정) */
export const RED = 0, YELLOW = 1, GREEN = 2, BLUE = 3;

/** 차수 식별자 */
export const GAME_COLOR = 1, GAME_DIGIT = 2, GAME_SHAPE = 3;

/** 같은 값이 몇 번까지 연속으로 나올 수 있는가 (3연속부터 재추첨) */
export const MAX_RUN = 2;

/**
 * 결정적 난수 생성기 (mulberry32). 테스트·어트랙트 데모용.
 * @param {number} seed
 * @returns {() => number} [0,1) 난수 함수
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 배열에서 무작위 한 개를 고른다.
 * @template T
 * @param {T[]} pool
 * @param {() => number} rng
 * @returns {T}
 */
export function pick(pool, rng = Math.random) {
  return pool[Math.floor(rng() * pool.length) % pool.length];
}

/**
 * 배열을 제자리에서 섞는다 (Fisher-Yates).
 * @template T
 * @param {T[]} arr
 * @param {() => number} rng
 * @returns {T[]} 같은 배열 참조
 */
export function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 길이 n 짜리 랜덤 시퀀스를 만든다.
 * 연속 중복은 허용하되 같은 값 3연속은 금지한다 (설계명세서 §3.2).
 * @template T
 * @param {number} length
 * @param {T[]} pool 값 후보 (2개 이상)
 * @param {() => number} rng
 * @returns {T[]}
 */
export function randomSequence(length, pool, rng = Math.random) {
  if (length <= 0) return [];
  if (!pool || pool.length < 2) {
    throw new Error('randomSequence: pool 은 2개 이상이어야 한다');
  }
  const out = [];
  for (let i = 0; i < length; i++) {
    let value = pick(pool, rng);
    // 직전 MAX_RUN 개가 모두 같은 값이면 다른 값이 나올 때까지 재추첨
    while (isRunTooLong(out, value)) value = pick(pool, rng);
    out.push(value);
  }
  return out;
}

/**
 * value 를 이어붙이면 같은 값이 MAX_RUN 을 초과해 연속되는지 검사.
 * @param {any[]} seq 지금까지의 시퀀스
 * @param {any} value 이어붙일 값
 * @returns {boolean}
 */
function isRunTooLong(seq, value) {
  if (seq.length < MAX_RUN) return false;
  for (let i = seq.length - MAX_RUN; i < seq.length; i++) {
    if (seq[i] !== value) return false;
  }
  return true;
}

/**
 * 4지선다 보기를 만든다 (설계명세서 §3.4 / §3.5).
 * 정답 1개 + 서로 다른 오답 3개, 배치는 랜덤.
 * 반환 배열의 인덱스가 곧 버튼 색 인덱스다 (0=빨,1=노,2=초,3=파).
 * @template T
 * @param {T} answer 정답 값
 * @param {T[]} pool 전체 후보 값 (answer 포함, count 개 이상)
 * @param {() => number} rng
 * @param {number} count 보기 개수 (기본 4)
 * @returns {T[]} 길이 count, 중복 없음, answer 포함
 */
export function makeChoices(answer, pool, rng = Math.random, count = 4) {
  const distractors = pool.filter((v) => v !== answer);
  if (distractors.length < count - 1) {
    throw new Error('makeChoices: 오답을 만들 후보가 부족하다');
  }
  shuffle(distractors, rng);
  const choices = distractors.slice(0, count - 1);
  choices.push(answer);
  return shuffle(choices, rng);
}

/**
 * 4지선다에서 정답 카드의 위치(=눌러야 하는 버튼 인덱스)를 찾는다.
 * @template T
 * @param {T[]} choices
 * @param {T} answer
 * @returns {number} 0..3
 */
export function answerIndex(choices, answer) {
  return choices.indexOf(answer);
}

/**
 * 회상 중 k번째 입력을 판정한다.
 * 오답이 하나라도 나오면 그 즉시 MISS 이므로 남은 항목은 묻지 않는다 (§3.1).
 * @param {any[]} expected 정답 시퀀스(회상 화면 기준으로 변환된 값)
 * @param {number} index 지금 입력받은 항목 번호 (0-based)
 * @param {any} value 입력값
 * @returns {{ok: boolean, done: boolean}} ok=정답 여부, done=시퀀스 전체 완료 여부
 */
export function judgeStep(expected, index, value) {
  const ok = expected[index] === value;
  return { ok, done: ok && index + 1 >= expected.length };
}

/**
 * 단계 클리어 후 다음 목적지를 계산한다 (§3.1 상태 머신).
 * @param {number} game 현재 차수 1..totalGames
 * @param {number} level 현재 단계 1..levelsPerGame
 * @param {{levelsPerGame?: number, totalGames?: number}} opts
 * @returns {{kind: 'nextLevel'|'nextGame'|'allClear', game: number, level: number}}
 */
export function nextAfterClear(game, level, opts = {}) {
  const levelsPerGame = opts.levelsPerGame ?? 5;
  const totalGames = opts.totalGames ?? 3;
  if (level < levelsPerGame) {
    return { kind: 'nextLevel', game, level: level + 1 };
  }
  if (game < totalGames) {
    return { kind: 'nextGame', game: game + 1, level: 1 };
  }
  return { kind: 'allClear', game, level };
}

/**
 * 오답 후 다음 목적지를 계산한다 (§3.1).
 * 목숨이 남아 있으면 같은 단계를 새 시퀀스로 재도전한다.
 * @param {number} lives 차감 전 목숨
 * @returns {{kind: 'retry'|'gameOver', lives: number}}
 */
export function nextAfterMiss(lives) {
  const remaining = Math.max(0, lives - 1);
  return { kind: remaining > 0 ? 'retry' : 'gameOver', lives: remaining };
}

/**
 * 기록 비교 — (차수, 단계) 사전식 (§6).
 * @param {{game: number, level: number}|null} a
 * @param {{game: number, level: number}|null} b
 * @returns {number} a>b 면 1, 같으면 0, a<b 면 -1
 */
export function compareRecord(a, b) {
  const ag = a?.game ?? 0, al = a?.level ?? 0;
  const bg = b?.game ?? 0, bl = b?.level ?? 0;
  if (ag !== bg) return ag > bg ? 1 : -1;
  if (al !== bl) return al > bl ? 1 : -1;
  return 0;
}

/**
 * 차수별 값 후보 풀을 돌려준다.
 * @param {number} game 1|2|3
 * @param {{digitMin?: number, digitMax?: number, shapes?: string[]}} opts
 * @returns {(number|string)[]}
 */
export function poolFor(game, opts = {}) {
  if (game === GAME_COLOR) return [RED, YELLOW, GREEN, BLUE];
  if (game === GAME_DIGIT) {
    const min = opts.digitMin ?? 0, max = opts.digitMax ?? 9;
    const out = [];
    for (let d = min; d <= max; d++) out.push(d);
    return out;
  }
  if (game === GAME_SHAPE) {
    return (opts.shapes ?? []).slice();
  }
  throw new Error('poolFor: 알 수 없는 차수 ' + game);
}

/**
 * 한 단계에 필요한 모든 랜덤 데이터를 한 번에 만든다.
 *
 * - 1차(색깔): 회상이 버튼 직접 입력이므로 보기(choices)가 없다.
 * - 2·3차: 항목마다 4지선다 보기를 미리 만들어 둔다. 각 보기 배열의
 *   인덱스가 곧 눌러야 할 버튼 색이며, `answers[k]` 가 정답 버튼 인덱스다.
 * - 3차: 제시할 때 쓸 교란용 색(presentColors)도 함께 뽑는다 (§3.5).
 *
 * @param {number} game 1|2|3
 * @param {number} level 1..5 (=항목 개수)
 * @param {{digitMin?: number, digitMax?: number, shapes?: string[], rng?: () => number}} opts
 * @returns {{game: number, level: number, sequence: (number|string)[],
 *            choices: (number|string)[][]|null, answers: number[],
 *            presentColors: number[]|null}}
 */
export function buildRound(game, level, opts = {}) {
  const rng = opts.rng ?? Math.random;
  const pool = poolFor(game, opts);
  const sequence = randomSequence(level, pool, rng);

  if (game === GAME_COLOR) {
    return {
      game, level, sequence,
      choices: null,
      // 색깔 게임은 시퀀스 값 자체가 눌러야 할 버튼 인덱스다.
      answers: sequence.slice(),
      presentColors: null,
    };
  }

  const choices = sequence.map((answer) => makeChoices(answer, pool, rng));
  const answers = choices.map((c, k) => answerIndex(c, sequence[k]));
  const presentColors = game === GAME_SHAPE
    ? sequence.map(() => pick([RED, YELLOW, GREEN, BLUE], rng))
    : null;

  return { game, level, sequence, choices, answers, presentColors };
}
