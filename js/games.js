/**
 * games.js — 4개 게임의 시퀀스 생성·보기 생성·판정 로직.
 *
 * 이 파일은 순수 함수만 담는다. DOM·config.js·브라우저 API에 의존하지 않으므로
 * `node --test` 로 그대로 테스트할 수 있다 (설계명세서 §7).
 * 난수는 항상 인자로 주입받아(rng) 테스트에서 결정적으로 만들 수 있게 한다.
 *
 * 게임 구조 (v2):
 *   시작할 때 게임 종류를 하나 고른다 — 색상 / 숫자 / 모양 / 혼합.
 *   한 게임은 1단계(1개 기억)부터 4단계(4개 기억)까지, 단계마다 5라운드씩이다.
 *   혼합은 항목 하나하나가 색상·숫자·모양 중에서 랜덤으로 나온다.
 */

/** 버튼 인덱스 표준: 0=빨강, 1=노랑, 2=초록, 3=파랑 (전 코드베이스 고정) */
export const RED = 0, YELLOW = 1, GREEN = 2, BLUE = 3;

/**
 * 게임(항목 종류) 식별자. 1~3은 항목 종류이기도 하다 — 혼합 게임의 각 항목은
 * 이 셋 중 하나의 kind 를 가진다.
 */
export const GAME_COLOR = 1, GAME_DIGIT = 2, GAME_SHAPE = 3, GAME_MIXED = 4;

/** 혼합 게임에서 항목마다 뽑는 종류 후보 */
export const MIXED_KINDS = [GAME_COLOR, GAME_DIGIT, GAME_SHAPE];

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
 * 라운드 클리어 후 다음 목적지를 계산한다 (상태 머신 v2).
 * 같은 단계를 roundsPerLevel 번 반복한 뒤 다음 단계로, 마지막 단계의 마지막
 * 라운드를 깨면 완주다.
 * @param {number} level 현재 단계 1..levels (= 기억할 개수)
 * @param {number} round 현재 라운드 1..roundsPerLevel
 * @param {{levels?: number, roundsPerLevel?: number}} opts
 * @returns {{kind: 'nextRound'|'nextLevel'|'allClear', level: number, round: number}}
 */
export function nextAfterClear(level, round, opts = {}) {
  const levels = opts.levels ?? 4;
  const roundsPerLevel = opts.roundsPerLevel ?? 5;
  if (round < roundsPerLevel) {
    return { kind: 'nextRound', level, round: round + 1 };
  }
  if (level < levels) {
    return { kind: 'nextLevel', level: level + 1, round: 1 };
  }
  return { kind: 'allClear', level, round };
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
 * 진행도 비교 — (단계, 라운드) 사전식.
 * @param {{level: number, round: number}|null} a
 * @param {{level: number, round: number}|null} b
 * @returns {number} a>b 면 1, 같으면 0, a<b 면 -1
 */
export function compareRecord(a, b) {
  const al = a?.level ?? 0, ar = a?.round ?? 0;
  const bl = b?.level ?? 0, br = b?.round ?? 0;
  if (al !== bl) return al > bl ? 1 : -1;
  if (ar !== br) return ar > br ? 1 : -1;
  return 0;
}

/**
 * 항목 종류별 값 후보 풀을 돌려준다.
 * @param {number} kind 1|2|3 (혼합은 항목 단위로 이 셋 중 하나)
 * @param {{digitMin?: number, digitMax?: number, shapes?: string[]}} opts
 * @returns {(number|string)[]}
 */
export function poolFor(kind, opts = {}) {
  if (kind === GAME_COLOR) return [RED, YELLOW, GREEN, BLUE];
  if (kind === GAME_DIGIT) {
    const min = opts.digitMin ?? 0, max = opts.digitMax ?? 9;
    const out = [];
    for (let d = min; d <= max; d++) out.push(d);
    return out;
  }
  if (kind === GAME_SHAPE) {
    return (opts.shapes ?? []).slice();
  }
  throw new Error('poolFor: 알 수 없는 종류 ' + kind);
}

/**
 * @typedef {{kind: number, value: number|string,
 *            choices: (number|string)[]|null, answer: number,
 *            presentColor: number|null}} RoundItem
 *
 * kind 별 규칙:
 * - 색상: 보기 없음. 그 색 버튼을 직접 누른다 → answer = 색 인덱스.
 * - 숫자·모양: 4지선다. choices 의 인덱스가 곧 버튼 색이고 answer 가 정답 칸.
 * - 모양: 제시할 때 쓸 교란용 색(presentColor)을 함께 뽑는다.
 */

/**
 * 한 라운드에 필요한 모든 랜덤 데이터를 한 번에 만든다.
 *
 * 항목 수 = level. 순수 게임(1~3)은 모든 항목의 kind 가 같고,
 * 혼합(4)은 항목마다 색상·숫자·모양 중 하나가 랜덤으로 정해진다.
 *
 * @param {number} game 1|2|3|4
 * @param {number} level 1..4 (=항목 개수)
 * @param {{digitMin?: number, digitMax?: number, shapes?: string[], rng?: () => number}} opts
 * @returns {{game: number, level: number, items: RoundItem[]}}
 */
export function buildRound(game, level, opts = {}) {
  const rng = opts.rng ?? Math.random;

  // 항목마다 종류를 정한다. 혼합이면 랜덤, 아니면 게임 종류 그대로.
  const kinds = game === GAME_MIXED
    ? Array.from({ length: level }, () => pick(MIXED_KINDS, rng))
    : Array.from({ length: level }, () => game);

  // 값 시퀀스는 종류별로 따로 뽑는다 — "같은 값 3연속 금지"가 종류 안에서 걸린다.
  // (혼합에서 색상 2 · 숫자 7 은 애초에 다른 값이라 연속 제한과 무관하다)
  const byKind = new Map();
  for (const kind of new Set(kinds)) {
    const count = kinds.filter((k) => k === kind).length;
    byKind.set(kind, {
      pool: poolFor(kind, opts),
      values: randomSequence(count, poolFor(kind, opts), rng),
      next: 0,
    });
  }

  const items = kinds.map((kind) => {
    const bucket = byKind.get(kind);
    const value = bucket.values[bucket.next++];

    if (kind === GAME_COLOR) {
      return { kind, value, choices: null, answer: value, presentColor: null };
    }
    const choices = makeChoices(value, bucket.pool, rng);
    return {
      kind, value, choices,
      answer: answerIndex(choices, value),
      presentColor: kind === GAME_SHAPE ? pick([RED, YELLOW, GREEN, BLUE], rng) : null,
    };
  });

  return { game, level, items };
}
