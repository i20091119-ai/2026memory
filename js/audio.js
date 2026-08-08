/**
 * audio.js — Web Audio 합성 효과음 (설계명세서 §4).
 * 외부 음원 파일 없이 전부 오실레이터·노이즈로 만든다. 배경음악은 없다.
 *
 * 다채로움의 원칙:
 * - 소리도 정보다. 색은 색마다, 숫자는 숫자마다, 모양은 모양마다 음이 달라서
 *   귀로도 외울 수 있다 (다감각 기억 보조).
 * - 같은 게임을 20라운드 돌므로 클리어 소리는 돌아가며 바뀐다.
 * - 부스에 하루 종일 틀어 두는 소리라 자극적인 파형(sawtooth 등)은 아껴 쓴다.
 *
 * 브라우저 자동재생 정책 때문에 AudioContext 는 첫 사용자 입력 전까지 잠겨 있다.
 * TITLE 에서 첫 버튼 입력 시 unlock() 을 부른다.
 */
import { COLOR_TONES } from './config.js';

/** 음이름 → 주파수 (필요한 것만) */
const NOTE = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00,
  C6: 1046.50, D6: 1174.66, E6: 1318.51,
};

/** 숫자 0~9 의 음 — C장조 펜타토닉 2옥타브. 숫자가 클수록 높다. */
const DIGIT_NOTES = [
  NOTE.C4, NOTE.D4, NOTE.E4, NOTE.G4, NOTE.A4,
  NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.A5,
];

/** 모양 8종의 음 — C장조 한 옥타브. 도형 풀 순서(config.SHAPES)와 짝이다. */
const SHAPE_NOTES = [
  NOTE.C4, NOTE.D4, NOTE.E4, NOTE.F4, NOTE.G4, NOTE.A4, NOTE.B4, NOTE.C5,
];

