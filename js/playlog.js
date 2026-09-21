/**
 * playlog.js — 플레이 기록 (한 판 = 한 줄) 과 그 집계.
 *
 * 부스를 한 달 돌려 보니 "반응이 좋다"는 말은 되는데 숫자가 없었다.
 * 몇 판이나 했는지, 어느 게임이 인기인지, 몇 개 기억에서 다들 죽는지를
 * 알아야 다음에 무엇을 고칠지 근거로 정할 수 있다. 그래서 판마다 한 줄씩 남긴다.
 *
 * 개인정보는 아무것도 없다 — 시각·게임·어디까지 갔나·결과·소요 시간뿐이다.
 * 기기의 localStorage 안에만 쌓이고 어디로도 보내지 않는다.
 *
 * 한 줄의 생김새 (저장 크기를 아끼려고 키를 짧게 쓴다):
 *   { t: 시작 시각(ms), g: 게임 1..4, l: 도달 단계, r: 도달 라운드,
 *     res: 'clear'|'over'|'quit', ms: 소요, c: 이어하기 횟수, m: 오답 횟수 }
 *
 *   res  clear = 완주 / over = 목숨 소진 후 그만둠 / quit = 빨+파 홀드로 중도 이탈
 *   l, r 는 "들어선" 가장 먼 지점이다 (3개 기억 1라운드에서 죽었으면 l=3, r=1).
 *
 * 집계(summarize)·CSV(toCsv)는 DOM 없이 순수 함수라 node --test 로 검증한다.
 */

const KEY = 'torus-memory.log.v1';

/** 이보다 많이 쌓이면 오래된 것부터 버린다. 한 줄 ~80B 라 5천 줄이어도 400KB 남짓. */
export const MAX_ENTRIES = 5000;

export const RESULTS = ['clear', 'over', 'quit'];

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

/** 저장된 한 줄이 쓸 만한 모양인지. 깨진 줄은 조용히 버린다. */
export function isValidEntry(e) {
  return !!e && typeof e === 'object'
    && Number.isFinite(e.t) && e.t > 0
    && Number.isInteger(e.g) && e.g >= 1
    && Number.isInteger(e.l) && e.l >= 1
    && Number.isInteger(e.r) && e.r >= 1
    && RESULTS.includes(e.res)
    && Number.isFinite(e.ms) && e.ms >= 0;
}

/** @returns {object[]} 시간순 (오래된 것 먼저) */
export function loadLog() {
  const raw = safeGet(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidEntry) : [];
  } catch {
    return [];
  }
}

export function clearLog() {
  return safeSet(KEY, '[]');
}

/**
 * 한 판의 시작을 표시한다. 끝날 때 finishRun 에 넘긴다.
 * @param {number} game 1..4
 */
export function startRun(game, now = Date.now()) {
  return { t: now, g: game };
}

/**
 * 한 판을 마감해 저장한다.
 * @param {{t:number, g:number}|null} run startRun 의 반환값. null 이면 아무것도 안 한다 (치트 시작 등)
 * @param {{level:number, round:number, result:'clear'|'over'|'quit',
 *          continues?:number, misses?:number}} end
 * @returns {object|null} 저장된 줄
 */
export function finishRun(run, end, now = Date.now()) {
  if (!run) return null;
  const entry = {
    t: run.t,
    g: run.g,
    l: end.level,
    r: end.round,
    res: end.result,
    ms: Math.max(0, now - run.t),
    c: end.continues ?? 0,
    m: end.misses ?? 0,
  };
  if (!isValidEntry(entry)) return null;

  const log = loadLog();
  log.push(entry);
  if (log.length > MAX_ENTRIES) log.splice(0, log.length - MAX_ENTRIES);
  safeSet(KEY, JSON.stringify(log));
  return entry;
}

/* ------------------------------------------------------------------ *
 * 기간
 * ------------------------------------------------------------------ */

export const PERIODS = ['month', 'lastMonth', 'today', 'all'];

/**
 * 기간 이름 → [from, to) 시각. to 가 null 이면 끝 제한 없음.
 * 전부 기기의 현지 시간 기준이다 (부스 운영 시간표와 맞아야 하니까).
 * @param {'today'|'month'|'lastMonth'|'all'} period
 * @param {Date} [now]
 */
