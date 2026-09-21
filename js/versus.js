/**
 * versus.js — 2인 대결 규칙 (DOM 무의존 순수 함수, node --test 대상).
 *
 * 규칙
 * - 같은 문제가 두 좌석에 동시에 나온다. 먼저 전부 맞힌 쪽이 그 라운드 1점.
 * - 틀리면 그 라운드에서 탈락 — 상대가 맞히면 상대 점수, 둘 다 틀리면 무효(다시).
 * - 라운드마다 기억할 개수가 정해져 있다 (기본 1,1,2,2,3,3,4,4).
 * - 먼저 winPoints(기본 5)를 따면 끝. 정해진 라운드를 다 돌고도 못 가르면
 *   앞선 쪽이 승리, 동점이면 마지막 길이로 서든데스.
 */

/**
 * @typedef {{rounds: number[], winPoints: number, index: number,
 *            scores: [number, number], history: (0|1|null)[]}} Match
 */

/**
 * @param {{rounds: number[], winPoints: number}} cfg
 * @returns {Match}
 */
export function createMatch(cfg) {
  return {
    rounds: [...cfg.rounds],
    winPoints: cfg.winPoints,
    index: 0,
    scores: [0, 0],
    history: [],
  };
}

/** 지금 라운드에서 기억할 개수. 정해진 라운드를 넘기면(서든데스) 마지막 길이. */
export function currentLength(match) {
  const r = match.rounds;
  return match.index < r.length ? r[match.index] : r[r.length - 1];
}

export function isSuddenDeath(match) {
  return match.index >= match.rounds.length;
}

/**
 * 라운드 결과를 반영한 새 경기 상태.
 * @param {Match} match
 * @param {0|1|null} winner 이긴 좌석, 무효면 null
 * @returns {Match}
 */
export function applyRound(match, winner) {
  const scores = [match.scores[0], match.scores[1]];
  if (winner === 0 || winner === 1) scores[winner]++;
  return {
    ...match,
    scores: /** @type {[number, number]} */ (scores),
    index: match.index + 1,
    history: [...match.history, winner],
  };
}

/**
 * 경기가 끝났는지, 끝났으면 누가 이겼는지.
 * @param {Match} match
 * @returns {{done: boolean, winner: 0|1|null, suddenDeath: boolean}}
 */
export function matchStatus(match) {
  const [a, b] = match.scores;
  if (a >= match.winPoints || b >= match.winPoints) {
    return { done: true, winner: a > b ? 0 : 1, suddenDeath: false };
  }
  if (match.index >= match.rounds.length) {
    if (a !== b) return { done: true, winner: a > b ? 0 : 1, suddenDeath: false };
    return { done: false, winner: null, suddenDeath: true };
  }
  return { done: false, winner: null, suddenDeath: false };
}

/**
 * @typedef {{state: 'pending'|'cleared'|'failed', at?: number}} SeatRecall
 */

/**
 * 두 좌석의 회상 진행을 보고 라운드가 결정됐는지 판정한다.
 *
 *   한쪽이 다 맞힘           → 그쪽 승 (상대가 아직 입력 중이어도 끝)
 *   둘 다 다 맞힘            → 먼저 끝낸 쪽 승
 *   둘 다 틀림               → 무효
 *   한쪽 틀림, 한쪽 입력 중  → 아직 (상대가 맞힐 수도, 틀릴 수도)
 *
 * @param {SeatRecall} a
 * @param {SeatRecall} b
 * @returns {{decided: boolean, winner: 0|1|null}}
 */
export function judgeRace(a, b) {
  const ac = a.state === 'cleared', bc = b.state === 'cleared';
  if (ac && bc) return { decided: true, winner: (a.at ?? 0) <= (b.at ?? 0) ? 0 : 1 };
  if (ac) return { decided: true, winner: 0 };
  if (bc) return { decided: true, winner: 1 };
  if (a.state === 'failed' && b.state === 'failed') return { decided: true, winner: null };
  return { decided: false, winner: null };
}

/**
 * 도전 프롬프트의 남은 시간을 줄인다.
 * 상대가 흰색이 아닌 버튼을 누르면(= 하던 걸 계속하면) 그만큼 빨리 지나간다.
 * @param {number} remainingMs
 * @param {number} penaltyMs
 */
export function shrinkChallenge(remainingMs, penaltyMs) {
  return Math.max(0, remainingMs - penaltyMs);
}
