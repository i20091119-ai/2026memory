/**
 * games.js 순수 로직 테스트 (설계명세서 §7).
 * 실행: node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RED, YELLOW, GREEN, BLUE,
  GAME_COLOR, GAME_DIGIT, GAME_SHAPE, GAME_MIXED, MIXED_KINDS,
  makeRng, shuffle, randomSequence, makeChoices, answerIndex,
  judgeStep, nextAfterClear, nextAfterMiss, compareRecord,
  poolFor, buildRound,
} from '../js/games.js';

const SHAPES = ['circle', 'square', 'triangle', 'star', 'heart', 'diamond', 'moon', 'cross'];
const DIGITS = poolFor(GAME_DIGIT);

/** 같은 값이 3연속 나오는 구간이 있는지 */
function hasTripleRun(seq) {
  for (let i = 2; i < seq.length; i++) {
    if (seq[i] === seq[i - 1] && seq[i] === seq[i - 2]) return true;
  }
  return false;
}

test('버튼 인덱스 표준은 0=빨 1=노 2=초 3=파로 고정', () => {
  assert.deepEqual([RED, YELLOW, GREEN, BLUE], [0, 1, 2, 3]);
});

test('randomSequence: 길이·값 범위를 보장한다', () => {
  for (let level = 1; level <= 5; level++) {
    const seq = randomSequence(level, DIGITS, makeRng(level * 7));
    assert.equal(seq.length, level);
    for (const v of seq) assert.ok(DIGITS.includes(v), `범위 밖 값: ${v}`);
  }
});

test('randomSequence: 같은 값 3연속이 절대 나오지 않는다', () => {
  // 후보가 2개뿐이면 3연속이 나오기 가장 쉬우므로 최악 조건으로 검사한다.
  for (let seed = 0; seed < 300; seed++) {
    assert.equal(hasTripleRun(randomSequence(12, [0, 1], makeRng(seed))), false);
    assert.equal(hasTripleRun(randomSequence(12, [0, 1, 2, 3], makeRng(seed))), false);
  }
});

test('randomSequence: 연속 중복(2연속)은 허용된다', () => {
  let sawPair = false;
  for (let seed = 0; seed < 200 && !sawPair; seed++) {
    const seq = randomSequence(5, [0, 1, 2, 3], makeRng(seed));
    sawPair = seq.some((v, i) => i > 0 && seq[i - 1] === v);
  }
  assert.ok(sawPair, '2연속 중복이 한 번도 나오지 않았다면 규칙이 잘못된 것');
});

test('randomSequence: 길이 0은 빈 배열, 후보 부족은 오류', () => {
  assert.deepEqual(randomSequence(0, [1, 2]), []);
  assert.throws(() => randomSequence(3, [1]));
});

test('makeChoices: 항상 4개, 중복 없음, 정답 포함', () => {
  for (let seed = 0; seed < 200; seed++) {
    const rng = makeRng(seed);
    const answer = DIGITS[seed % DIGITS.length];
    const choices = makeChoices(answer, DIGITS, rng);
    assert.equal(choices.length, 4);
    assert.equal(new Set(choices).size, 4, '보기에 중복이 있다');
    assert.ok(choices.includes(answer), '정답이 보기에 없다');
  }
});

test('makeChoices: 모양 8종 풀에서도 동일하게 동작', () => {
  const rng = makeRng(99);
  const choices = makeChoices('star', SHAPES, rng);
  assert.equal(choices.length, 4);
  assert.equal(new Set(choices).size, 4);
  assert.ok(choices.includes('star'));
  for (const c of choices) assert.ok(SHAPES.includes(c));
});

test('makeChoices: 정답 배치가 4칸에 고르게 흩어진다', () => {
  const seen = new Set();
  for (let seed = 0; seed < 400; seed++) {
    const choices = makeChoices(7, DIGITS, makeRng(seed));
    seen.add(answerIndex(choices, 7));
  }
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3], '정답이 특정 칸에만 몰린다');
});

test('makeChoices: 후보가 모자라면 오류', () => {
  assert.throws(() => makeChoices(1, [1, 2, 3]));
});