export function periodRange(period, now = new Date()) {
  const y = now.getFullYear();
  const mo = now.getMonth();
  switch (period) {
    case 'today':
      return { from: new Date(y, mo, now.getDate()).getTime(), to: null };
    case 'month':
      return { from: new Date(y, mo, 1).getTime(), to: null };
    case 'lastMonth':
      return { from: new Date(y, mo - 1, 1).getTime(), to: new Date(y, mo, 1).getTime() };
    default:
      return { from: 0, to: null };
  }
}

export function inRange(entry, { from, to }) {
  return entry.t >= from && (to === null || entry.t < to);
}

/* ------------------------------------------------------------------ *
 * 집계
 * ------------------------------------------------------------------ */

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * 기록 묶음을 운영자 화면이 그릴 수 있는 숫자들로 접는다.
 *
 * @param {object[]} entries
 * @param {{games?: number, levels?: number}} [opts] 게임 수·단계 수 (기본 4·4)
 */
export function summarize(entries, opts = {}) {
  const games = opts.games ?? 4;
  const levels = opts.levels ?? 4;

  const out = {
    plays: entries.length,
    clears: 0,
    overs: 0,
    quits: 0,
    continues: 0,
    misses: 0,
    clearRate: null,
    medianMs: null,
    /** 게임 번호 → {plays, clears} */
    byGame: {},
    /** funnel[i] = i+1 개 기억에 "들어선" 판 수. 마지막 칸은 완주 수. */
    funnel: new Array(levels + 1).fill(0),
    /** diedAt[L] = L개 기억에서 목숨을 다 쓴 판 수 (over 만) */
    diedAt: {},
    /** 시(0..23) 별 판 수 */
    byHour: new Array(24).fill(0),
    first: null,
    last: null,
  };
  for (let g = 1; g <= games; g++) out.byGame[g] = { plays: 0, clears: 0 };
  for (let l = 1; l <= levels; l++) out.diedAt[l] = 0;

  const durations = [];

  for (const e of entries) {
    const bg = out.byGame[e.g] ?? (out.byGame[e.g] = { plays: 0, clears: 0 });
    bg.plays++;
    out.continues += e.c ?? 0;
    out.misses += e.m ?? 0;
    durations.push(e.ms);

    if (e.res === 'clear') {
      out.clears++;
      bg.clears++;
    } else if (e.res === 'over') {
      out.overs++;
      out.diedAt[e.l] = (out.diedAt[e.l] ?? 0) + 1;
    } else {
      out.quits++;
    }

    // 들어선 단계까지 전부 센다: l=3 이면 1·2·3 개 기억 칸에 하나씩
    const top = Math.min(e.l, levels);
    for (let i = 0; i < top; i++) out.funnel[i]++;
    if (e.res === 'clear') out.funnel[levels]++;

    out.byHour[new Date(e.t).getHours()]++;

    if (out.first === null || e.t < out.first) out.first = e.t;
    if (out.last === null || e.t > out.last) out.last = e.t;
  }

  out.clearRate = out.plays ? out.clears / out.plays : null;
  out.medianMs = median(durations);
  return out;
}

/* ------------------------------------------------------------------ *
 * CSV
 * ------------------------------------------------------------------ */

const pad2 = (n) => String(n).padStart(2, '0');

/** 현지 시각을 "2026-09-21 14:03:07" 로 */
export function formatLocal(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} `
    + `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

const RESULT_LABEL = { clear: '완주', over: '게임오버', quit: '중도이탈' };

/**
 * 엑셀에 바로 열리는 CSV. 호출한 쪽에서 앞에 BOM(﻿) 을 붙여 저장해야
 * 윈도 엑셀이 한글을 깨뜨리지 않는다.
 * @param {object[]} entries
 * @param {Record<number,string>} gameNames 게임 번호 → 이름
 */
export function toCsv(entries, gameNames = {}) {
  const head = ['시각', '게임', '결과', '도달단계', '도달라운드', '소요초', '이어하기', '오답'];
  const rows = entries.map((e) => [
    formatLocal(e.t),
    gameNames[e.g] ?? e.g,
    RESULT_LABEL[e.res] ?? e.res,
    e.l,
    e.r,
    Math.round(e.ms / 1000),
    e.c ?? 0,
    e.m ?? 0,
  ]);
  const cell = (v) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
