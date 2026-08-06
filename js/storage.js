/**
 * storage.js — 로컬 최고기록 저장/로드 (설계명세서 §6).
 *
 * 기록은 게임 종류별로 따로 둔다 — 색상 4개 기억과 혼합 2개 기억은
 * 난이도가 달라 하나의 줄로 비교할 수 없다.
 *
 * localStorage 접근이 막힌 환경(file:// 프로토콜, 시크릿 모드 등)에서도
 * 게임 자체는 멀쩡히 돌아가야 하므로 모든 접근을 조용히 감싼다.
 */
import { compareRecord } from './games.js';

// v2: 게임 구조 개편(종류 선택 + 단계×라운드)으로 기록의 의미가 바뀌어 키를 올렸다.
// 옛 키(torus-memory.best)의 "3차 5단계" 기록은 새 구조와 비교할 수 없다.
const KEY_BEST = 'torus-memory.best.v2';

/** @typedef {{level: number, round: number, clearCount: number}} TypeRecord */
/** @typedef {{types: Record<number, TypeRecord>, updatedAt: string|null}} BestRecord */

const EMPTY_TYPE = { level: 0, round: 0, clearCount: 0 };

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
 * 저장된 최고기록을 읽는다. 없거나 깨졌으면 빈 기록을 돌려준다.
 * @returns {BestRecord}
 */
export function loadBest() {
  const raw = safeGet(KEY_BEST);
  const empty = { types: {}, updatedAt: null };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw);
    const types = {};
    for (const [k, v] of Object.entries(parsed.types ?? {})) {
      types[Number(k)] = {
        level: Number(v.level) || 0,
        round: Number(v.round) || 0,
        clearCount: Number(v.clearCount) || 0,
      };
    }
    return { types, updatedAt: parsed.updatedAt ?? null };
  } catch {
    return empty;
  }
}

/** @param {BestRecord} record */
export function saveBest(record) {
  safeSet(KEY_BEST, JSON.stringify({ ...record, updatedAt: new Date().toISOString() }));
}

/**
 * 특정 게임 종류의 기록을 읽는다 (없으면 0 기록).
 * @param {number} game 1..4
 * @returns {TypeRecord}
 */
export function bestFor(game) {
  return loadBest().types[game] ?? { ...EMPTY_TYPE };
}

/**
 * 이번 판 도달 기록을 반영한다. 그 게임 종류의 기존 기록보다 나을 때만 갱신한다.
 * @param {number} game 게임 종류 1..4
 * @param {{level: number, round: number}} reached 도달 지점
 * @returns {{updated: boolean, best: TypeRecord}}
 */
export function submitRecord(game, reached) {
  const all = loadBest();
  const current = all.types[game] ?? { ...EMPTY_TYPE };
  const isBetter = compareRecord(reached, current) > 0;
  if (!isBetter) return { updated: false, best: current };

  const next = { ...current, level: reached.level, round: reached.round };
  all.types[game] = next;
  saveBest(all);
  return { updated: true, best: next };
}

/**
 * 해당 게임 종류의 완주 횟수를 1 올린다.
 * @param {number} game
 * @returns {TypeRecord}
 */
export function bumpAllClear(game) {
  const all = loadBest();
  const current = all.types[game] ?? { ...EMPTY_TYPE };
  const next = { ...current, clearCount: current.clearCount + 1 };
  all.types[game] = next;
  saveBest(all);
  return next;
}

/** 그 게임 종류에 기록이 하나라도 있는지 */
export function hasRecord(typeRecord) {
  return (typeRecord?.level ?? 0) > 0;
}

/** 전 종류 완주 횟수 합 — 타이틀 요약용 */
export function totalClearCount(best = loadBest()) {
  return Object.values(best.types).reduce((sum, t) => sum + (t.clearCount || 0), 0);
}
