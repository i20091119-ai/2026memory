/**
 * storage.js — 로컬 최고기록 저장/로드 (설계명세서 §6).
 *
 * localStorage 접근이 막힌 환경(file:// 프로토콜, 시크릿 모드 등)에서도
 * 게임 자체는 멀쩡히 돌아가야 하므로 모든 접근을 조용히 감싼다.
 */
import { compareRecord } from './games.js';

const KEY_BEST = 'torus-memory.best';

/** @typedef {{bestGame: number, bestLevel: number, allClearCount: number, updatedAt: string}} BestRecord */

const EMPTY = { bestGame: 0, bestLevel: 0, allClearCount: 0, updatedAt: null };

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
  if (!raw) return { ...EMPTY };
  try {
    const parsed = JSON.parse(raw);
    return {
      bestGame: Number(parsed.bestGame) || 0,
      bestLevel: Number(parsed.bestLevel) || 0,
      allClearCount: Number(parsed.allClearCount) || 0,
      updatedAt: parsed.updatedAt ?? null,
    };
  } catch {
    return { ...EMPTY };
  }
}

/**
 * 기록을 통째로 저장한다.
 * @param {BestRecord} record
 */
export function saveBest(record) {
  safeSet(KEY_BEST, JSON.stringify({ ...record, updatedAt: new Date().toISOString() }));
}

/**
 * 이번 판 도달 기록을 반영한다. 기존 기록보다 나을 때만 갱신한다.
 * @param {number} game 도달한 차수
 * @param {number} level 도달한 단계
 * @returns {{updated: boolean, best: BestRecord}} updated=신기록 여부
 */
export function submitRecord(game, level) {
  const best = loadBest();
  const isBetter = compareRecord(
    { game, level },
    { game: best.bestGame, level: best.bestLevel },
  ) > 0;
  if (!isBetter) return { updated: false, best };

  const next = { ...best, bestGame: game, bestLevel: level };
  saveBest(next);
  return { updated: true, best: next };
}

/**
 * 올클리어 횟수를 1 올린다.
 * @returns {BestRecord} 갱신된 기록
 */
export function bumpAllClear() {
  const best = loadBest();
  const next = { ...best, allClearCount: best.allClearCount + 1 };
  saveBest(next);
  return next;
}

/** 기록이 하나라도 있는지 */
export function hasRecord(best) {
  return best.bestGame > 0 && best.bestLevel > 0;
}