test('shuffle: 원소 구성을 보존한다', () => {
  const arr = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = shuffle(arr.slice(), makeRng(3));
  assert.deepEqual(out.slice().sort((a, b) => a - b), arr);
});

test('judgeStep: 정답이면 진행, 마지막이면 done', () => {
  const expected = [2, 0, 3];
  assert.deepEqual(judgeStep(expected, 0, 2), { ok: true, done: false });
  assert.deepEqual(judgeStep(expected, 1, 0), { ok: true, done: false });
  assert.deepEqual(judgeStep(expected, 2, 3), { ok: true, done: true });
});

test('judgeStep: 오답이면 done 없이 즉시 실패', () => {
  const expected = [2, 0, 3];
  assert.deepEqual(judgeStep(expected, 0, 1), { ok: false, done: false });
  // 마지막 항목이라도 오답이면 done 은 false 여야 한다 (클리어 오판정 방지)
  assert.deepEqual(judgeStep(expected, 2, 0), { ok: false, done: false });
});

test('nextAfterClear: 라운드 5회 미만이면 다음 라운드', () => {
  assert.deepEqual(nextAfterClear(1, 1), { kind: 'nextRound', level: 1, round: 2 });
  assert.deepEqual(nextAfterClear(3, 4), { kind: 'nextRound', level: 3, round: 5 });
});

test('nextAfterClear: 5라운드를 채우면 다음 단계 1라운드', () => {
  assert.deepEqual(nextAfterClear(1, 5), { kind: 'nextLevel', level: 2, round: 1 });
  assert.deepEqual(nextAfterClear(3, 5), { kind: 'nextLevel', level: 4, round: 1 });
});

test('nextAfterClear: 4단계 5라운드면 완주', () => {
  assert.equal(nextAfterClear(4, 5).kind, 'allClear');
});

test('nextAfterClear: levels/roundsPerLevel 조정이 반영된다', () => {
  assert.deepEqual(
    nextAfterClear(1, 3, { levels: 2, roundsPerLevel: 3 }),
    { kind: 'nextLevel', level: 2, round: 1 },
  );
  assert.equal(nextAfterClear(2, 3, { levels: 2, roundsPerLevel: 3 }).kind, 'allClear');
});

test('nextAfterMiss: 목숨이 남으면 재도전, 0이면 게임오버', () => {
  assert.deepEqual(nextAfterMiss(3), { kind: 'retry', lives: 2 });
  assert.deepEqual(nextAfterMiss(2), { kind: 'retry', lives: 1 });
  assert.deepEqual(nextAfterMiss(1), { kind: 'gameOver', lives: 0 });
});

test('compareRecord: (단계, 라운드) 사전식 비교', () => {
  assert.equal(compareRecord({ level: 2, round: 4 }, { level: 2, round: 3 }), 1);
  assert.equal(compareRecord({ level: 2, round: 1 }, { level: 1, round: 5 }), 1);
  assert.equal(compareRecord({ level: 1, round: 5 }, { level: 2, round: 1 }), -1);
  assert.equal(compareRecord({ level: 4, round: 5 }, { level: 4, round: 5 }), 0);
  assert.equal(compareRecord({ level: 1, round: 1 }, null), 1, '기록 없음보다는 무조건 크다');
});

