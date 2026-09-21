/**
 * versus.js — 2인 대결 규칙 테스트.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createMatch, currentLength, isSuddenDeath, applyRound, matchStatus, judgeRace, shrinkChallenge,
} from '../js/versus.js';
import { CONFIG } from '../js/config.js';

const cfg = { rounds: [1, 1, 2, 2, 3, 3, 4, 4], winPoints: 5 };

test('createMatch: 0:0, 첫 라운드는 1개 기억', () => {
  const m = createMatch(cfg);
  assert.deepEqual(m.scores, [0, 0]);
  assert.equal(currentLength(m), 1);
  assert.equal(isSuddenDeath(m), false);
  assert.deepEqual(matchStatus(m), { done: false, winner: null, suddenDeath: false });
});

test('applyRound: 점수가 오르고 라운드가 넘어간다. 무효(null)는 점수 없이 넘어간다', () => {
  let m = createMatch(cfg);
  m = applyRound(m, 0);
  assert.deepEqual(m.scores, [1, 0]);
  m = applyRound(m, null);
  assert.deepEqual(m.scores, [1, 0]);
  assert.equal(m.index, 2);
  assert.deepEqual(m.history, [0, null]);
});

test('라운드 길이는 1,1,2,2,3,3,4,4 순이고 그 뒤(서든데스)는 4로 고정', () => {
  let m = createMatch(cfg);
  const seen = [];
  for (let i = 0; i < 10; i++) {
    seen.push(currentLength(m));
    m = applyRound(m, null);
  }
  assert.deepEqual(seen, [1, 1, 2, 2, 3, 3, 4, 4, 4, 4]);
  assert.equal(isSuddenDeath(m), true);
});

test('먼저 5점을 따면 그 자리에서 끝', () => {
  let m = createMatch(cfg);
  for (let i = 0; i < 5; i++) m = applyRound(m, 1);
  assert.deepEqual(matchStatus(m), { done: true, winner: 1, suddenDeath: false });
});

test('8라운드를 다 돌고 앞선 쪽이 승리 (5점 미만이어도)', () => {
  let m = createMatch(cfg);
  for (const w of [0, null, 1, null, 0, null, null, 1]) m = applyRound(m, w);   // 2:2 → 아니, 아래에서 다시
  m = createMatch(cfg);
  for (const w of [0, null, 1, null, 0, null, null, null]) m = applyRound(m, w); // 2:1
  assert.deepEqual(matchStatus(m), { done: true, winner: 0, suddenDeath: false });
});

test('8라운드 뒤 동점이면 서든데스로 이어지고, 한 라운드 이기면 끝', () => {
  let m = createMatch(cfg);
  for (const w of [0, 1, 0, 1, null, null, null, null]) m = applyRound(m, w);   // 2:2
  assert.deepEqual(matchStatus(m), { done: false, winner: null, suddenDeath: true });
  assert.equal(currentLength(m), 4);
  m = applyRound(m, null);                                                       // 둘 다 틀림 → 계속
  assert.deepEqual(matchStatus(m), { done: false, winner: null, suddenDeath: true });
  m = applyRound(m, 1);
  assert.deepEqual(matchStatus(m), { done: true, winner: 1, suddenDeath: false });
});

test('judgeRace: 한쪽이 다 맞히면 상대가 입력 중이어도 결정', () => {
  assert.deepEqual(judgeRace({ state: 'cleared', at: 10 }, { state: 'pending' }), { decided: true, winner: 0 });
  assert.deepEqual(judgeRace({ state: 'pending' }, { state: 'cleared', at: 10 }), { decided: true, winner: 1 });
});

test('judgeRace: 둘 다 맞히면 먼저 끝낸 쪽', () => {
  assert.deepEqual(judgeRace({ state: 'cleared', at: 200 }, { state: 'cleared', at: 100 }), { decided: true, winner: 1 });
  assert.deepEqual(judgeRace({ state: 'cleared', at: 100 }, { state: 'cleared', at: 100 }), { decided: true, winner: 0 });
});

test('judgeRace: 한쪽이 틀리고 상대가 입력 중이면 아직, 둘 다 틀리면 무효', () => {
  assert.deepEqual(judgeRace({ state: 'failed' }, { state: 'pending' }), { decided: false, winner: null });
  assert.deepEqual(judgeRace({ state: 'failed' }, { state: 'failed' }), { decided: true, winner: null });
  assert.deepEqual(judgeRace({ state: 'failed' }, { state: 'cleared', at: 5 }), { decided: true, winner: 1 });
});

test('shrinkChallenge: 다른 버튼을 누르면 남은 시간이 줄고 0 아래로는 안 간다', () => {
  assert.equal(shrinkChallenge(10000, 2500), 7500);
  assert.equal(shrinkChallenge(1000, 2500), 0);
});

test('CONFIG 의 대결 상수가 규칙과 맞물린다', () => {
  assert.ok(Array.isArray(CONFIG.VS_ROUNDS) && CONFIG.VS_ROUNDS.length >= 2);
  for (const n of CONFIG.VS_ROUNDS) assert.ok(n >= 1 && n <= CONFIG.LEVELS, `라운드 길이 ${n}이 단계 범위 밖`);
  assert.ok(CONFIG.VS_WIN_POINTS >= 1);
  // 10초 안에 다른 버튼 몇 번이면 사라지는가 — 최소 2번은 눌러야 하게 (실수 한 번에 안 사라지게)
  assert.ok(CONFIG.CHALLENGE_MS / CONFIG.CHALLENGE_PENALTY_MS >= 2);
});
