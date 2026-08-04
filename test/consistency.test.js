/**
 * 모듈 사이의 약속이 어긋나지 않았는지 확인하는 테스트.
 *
 * 여기서 잡으려는 건 "각 파일은 멀쩡한데 서로 안 맞는" 종류의 사고다.
 * 예: config.SHAPES 에 모양 이름을 하나 추가했는데 shapes.js 에 도형을 안 그려서
 *     3차 게임이 빈 카드를 내놓는 경우 — 실행해 보기 전엔 드러나지 않는다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG, COLORS, COLOR_TONES } from '../js/config.js';
import { SHAPE_PATHS, SHAPE_NAMES } from '../js/shapes.js';
import { STR } from '../js/strings.js';
import { poolFor, GAME_SHAPE, GAME_DIGIT } from '../js/games.js';

test('config.SHAPES 의 모든 모양이 shapes.js 에 그려져 있다', () => {
  for (const name of CONFIG.SHAPES) {
    assert.ok(SHAPE_PATHS[name], `shapes.js 에 '${name}' 도형이 없다`);
  }
});

test('shapes.js 에만 있고 게임에 안 쓰이는 도형이 없다', () => {
  assert.deepEqual([...CONFIG.SHAPES].sort(), [...SHAPE_NAMES].sort());
});

test('모양 8종은 4지선다를 만들 수 있을 만큼 충분하다', () => {
  assert.ok(CONFIG.SHAPES.length >= 4, '보기 4개를 못 만든다');
  assert.equal(new Set(CONFIG.SHAPES).size, CONFIG.SHAPES.length, '모양 이름이 중복된다');
});

test('모든 모양에 접근성 라벨(이름)이 있다', () => {
  for (const name of CONFIG.SHAPES) {
    assert.ok(STR.SHAPE_NAME[name], `strings.js 에 '${name}' 이름이 없다`);
  }
});

test('색 관련 배열은 전부 4개 (0=빨 1=노 2=초 3=파)', () => {
  assert.equal(COLORS.length, 4);
  assert.equal(COLOR_TONES.length, 4);
  assert.equal(STR.COLOR_NAME.length, 4);
  assert.equal(Object.keys(CONFIG.KEY_MAP).length, 4);
});

test('키보드 매핑이 버튼 인덱스 0..3 을 빠짐없이 덮는다', () => {
  assert.deepEqual(Object.values(CONFIG.KEY_MAP).sort(), [0, 1, 2, 3]);
});

test('회상 프롬프트가 최대 단계 수만큼 준비되어 있다', () => {
  assert.ok(
    STR.RECALL_ORDINAL.length >= CONFIG.LEVELS_PER_GAME,
    `${CONFIG.LEVELS_PER_GAME}단계까지 가는데 서수 표현이 ${STR.RECALL_ORDINAL.length}개뿐이다`,
  );
  // 마지막 단계의 프롬프트가 undefined 로 새지 않는지 실제로 만들어 본다
  for (let k = 0; k < CONFIG.LEVELS_PER_GAME; k++) {
    assert.ok(!STR.RECALL_DIGIT_PROMPT(k).includes('undefined'), `${k}번째 숫자 프롬프트`);
    assert.ok(!STR.RECALL_SHAPE_PROMPT(k).includes('undefined'), `${k}번째 모양 프롬프트`);
  }
});

test('모든 차수에 이름과 규칙 설명이 있다', () => {
  for (let g = 1; g <= CONFIG.TOTAL_GAMES; g++) {
    assert.ok(STR.GAME_NAME[g], `${g}차 이름이 없다`);
    assert.ok(STR.GAME_RULE[g], `${g}차 규칙 설명이 없다`);
  }
});

test('숫자 풀이 4지선다를 만들 만큼 넓다', () => {
  const digits = poolFor(GAME_DIGIT, { digitMin: CONFIG.DIGIT_MIN, digitMax: CONFIG.DIGIT_MAX });
  assert.ok(digits.length >= 4, '숫자 후보가 4개 미만이면 보기를 못 만든다');
});

test('games.poolFor 가 config.SHAPES 를 그대로 쓴다', () => {
  assert.deepEqual(poolFor(GAME_SHAPE, { shapes: CONFIG.SHAPES }), CONFIG.SHAPES);
});

test('타이밍 상수는 모두 0 이상이고, 무제한 입력은 0 으로 표현된다', () => {
  for (const key of ['PRESENT_MS', 'GAP_MS', 'COUNTDOWN_MS', 'FEEDBACK_MS', 'MISS_MS',
    'INTRO_MIN_MS', 'LEVEL_CLEAR_MS', 'ATTRACT_IDLE_MS', 'GAMEOVER_IDLE_MS',
    'EXIT_HOLD_MS', 'DEBOUNCE_MS', 'WS_RETRY_MS']) {
    assert.ok(Number.isFinite(CONFIG[key]) && CONFIG[key] > 0, `${key} 가 이상하다`);
  }
  assert.equal(CONFIG.INPUT_TIMEOUT_MS, 0, '입력 제한시간은 무제한(0)이 확정 사양이다');
});

test('답안 스트립·홈 안내 문구가 빠짐없이 있다', () => {
  for (const key of ['STRIP_DONE', 'HOME_HINT', 'HOME_HOLDING', 'INTRO_PRESS', 'EXIT_HINT']) {
    assert.ok(typeof STR[key] === 'string' && STR[key].length > 0, `${key} 문구가 없다`);
  }
  // 최대 단계 수까지 스트립 문구가 정상적으로 만들어지는지
  for (let k = 1; k <= CONFIG.LEVELS_PER_GAME; k++) {
    assert.ok(!STR.STRIP_RECALL(k, CONFIG.LEVELS_PER_GAME).includes('undefined'));
  }
  assert.ok(!STR.STRIP_PRESENT(CONFIG.LEVELS_PER_GAME).includes('undefined'));
});

test('LEVELS_PER_GAME 만큼 클리어 응원 문구가 돌아간다', () => {
  assert.ok(STR.LEVEL_CLEAR_CHEER.length > 0);
  for (let level = 1; level <= CONFIG.LEVELS_PER_GAME; level++) {
    const cheer = STR.LEVEL_CLEAR_CHEER[(level - 1) % STR.LEVEL_CLEAR_CHEER.length];
    assert.ok(typeof cheer === 'string' && cheer.length > 0);
  }
});