export class Audio {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
    this.master = null;
    this.muted = false;
    /** 정답음을 살짝씩 바꾸기 위한 카운터 */
    this._correctCount = 0;
  }

  /** 첫 사용자 제스처에서 호출. 여러 번 불러도 안전하다. */
  unlock() {
    if (!this.ctx) {
      const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Ctor) return;                       // 오디오 미지원 환경 — 게임은 그대로 진행
      try {
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(this.ctx.destination);
      } catch {
        this.ctx = null;
        return;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  /**
   * 단음 하나를 낸다.
   * @param {number} freq 주파수(Hz)
   * @param {object} [opts]
   * @param {number} [opts.duration] 길이(초)
   * @param {number} [opts.delay] 시작 지연(초)
   * @param {OscillatorType} [opts.type] 파형
   * @param {number} [opts.gain] 음량
   * @param {number} [opts.slideTo] 이 주파수로 미끄러뜨린다
   * @param {number} [opts.detune] 두 번째 오실레이터를 이만큼(센트) 어긋나게 겹쳐
   *   소리를 도톰하게 만든다 (코러스 효과)
   */
  tone(freq, opts = {}) {
    if (!this.ctx || this.muted) return;
    const {
      duration = 0.18, delay = 0, type = 'triangle', gain = 0.6,
      slideTo = null, detune = 0,
    } = opts;

    const t0 = this.ctx.currentTime + delay;
    const env = this.ctx.createGain();

    // 딸깍거림(클릭 노이즈)을 없애려면 게인을 0에서 올렸다가 0으로 내려야 한다.
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    env.connect(this.master);

    const cents = detune ? [-detune / 2, detune / 2] : [0];
    for (const c of cents) {
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      osc.detune.setValueAtTime(c, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
      osc.connect(env);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    }
  }

  /** 여러 음을 순서대로 (멜로디) */
  melody(notes, { step = 0.11, type = 'triangle', gain = 0.55, duration = 0.16, delay = 0 } = {}) {
    notes.forEach((freq, i) => this.tone(freq, { delay: delay + i * step, type, gain, duration }));
  }

  /** 여러 음을 한꺼번에 (화음) */
  chord(notes, opts = {}) {
    const { gain = 0.3, ...rest } = opts;
    notes.forEach((freq) => this.tone(freq, { gain, ...rest }));
  }

  /**
   * 잡음 한 조각 — 박수·부서짐·쉭 같은 비음정 소리용.
   * @param {object} [opts]
   * @param {number} [opts.duration] 길이(초)
   * @param {number} [opts.delay] 시작 지연(초)
   * @param {number} [opts.gain] 음량
   * @param {number} [opts.from] 필터 시작 주파수
   * @param {number} [opts.to] 필터 끝 주파수 (내리면 "퍽", 올리면 "쉭")
   */
  noise(opts = {}) {
    if (!this.ctx || this.muted) return;
    const { duration = 0.2, delay = 0, gain = 0.4, from = 2000, to = null } = opts;
    const t0 = this.ctx.currentTime + delay;

    const len = Math.ceil(this.ctx.sampleRate * duration) + 1;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.Q.value = 0.9;
    filt.frequency.setValueAtTime(from, t0);
    if (to) filt.frequency.exponentialRampToValueAtTime(to, t0 + duration);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    src.connect(filt).connect(env).connect(this.master);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
  }

  /* ---------------- 게임 이벤트별 소리 ---------------- */

  /**
   * 제시 톤 — 항목마다 다른 음이 나서 귀로도 외울 수 있다.
   *   색: 색별 음높이(도/미/솔/도′) + 옥타브 아래 받침음
   *   숫자: 숫자값 그대로 펜타토닉 음계 (0=낮은도 … 9=높은라)
   *   모양: 도형 풀 순서대로 한 옥타브 + 5도 위 잔향
   * @param {number} kind 1|2|3 (항목 종류)
   * @param {number} idx 색 인덱스 / 숫자값 / 도형 풀 인덱스
   */
  present(kind, idx = 0) {
    if (kind === 1) {
      const f = COLOR_TONES[idx] ?? NOTE.C4;
      this.tone(f, { duration: 0.32, type: 'triangle' });
      this.tone(f / 2, { duration: 0.32, type: 'sine', gain: 0.2 });
    } else if (kind === 2) {
      const f = DIGIT_NOTES[idx] ?? NOTE.A4;
      // 마림바 느낌 — 짧은 기음 + 아주 여린 배음
      this.tone(f, { duration: 0.3, type: 'sine', gain: 0.6 });
      this.tone(f * 3, { duration: 0.08, type: 'sine', gain: 0.12 });
    } else {
      const f = SHAPE_NOTES[idx % SHAPE_NOTES.length] ?? NOTE.A4;
      // "딩-동" 두 음 — 모양마다 시작음이 다르다
      this.tone(f, { duration: 0.2, type: 'triangle', gain: 0.55, detune: 8 });
      this.tone(f * 1.5, { delay: 0.11, duration: 0.22, type: 'triangle', gain: 0.4 });
    }
  }

  /**
   * 버튼 입력음 — 색 항목은 색 음높이, 카드는 누른 칸마다 살짝 다른 클릭음.
   * @param {number} kind 1|2|3
   * @param {number} colorIndex 누른 버튼 0..3
   */
  press(kind, colorIndex = 0) {
    if (kind === 1) {
      this.tone(COLOR_TONES[colorIndex] ?? NOTE.C4, { duration: 0.2 });
    } else {
      // 칸마다 반음 두 개씩 올라가는 클릭 — 어느 칸을 눌렀는지 귀로도 구분된다
      const f = NOTE.E5 * Math.pow(2, (colorIndex * 2) / 12);
      this.tone(f, { duration: 0.07, type: 'square', gain: 0.3 });
    }
  }

  /** 정답 — 밝은 2음 상승. 끝음이 조금씩 돌아가며 바뀐다. */
  correct() {
    const endings = [NOTE.G5, NOTE.A5, NOTE.C6];
    const end = endings[this._correctCount++ % endings.length];
    this.melody([NOTE.E5, end], { step: 0.08, duration: 0.13, gain: 0.5 });
  }

  /** 오답 — 낮은 부저 */
  wrong() {
    this.tone(180, { duration: 0.45, type: 'sawtooth', gain: 0.4, slideTo: 90 });
  }

  /** 하트가 깨지는 순간 — "쨍그랑 + 쿵". 오답 화면의 하트 연출과 함께 낸다. */
  heartBreak() {
    this.noise({ duration: 0.28, gain: 0.5, from: 3200, to: 500 });
    this.tone(140, { duration: 0.4, type: 'sine', gain: 0.55, slideTo: 65 });
  }

  /**
   * 라운드 클리어 — 짧은 팡파레. 같은 단계를 5번 돌므로 라운드마다 돌아가며 바뀐다.
   * @param {number} round 1..5
   */
  levelClear(round = 1) {
    const jingles = [
      [NOTE.C5, NOTE.E5, NOTE.G5],
      [NOTE.E5, NOTE.G5, NOTE.C6],
      [NOTE.G4, NOTE.C5, NOTE.E5],
      [NOTE.C5, NOTE.G5, NOTE.E5],
      [NOTE.D5, NOTE.G5, NOTE.B4 * 2],
    ];
    this.melody(jingles[(round - 1) % jingles.length], { step: 0.1, duration: 0.2, gain: 0.55 });
  }

  /**
   * 단계 승급("이제 n개 기억!") — 라운드 클리어보다 확실히 큰 상승 팡파레.
   * 단계가 오를수록 반음씩 높아져 "올라간다"는 느낌을 준다.
   * @param {number} level 승급한 단계 (2..4)
   */
  levelUp(level = 2) {
    const shift = Math.pow(2, (level - 2) / 12);
    const base = [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5].map((f) => f * shift);
    this.melody(base, { step: 0.09, duration: 0.18, gain: 0.55 });
    this.chord([NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].map((f) => f * shift),
      { delay: 0.4, duration: 0.5, gain: 0.22 });
    this.noise({ delay: 0.4, duration: 0.3, gain: 0.15, from: 4000, to: 8000 });
  }

  /** 게임 시작 안내 화면 */
  gameIntro() {
    this.melody([NOTE.G4, NOTE.C5], { step: 0.12, duration: 0.24, gain: 0.45 });
  }

  /**
   * 게임 선택 — 게임마다 시그니처 모티프가 다르다.
   * @param {number} game 1..4
   */
  gamePick(game) {
    if (game === 1) {
      // 색상: 4색 버튼 음을 차례로
      this.melody(COLOR_TONES, { step: 0.07, duration: 0.12, gain: 0.45 });
    } else if (game === 2) {
      // 숫자: 세어 올라가는 느낌
      this.melody([NOTE.C5, NOTE.D5, NOTE.E5], { step: 0.09, duration: 0.14, gain: 0.45, type: 'sine' });
    } else if (game === 3) {
      // 모양: 통통 튀는 분산 화음
      this.melody([NOTE.A4, NOTE.C5, NOTE.E5], { step: 0.09, duration: 0.16, gain: 0.45 });
    } else {
      // 혼합: 미끄러져 올라가는 장난기
      this.tone(NOTE.C5, { duration: 0.22, slideTo: NOTE.C6, gain: 0.4 });
      this.tone(NOTE.E6, { delay: 0.24, duration: 0.1, type: 'square', gain: 0.25 });
    }
  }

  /** 완주 — 긴 팡파레 + 반짝이 */
  allClear() {
    this.melody(
      [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.G5, NOTE.C6],
      { step: 0.15, duration: 0.3, gain: 0.55 },
    );
    // 마지막에 화음 한 방 + 여운
    this.chord([NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6], { delay: 0.95, duration: 0.9, gain: 0.3 });
    this.chord([NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6], { delay: 1.35, duration: 0.7, gain: 0.14 });
    // 색종이처럼 흩어지는 높은 반짝임
    const sparkle = [NOTE.C6, NOTE.E6, NOTE.D6, NOTE.G5 * 2, NOTE.E6, NOTE.C6];
    sparkle.forEach((f, i) =>
      this.tone(f, { delay: 1.1 + i * 0.13, duration: 0.12, type: 'sine', gain: 0.18 }));
  }

  /** 게임 오버 — 내려가는 4음 */
  gameOver() {
    this.melody([NOTE.G4, NOTE.F4, NOTE.D4, NOTE.C4],
      { step: 0.18, duration: 0.3, type: 'sawtooth', gain: 0.32 });
  }

  /** 셋-둘-하나 카운트다운 — 남을수록 낮고, 갈수록 올라간다 */
  countdown(remaining) {
    if (remaining === 0) {
      // 시작! — 밝은 화음
      this.chord([NOTE.C5, NOTE.E5, NOTE.G5], { duration: 0.3, gain: 0.3 });
      return;
    }
    const steps = { 3: NOTE.G4, 2: NOTE.A4, 1: NOTE.B4 };
    this.tone(steps[remaining] ?? NOTE.G4, { duration: 0.12, gain: 0.45 });
  }

  /** UI 이동/선택 소리 */
  blip() {
    this.tone(NOTE.B4, { duration: 0.06, type: 'square', gain: 0.25 });
  }
}

export const audio = new Audio();
