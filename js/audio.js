/**
 * audio.js — Web Audio 합성 효과음 (설계명세서 §4).
 * 외부 음원 파일 없이 전부 오실레이터로 만든다. 배경음악은 없다.
 *
 * 브라우저 자동재생 정책 때문에 AudioContext 는 첫 사용자 입력 전까지 잠겨 있다.
 * TITLE 에서 첫 버튼 입력 시 unlock() 을 부른다.
 */
import { COLOR_TONES } from './config.js';

/** 음이름 → 주파수 (필요한 것만) */
const NOTE = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, C6: 1046.50,
};

export class Audio {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
    this.master = null;
    this.muted = false;
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
   */
  tone(freq, opts = {}) {
    if (!this.ctx || this.muted) return;
    const {
      duration = 0.18, delay = 0, type = 'triangle', gain = 0.6, slideTo = null,
    } = opts;

    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);

    // 딸깍거림(클릭 노이즈)을 없애려면 게인을 0에서 올렸다가 0으로 내려야 한다.
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(env).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  /** 여러 음을 순서대로 (멜로디) */
  melody(notes, { step = 0.11, type = 'triangle', gain = 0.55, duration = 0.16 } = {}) {
    notes.forEach((freq, i) => this.tone(freq, { delay: i * step, type, gain, duration }));
  }

  /* ---------------- 게임 이벤트별 소리 ---------------- */

  /**
   * 제시 톤.
   * 1차는 색별 음높이(도/미/솔/도′), 2·3차는 색 개념이 없으므로 중립 단일 톤 (§4).
   * @param {number} game 1|2|3
   * @param {number} colorIndex 1차에서만 의미 있음
   */
  present(game, colorIndex = 0) {
    if (game === 1) this.tone(COLOR_TONES[colorIndex] ?? NOTE.C4, { duration: 0.32, type: 'triangle' });
    else this.tone(NOTE.A4, { duration: 0.26, type: 'sine', gain: 0.5 });
  }

  /** 버튼 입력음 — 1차는 색 음높이, 2·3차는 중립 클릭음 */
  press(game, colorIndex = 0) {
    if (game === 1) this.tone(COLOR_TONES[colorIndex] ?? NOTE.C4, { duration: 0.2 });
    else this.tone(NOTE.E5, { duration: 0.07, type: 'square', gain: 0.32 });
  }

  /** 정답 — 밝은 2음 상승 */
  correct() {
    this.melody([NOTE.E5, NOTE.G5], { step: 0.08, duration: 0.13, gain: 0.5 });
  }

  /** 오답 — 낮은 부저 */
  wrong() {
    if (!this.ctx || this.muted) return;
    this.tone(180, { duration: 0.45, type: 'sawtooth', gain: 0.45, slideTo: 90 });
  }

  /** 단계 클리어 — 3음 팡파레 */
  levelClear() {
    this.melody([NOTE.C5, NOTE.E5, NOTE.G5], { step: 0.1, duration: 0.2, gain: 0.55 });
  }

  /** 차수 전환 */
  gameIntro() {
    this.melody([NOTE.G4, NOTE.C5], { step: 0.12, duration: 0.24, gain: 0.45 });
  }

  /** 올클리어 — 긴 팡파레 */
  allClear() {
    this.melody(
      [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.G5, NOTE.C6],
      { step: 0.15, duration: 0.3, gain: 0.55 },
    );
    // 마지막에 화음 한 방
    [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f) =>
      this.tone(f, { delay: 0.95, duration: 0.9, gain: 0.3, type: 'triangle' }));
  }

  /** 게임 오버 — 내려가는 4음 */
  gameOver() {
    this.melody([NOTE.G4, NOTE.F4, NOTE.D4, NOTE.C4],
      { step: 0.18, duration: 0.3, type: 'sawtooth', gain: 0.35 });
  }

  /** 3-2-1 카운트다운 */
  countdown(remaining) {
    this.tone(remaining === 0 ? NOTE.C5 : NOTE.G4, {
      duration: remaining === 0 ? 0.24 : 0.12, gain: 0.45,
    });
  }

  /** 신기록 */
  newRecord() {
    this.melody([NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.C6],
      { step: 0.09, duration: 0.18, gain: 0.5 });
  }

  /** UI 이동/선택 소리 */
  blip() {
    this.tone(NOTE.B4, { duration: 0.06, type: 'square', gain: 0.25 });
  }
}

export const audio = new Audio();
