/**
 * games.js 순수 로직 테스트 (설계명세서 §7).
 * 실행: node --test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RED, YELLOW, GREEN, BLUE,
  GAME_COLOR, GAME_DIGIT, GAME_SHAPE,
  makeRng, shuffle, randomSequence, makeChoices, answerIndex,
  judgeStep, nextAfterClear, nextAfterMiss, compareRecord,
  poolFor, buildRound,
} from '../web/js/games.js';

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

test('nextAfterClear: 5단계 미만이면 다음 단계', () => {
  assert.deepEqual(nextAfterClear(1, 1), { kind: 'nextLevel', game: 1, level: 2 });
  assert.deepEqual(nextAfterClear(2, 4), { kind: 'nextLevel', game: 2, level: 5 });
});

test('nextAfterClear: 5단계 클리어면 다음 차수 1단계', () => {
  assert.deepEqual(nextAfterClear(1, 5), { kind: 'nextGame', game: 2, level: 1 });
  assert.deepEqual(nextAfterClear(2, 5), { kind: 'nextGame', game: 3, level: 1 });
});

test('nextAfterClear: 3차 5단계면 올클리어', () => {
  assert.equal(nextAfterClear(3, 5).kind, 'allClear');
});

test('nextAfterClear: levelsPerGame/totalGames 조정이 반영된다', () => {
  assert.deepEqual(
    nextAfterClear(1, 3, { levelsPerGame: 3, totalGames: 2 }),
    { kind: 'nextGame', game: 2, level: 1 },
  );
  assert.equal(nextAfterClear(2, 3, { levelsPerGame: 3, totalGames: 2 }).kind, 'allClear');
});

test('nextAfterMiss: 목숨이 남으면 재도전, 0이면 게임오버', () => {
  assert.deepEqual(nextAfterMiss(3), { kind: 'retry', lives: 2 });
  assert.deepEqual(nextAfterMiss(2), { kind: 'retry', lives: 1 });
  assert.deepEqual(nextAfterMiss(1), { kind: 'gameOver', lives: 0 });
});

test('compareRecord: (차수, 단계) 사전식 비교', () => {
  assert.equal(compareRecord({ game: 2, level: 4 }, { game: 2, level: 3 }), 1);
  assert.equal(compareRecord({ game: 2, level: 1 }, { game: 1, level: 5 }), 1);
  assert.equal(compareRecord({ game: 1, level: 5 }, { game: 2, level: 1 }), -1);
  assert.equal(compareRecord({ game: 3, level: 5 }, { game: 3, level: 5 }), 0);
  assert.equal(compareRecord({ game: 1, level: 1 }, null), 1, '기록 없음보다는 무조건 크다');
});

test('poolFor: 차수별 후보 풀', () => {
  assert.deepEqual(poolFor(GAME_COLOR), [0, 1, 2, 3]);
  assert.deepEqual(poolFor(GAME_DIGIT), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(poolFor(GAME_SHAPE, { shapes: SHAPES }), SHAPES);
  assert.throws(() => poolFor(9));
});

test('buildRound(1차): 보기 없이 시퀀스 값이 곧 정답 버튼', () => {
  const r = buildRound(GAME_COLOR, 4, { rng: makeRng(11) });
  assert.equal(r.sequence.length, 4);
  assert.equal(r.choices, null);
  assert.deepEqual(r.answers, r.sequence);
  for (const v of r.answers) assert.ok(v >= 0 && v <= 3);
});

test('buildRound(2차): 항목마다 4지선다, answers 가 정답 칸을 가리킨다', () => {
  for (let seed = 0; seed < 50; seed++) {
    const r = buildRound(GAME_DIGIT, 5, { rng: makeRng(seed) });
    assert.equal(r.sequence.length, 5);
    assert.equal(r.choices.length, 5);
    r.choices.forEach((choice, k) => {
      assert.equal(choice.length, 4);
      assert.equal(new Set(choice).size, 4);
      // 핵심 불변식: answers[k] 칸의 보기 == 외웠던 숫자
      assert.equal(choice[r.answers[k]], r.sequence[k]);
      assert.ok(r.answers[k] >= 0 && r.answers[k] <= 3);
    });
    assert.equal(r.presentColors, null, '숫자게임 제시는 흰색 고정이라 색이 없다');
  }
});

test('buildRound(3차): 모양 4지선다 + 교란용 제시 색', () => {
  const r = buildRound(GAME_SHAPE, 3, { shapes: SHAPES, rng: makeRng(5) });
  assert.equal(r.sequence.length, 3);
  assert.equal(r.presentColors.length, 3);
  for (const c of r.presentColors) assert.ok(c >= 0 && c <= 3);
  r.choices.forEach((choice, k) => {
    assert.equal(choice[r.answers[k]], r.sequence[k]);
    for (const s of choice) assert.ok(SHAPES.includes(s));
  });
});

test('buildRound: 같은 단계를 다시 만들면 새 시퀀스가 나온다 (오답 재도전)', () => {
  // 오답 시 "새로운" 시퀀스로 재출제되는지 — 수용 기준 체크리스트 항목
  const rng = makeRng(2024);
  const a = buildRound(GAME_DIGIT, 5, { rng });
  const b = buildRound(GAME_DIGIT, 5, { rng });
  assert.notDeepEqual(a.sequence, b.sequence);
});

test('상태 전이 시나리오: 1차1단계 → 올클리어 완주 경로', () => {
  let game = 1, level = 1;
  const path = [];
  for (let i = 0; i < 100; i++) {
    path.push(`${game}-${level}`);
    const nx = nextAfterClear(game, level);
    if (nx.kind === 'allClear') break;
    game = nx.game; level = nx.level;
  }
  assert.equal(path.length, 15, '3차수 × 5단계 = 15단계를 지나야 한다');
  assert.equal(path[0], '1-1');
  assert.equal(path[5], '2-1');
  assert.equal(path[14], '3-5');
});

test('상태 전이 시나리오: 목숨은 차수를 넘어 유지된다', () => {
  // 1차에서 1개 잃고 2차로 넘어가도 목숨이 회복되지 않아야 한다.
  let lives = 3;
  lives = nextAfterMiss(lives).lives;          // 1차에서 실수 → 2
  const nx = nextAfterClear(1, 5);             // 1차 완료 → 2차
  assert.equal(nx.kind, 'nextGame');
  assert.equal(lives, 2, '차수 전환은 목숨을 건드리지 않는다');
  lives = nextAfterMiss(lives).lives;          // 2차에서 실수 → 1
  const last = nextAfterMiss(lives);           // 한 번 더 → 게임오버
  assert.deepEqual(last, { kind: 'gameOver', lives: 0 });
});