test('poolFor: 종류별 후보 풀', () => {
  assert.deepEqual(poolFor(GAME_COLOR), [0, 1, 2, 3]);
  assert.deepEqual(poolFor(GAME_DIGIT), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(poolFor(GAME_SHAPE, { shapes: SHAPES }), SHAPES);
  assert.throws(() => poolFor(9));
});

test('buildRound(색상): 보기 없이 값이 곧 정답 버튼', () => {
  const r = buildRound(GAME_COLOR, 4, { rng: makeRng(11) });
  assert.equal(r.items.length, 4);
  for (const it of r.items) {
    assert.equal(it.kind, GAME_COLOR);
    assert.equal(it.choices, null);
    assert.equal(it.answer, it.value);
    assert.ok(it.value >= 0 && it.value <= 3);
  }
});

test('buildRound(숫자): 항목마다 4지선다, answer 가 정답 칸을 가리킨다', () => {
  for (let seed = 0; seed < 50; seed++) {
    const r = buildRound(GAME_DIGIT, 4, { rng: makeRng(seed) });
    assert.equal(r.items.length, 4);
    for (const it of r.items) {
      assert.equal(it.kind, GAME_DIGIT);
      assert.equal(it.choices.length, 4);
      assert.equal(new Set(it.choices).size, 4);
      // 핵심 불변식: answer 칸의 보기 == 외웠던 숫자
      assert.equal(it.choices[it.answer], it.value);
      assert.ok(it.answer >= 0 && it.answer <= 3);
      assert.equal(it.presentColor, null, '숫자 제시는 흰색 고정이라 색이 없다');
    }
  }
});

test('buildRound(모양): 4지선다 + 교란용 제시 색', () => {
  const r = buildRound(GAME_SHAPE, 3, { shapes: SHAPES, rng: makeRng(5) });
  assert.equal(r.items.length, 3);
  for (const it of r.items) {
    assert.ok(it.presentColor >= 0 && it.presentColor <= 3);
    assert.equal(it.choices[it.answer], it.value);
    for (const s of it.choices) assert.ok(SHAPES.includes(s));
  }
});

test('buildRound(혼합): 항목마다 종류가 랜덤이고, 종류별 규칙을 그대로 따른다', () => {
  const seenKinds = new Set();
  for (let seed = 0; seed < 80; seed++) {
    const r = buildRound(GAME_MIXED, 4, { shapes: SHAPES, rng: makeRng(seed) });
    assert.equal(r.items.length, 4);
    for (const it of r.items) {
      seenKinds.add(it.kind);
      assert.ok(MIXED_KINDS.includes(it.kind), '항목 종류는 색상·숫자·모양 중 하나');
      if (it.kind === GAME_COLOR) {
        assert.equal(it.choices, null);
        assert.equal(it.answer, it.value);
      } else {
        assert.equal(it.choices[it.answer], it.value);
        assert.equal(new Set(it.choices).size, 4);
      }
      if (it.kind === GAME_SHAPE) {
        assert.ok(it.presentColor >= 0 && it.presentColor <= 3);
      } else {
        assert.equal(it.presentColor, null);
      }
    }
  }
  assert.equal(seenKinds.size, 3, '충분히 돌리면 세 종류가 모두 나와야 한다');
});

test('buildRound: 같은 판을 다시 만들면 새 시퀀스가 나온다 (오답 재도전)', () => {
  // 오답 시 "새로운" 시퀀스로 재출제되는지 — 수용 기준 체크리스트 항목
  const rng = makeRng(2024);
  const a = buildRound(GAME_DIGIT, 4, { rng });
  const b = buildRound(GAME_DIGIT, 4, { rng });
  assert.notDeepEqual(a.items.map((i) => i.value), b.items.map((i) => i.value));
});

test('상태 전이 시나리오: 1개 기억 1라운드 → 완주 경로', () => {
  let level = 1, round = 1;
  const path = [];
  for (let i = 0; i < 100; i++) {
    path.push(`${level}-${round}`);
    const nx = nextAfterClear(level, round);
    if (nx.kind === 'allClear') break;
    level = nx.level; round = nx.round;
  }
  assert.equal(path.length, 20, '4단계 × 5라운드 = 20판을 지나야 한다');
  assert.equal(path[0], '1-1');
  assert.equal(path[5], '2-1');
  assert.equal(path[19], '4-5');
});

test('상태 전이 시나리오: 목숨은 단계를 넘어 유지된다', () => {
  // 1단계에서 1개 잃고 2단계로 넘어가도 목숨이 회복되지 않아야 한다.
  let lives = 3;
  lives = nextAfterMiss(lives).lives;          // 실수 → 2
  const nx = nextAfterClear(1, 5);             // 1단계 완료 → 2단계
  assert.equal(nx.kind, 'nextLevel');
  assert.equal(lives, 2, '단계 전환은 목숨을 건드리지 않는다');
  lives = nextAfterMiss(lives).lives;          // 실수 → 1
  const last = nextAfterMiss(lives);           // 한 번 더 → 게임오버
  assert.deepEqual(last, { kind: 'gameOver', lives: 0 });
});
