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
import { MOODS } from '../js/torus.js';

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

test('회상 프롬프트가 최대 항목 수만큼, 세 종류 모두 준비되어 있다', () => {
  assert.ok(
    STR.RECALL_ORDINAL.length >= CONFIG.LEVELS,
    `${CONFIG.LEVELS}개 기억까지 가는데 서수 표현이 ${STR.RECALL_ORDINAL.length}개뿐이다`,
  );
  // 마지막 항목의 프롬프트가 undefined 로 새지 않는지 실제로 만들어 본다.
  // 혼합 게임 때문에 어떤 종류든 어떤 자리에나 올 수 있다.
  for (const kind of [1, 2, 3]) {
    assert.equal(typeof STR.RECALL_PROMPT[kind], 'function', `종류 ${kind} 프롬프트가 없다`);
    for (let k = 0; k < CONFIG.LEVELS; k++) {
      assert.ok(!STR.RECALL_PROMPT[kind](k).includes('undefined'), `종류 ${kind} ${k}번째 프롬프트`);
    }
  }
});

test('네 게임 전부에 이름·짧은이름·규칙·선택 설명이 있다', () => {
  for (let g = 1; g <= CONFIG.GAME_TYPES; g++) {
    assert.ok(STR.GAME_NAME[g], `게임 ${g} 이름이 없다`);
    assert.ok(STR.GAME_SHORT[g], `게임 ${g} 짧은 이름이 없다`);
    assert.ok(STR.GAME_RULE[g], `게임 ${g} 규칙 설명이 없다`);
    assert.ok(STR.SELECT_DESC[g], `게임 ${g} 선택 화면 설명이 없다`);
  }
});

test('게임 종류는 4개고 선택지가 버튼 4개와 정확히 맞아떨어진다', () => {
  // 선택 화면이 "버튼 색 = 선택지"로 동작하므로 이 둘은 반드시 같아야 한다.
  assert.equal(CONFIG.GAME_TYPES, 4);
  assert.equal(COLORS.length, CONFIG.GAME_TYPES);
});

test('숫자 풀이 4지선다를 만들 만큼 넓다', () => {
  const digits = poolFor(GAME_DIGIT, { digitMin: CONFIG.DIGIT_MIN, digitMax: CONFIG.DIGIT_MAX });
  assert.ok(digits.length >= 4, '숫자 후보가 4개 미만이면 보기를 못 만든다');
});

test('games.poolFor 가 config.SHAPES 를 그대로 쓴다', () => {
  assert.deepEqual(poolFor(GAME_SHAPE, { shapes: CONFIG.SHAPES }), CONFIG.SHAPES);
});

test('타이밍 상수는 모두 0 이상이고, 무제한 입력은 0 으로 표현된다', () => {
  for (const key of ['PRESENT_MS', 'GAP_MS', 'COUNTDOWN_MS', 'FEEDBACK_MS', 'WRONG_HOLD_MS',
    'MISS_MS', 'HEART_BREAK_DELAY_MS', 'INTRO_MIN_MS', 'LEVEL_CLEAR_MS', 'ATTRACT_IDLE_MS',
    'GAMEOVER_IDLE_MS', 'EXIT_HOLD_MS', 'DEBOUNCE_MS', 'WS_RETRY_MS']) {
    assert.ok(Number.isFinite(CONFIG[key]) && CONFIG[key] > 0, `${key} 가 이상하다`);
  }
  assert.equal(CONFIG.INPUT_TIMEOUT_MS, 0, '입력 제한시간은 무제한(0)이 확정 사양이다');
});

test('카운트다운은 한글 3칸이고, 외울 숫자와 겹치는 글자가 없다', () => {
  // 아라비아 숫자로 되돌리면 2차(숫자)에서 카운트인지 문제인지 헷갈린다.
  assert.equal(STR.COUNTDOWN_WORDS.length, 3, 'present.js 는 [3,2,1] 세 칸을 돈다');
  for (const w of STR.COUNTDOWN_WORDS) {
    assert.ok(!/[0-9]/.test(w), `카운트다운에 아라비아 숫자가 있다: ${w}`);
  }
});

test('오답 연출이 화면에 머무는 시간보다 길지 않다 (연출이 잘리면 안 된다)', () => {
  // style.css 애니메이션 길이. 여기를 고치면 저기도 같이 고쳐야 한다.
  const HEART_BREAK_MS = 1500;   // .heart.breaking
  const SLOT_WRONG_MS = 720;     // .slot.wrong
  assert.ok(
    CONFIG.HEART_BREAK_DELAY_MS + HEART_BREAK_MS <= CONFIG.MISS_MS,
    `오답 화면 ${CONFIG.MISS_MS}ms 안에 ` +
    `${CONFIG.HEART_BREAK_DELAY_MS}+${HEART_BREAK_MS}ms 하트 연출이 다 들어가지 않는다`,
  );
  assert.ok(
    SLOT_WRONG_MS <= CONFIG.WRONG_HOLD_MS,
    `틀린 칸 흔들림 ${SLOT_WRONG_MS}ms 가 ${CONFIG.WRONG_HOLD_MS}ms 안에 끝나지 않는다`,
  );
});

test('토러스 표정은 서로 다른 4종뿐이다 (그릴 사람이 헛일하지 않게)', () => {
  // 표정을 늘리면 그림을 그 수만큼 더 그려야 한다. 정말 다르게 보이는 것만 남긴다.
  assert.deepEqual(MOODS, ['idle', 'talk', 'cheer', 'sad']);
  assert.equal(new Set(MOODS).size, MOODS.length, '표정 이름이 중복된다');
});

test('답안 스트립·홈 안내 문구가 빠짐없이 있다', () => {
  for (const key of ['STRIP_DONE', 'HOME_HINT', 'HOME_HOLDING', 'INTRO_PRESS', 'EXIT_HINT']) {
    assert.ok(typeof STR[key] === 'string' && STR[key].length > 0, `${key} 문구가 없다`);
  }
  // 최대 항목 수까지 스트립 문구가 정상적으로 만들어지는지
  for (let k = 1; k <= CONFIG.LEVELS; k++) {
    assert.ok(!STR.STRIP_RECALL(k, CONFIG.LEVELS).includes('undefined'));
  }
  assert.ok(!STR.STRIP_PRESENT(CONFIG.LEVELS).includes('undefined'));
});

test('라운드 수만큼 클리어 응원 문구가 돌아간다', () => {
  assert.ok(STR.LEVEL_CLEAR_CHEER.length > 0);
  for (let round = 1; round <= CONFIG.ROUNDS_PER_LEVEL; round++) {
    const cheer = STR.LEVEL_CLEAR_CHEER[(round - 1) % STR.LEVEL_CLEAR_CHEER.length];
    assert.ok(typeof cheer === 'string' && cheer.length > 0);
  }
  // 단계 승급 문구도 최대 단계까지 안 샌다
  for (let level = 2; level <= CONFIG.LEVELS; level++) {
    assert.ok(!STR.LEVEL_UP(level).includes('undefined'));
  }
});
