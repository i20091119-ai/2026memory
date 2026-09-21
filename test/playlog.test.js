/**
 * playlog.js 순수 로직 테스트 — 집계·기간·CSV.
 * 저장(localStorage)은 브라우저 몫이라 여기서는 다루지 않는다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isValidEntry, summarize, periodRange, inRange, toCsv, formatLocal,
  startRun, finishRun, MAX_ENTRIES, PERIODS,
} from '../js/playlog.js';

const T0 = new Date(2026, 8, 21, 14, 3, 7).getTime();   // 2026-09-21 14:03:07 (현지)

const entry = (over = {}) => ({
  t: T0, g: 1, l: 2, r: 3, res: 'over', ms: 120000, c: 0, m: 3, ...over,
});

test('isValidEntry: 정상 줄은 통과, 깨진 줄은 거른다', () => {
  assert.ok(isValidEntry(entry()));
  assert.ok(!isValidEntry(null));
  assert.ok(!isValidEntry(entry({ res: 'win' })));
  assert.ok(!isValidEntry(entry({ l: 0 })));
  assert.ok(!isValidEntry(entry({ t: 'yesterday' })));
  assert.ok(!isValidEntry(entry({ ms: -1 })));
});

test('summarize: 빈 기록이면 전부 0 이고 비율은 null', () => {
  const s = summarize([]);
  assert.equal(s.plays, 0);
  assert.equal(s.clearRate, null);
  assert.equal(s.medianMs, null);
  assert.deepEqual(s.funnel, [0, 0, 0, 0, 0]);
  assert.equal(s.first, null);
});

test('summarize: 결과별 집계와 완주율', () => {
  const s = summarize([
    entry({ res: 'clear', l: 4, r: 5, g: 2, ms: 300000 }),
    entry({ res: 'over', l: 3, r: 1, g: 2, ms: 100000 }),
    entry({ res: 'quit', l: 1, r: 2, g: 1, ms: 20000 }),
    entry({ res: 'over', l: 3, r: 4, g: 1, ms: 200000, c: 2 }),
  ]);
  assert.equal(s.plays, 4);
  assert.equal(s.clears, 1);
  assert.equal(s.overs, 2);
  assert.equal(s.quits, 1);
  assert.equal(s.continues, 2);
  assert.equal(s.clearRate, 0.25);
  assert.deepEqual(s.byGame[1], { plays: 2, clears: 0 });
  assert.deepEqual(s.byGame[2], { plays: 2, clears: 1 });
  // 3개 기억에서 두 판이 죽었다
  assert.equal(s.diedAt[3], 2);
  assert.equal(s.diedAt[1], 0);
});

test('summarize: 깔때기는 "들어선 단계"까지 누적이고 마지막 칸은 완주', () => {
  const s = summarize([
    entry({ l: 1, res: 'over' }),                 // 1개 기억에서 사망
    entry({ l: 3, res: 'over' }),                 // 3개 기억까지 들어섬
    entry({ l: 4, r: 5, res: 'clear' }),          // 완주
  ]);
  //            1개 2개 3개 4개 완주
  assert.deepEqual(s.funnel, [3, 2, 2, 1, 1]);
});

test('summarize: 소요 시간 중간값 (짝수 개면 가운데 둘의 평균)', () => {
  const s = summarize([entry({ ms: 10 }), entry({ ms: 30 }), entry({ ms: 20 }), entry({ ms: 100 })]);
  assert.equal(s.medianMs, 25);
  assert.equal(summarize([entry({ ms: 7 })]).medianMs, 7);
});

test('summarize: 시간대는 현지 시각 기준', () => {
  const s = summarize([entry(), entry({ t: new Date(2026, 8, 21, 9, 0).getTime() })]);
  assert.equal(s.byHour[14], 1);
  assert.equal(s.byHour[9], 1);
  assert.equal(s.byHour.reduce((a, b) => a + b, 0), 2);
});

test('periodRange: 오늘·이번 달·지난 달·전체', () => {
  const now = new Date(2026, 8, 21, 14, 0);
  const inToday = new Date(2026, 8, 21, 0, 30).getTime();
  const yesterday = new Date(2026, 8, 20, 23, 59).getTime();
  const lastMonth = new Date(2026, 7, 15).getTime();
  const twoMonths = new Date(2026, 6, 15).getTime();

  const today = periodRange('today', now);
  assert.ok(inRange({ t: inToday }, today));
  assert.ok(!inRange({ t: yesterday }, today));

  const month = periodRange('month', now);
  assert.ok(inRange({ t: yesterday }, month));
  assert.ok(!inRange({ t: lastMonth }, month));

  const last = periodRange('lastMonth', now);
  assert.ok(inRange({ t: lastMonth }, last));
  assert.ok(!inRange({ t: twoMonths }, last));
  assert.ok(!inRange({ t: yesterday }, last));

  const all = periodRange('all', now);
  assert.ok(inRange({ t: twoMonths }, all));
});

test('periodRange: 1월의 지난 달은 작년 12월', () => {
  const r = periodRange('lastMonth', new Date(2027, 0, 5));
  assert.equal(new Date(r.from).getFullYear(), 2026);
  assert.equal(new Date(r.from).getMonth(), 11);
  assert.equal(new Date(r.to).getMonth(), 0);
});

test('PERIODS 순서에 모든 기간 이름이 있다', () => {
  assert.deepEqual([...PERIODS].sort(), ['all', 'lastMonth', 'month', 'today']);
});

test('formatLocal: 엑셀이 읽는 형식', () => {
  assert.equal(formatLocal(T0), '2026-09-21 14:03:07');
});

test('toCsv: 헤더 + 줄, CRLF, 게임 이름 치환', () => {
  const csv = toCsv([entry({ res: 'clear', l: 4, r: 5, ms: 154500 })], { 1: '색상' });
  const lines = csv.split('\r\n');
  assert.equal(lines[0], '시각,게임,결과,도달단계,도달라운드,소요초,이어하기,오답');
  assert.equal(lines[1], '2026-09-21 14:03:07,색상,완주,4,5,155,0,3');
  assert.equal(lines[2], '');   // 마지막 줄바꿈
});

test('toCsv: 쉼표·따옴표가 든 값은 감싼다', () => {
  const csv = toCsv([entry()], { 1: '색상, "기본"' });
  assert.ok(csv.includes('"색상, ""기본"""'));
});

test('startRun/finishRun: 저장소가 없는 환경(node)에서도 줄을 만들어 돌려준다', () => {
  const run = startRun(3, T0);
  const saved = finishRun(run, { level: 2, round: 4, result: 'over', continues: 1, misses: 5 }, T0 + 90000);
  assert.deepEqual(saved, { t: T0, g: 3, l: 2, r: 4, res: 'over', ms: 90000, c: 1, m: 5 });
  // 치트 시작 등 run 이 없으면 아무것도 안 한다
  assert.equal(finishRun(null, { level: 1, round: 1, result: 'quit' }), null);
});

test('MAX_ENTRIES 는 한 달 부스 운영량을 넉넉히 담는다', () => {
  // 하루 100판 × 31일 = 3,100 — 그보다 커야 한 달 집계가 잘리지 않는다
  assert.ok(MAX_ENTRIES >= 3100);
});
