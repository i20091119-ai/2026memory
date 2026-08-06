/**
 * storage.js — 완주 횟수 저장/로드.
 *
 * 부스 운영이라 매번 다른 사람이 오고, 게임에는 끝(4개 기억 5/5 완주)이 있다.
 * 그래서 "최고 기록" 같은 하이스코어는 저장하지 않는다 — 특정인의 기록도 아니고,
 * 며칠이면 만점에 닿아 영영 안 바뀌는 죽은 숫자가 된다.
 * 계속 쌓여서 의미가 있는 것은 **게임별 완주 횟수** 하나뿐이다.
 *
 * localStorage 접근이 막힌 환경(file:// 프로토콜, 시크릿 모드 등)에서도
 * 게임 자체는 멀쩡히 돌아가야 하므로 모든 접근을 조용히 감싼다.
 */

const KEY = 'torus-memory.clears.v2';

function safeGet(key) {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    globalThis.localStorage?.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * 게임별 완주 횟수를 읽는다. 없거나 깨졌으면 빈 기록.
 * @returns {Record<number, number>} 게임 번호(1..4) → 완주 횟수
 */
export function loadClears() {
  const raw = safeGet(KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    const out = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) out[Number(k)] = n;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * 특정 게임의 완주 횟수.
 * @param {number} game 1..4
 */
export function clearCountFor(game) {
  return loadClears()[game] ?? 0;
}

/**
 * 해당 게임의 완주 횟수를 1 올린다.
 * @param {number} game
 * @returns {number} 갱신된 횟수
 */
export function bumpAllClear(game) {
  const clears = loadClears();
  const next = (clears[game] ?? 0) + 1;
  clears[game] = next;
  safeSet(KEY, JSON.stringify(clears));
  return next;
}

/** 전 게임 완주 횟수 합 — 타이틀 요약용 */
export function totalClearCount() {
  return Object.values(loadClears()).reduce((sum, n) => sum + n, 0);
}
