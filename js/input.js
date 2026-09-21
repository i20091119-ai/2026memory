/**
 * input.js — 입력 소스 추상화 (설계명세서 §5).
 *
 * KeyboardInput(키보드 + 화면 탭)과 SocketInput(WebSocket 브리지)이 동일한
 * {type:'down'|'up', id:0..3} 이벤트를 InputManager 로 흘려보낸다.
 * 게임 로직은 어느 쪽에서 왔는지 신경 쓰지 않는다.
 *
 * 이벤트에는 source 가 붙는다:
 *   'human'  — 사람이 실제로 누른 것 (어트랙트 데모를 깨우는 신호)
 *   'script' — 어트랙트 데모의 유령 입력
 */
import { CONFIG } from './config.js';
import { RED, YELLOW, GREEN, BLUE } from './games.js';

/**
 * 눌림/뗌 이벤트를 모아 게임이 쓰기 좋은 형태로 바꿔 주는 허브.
 * - onButton 은 'down' 에서만 발화한다 (§5.2).
 * - 'up' 은 홀드 콤보 추적에만 쓴다.
 *
 * 홀드 콤보는 두 가지다. "두 버튼을 동시에 누른 채 버틴 시간"으로 성립한다.
 *   exit  빨강+파랑 · 플레이 중에만  → 타이틀로
 *   admin 노랑+초록 · 플레이 밖에서만 → 운영자 화면 (타이틀에서 연다)
 * 서로 배타적이라 한 순간에 하나만 돌고, 어느 쪽인지는 holdKind() 로 알 수 있다.
 */
export class InputManager {
  constructor(config = CONFIG) {
    this.config = config;
    /** @type {Set<number>} 현재 눌려 있는 버튼 */
    this.pressed = new Set();
    /** @type {Set<(ev: {id:number, source:string}) => void>} */
    this._buttonHandlers = new Set();
    /** @type {Set<() => void>} */
    this._exitHandlers = new Set();
    /** @type {Set<() => void>} */
    this._adminHandlers = new Set();
    /** @type {Set<(ev: object) => void>} 눌림/뗌 원본 (홀드 진행 표시용) */
    this._rawHandlers = new Set();
    this._lastDownAt = 0;
    this._holdTimer = null;
    this._holdKind = null;
    this._holdMs = 0;
    this._holdStartedAt = 0;
    /** 중도 이탈 콤보 활성화 여부 (타이틀에서는 끈다) */
    this.exitComboEnabled = false;
  }

  /**
   * 버튼 눌림 구독. 반환값을 호출하면 구독 해제.
   * @param {(ev: {id:number, source:string}) => void} handler
   * @returns {() => void}
   */
  onButton(handler) {
    this._buttonHandlers.add(handler);
    return () => this._buttonHandlers.delete(handler);
  }

  /** 중도 이탈 콤보(빨+파 홀드) 성립 시 호출 */
  onExit(handler) {
    this._exitHandlers.add(handler);
    return () => this._exitHandlers.delete(handler);
  }

  /** 운영자 콤보(노+초 홀드) 성립 시 호출 */
  onAdmin(handler) {
    this._adminHandlers.add(handler);
    return () => this._adminHandlers.delete(handler);
  }

  /** 눌림/뗌 원본 이벤트 구독 (홀드 게이지 표시용) */
  onRaw(handler) {
    this._rawHandlers.add(handler);
    return () => this._rawHandlers.delete(handler);
  }

  /**
   * 입력 소스가 호출하는 진입점.
   * @param {'down'|'up'} type
   * @param {number} id 0..3
   * @param {string} source 'human' | 'script'
   */
  emit(type, id, source = 'human') {
    if (!Number.isInteger(id) || id < 0 || id > 3) return;

    if (type === 'down') {
      // 하드웨어 채터링·키 반복 방지: 이미 눌린 상태면 중복 발화하지 않는다.
      if (this.pressed.has(id)) return;
      this.pressed.add(id);
      this._updateHold();
      for (const h of this._rawHandlers) h({ type, id, source });

      // 연타 방지 (§5.1) — 스크립트 입력은 스스로 간격을 조절하므로 면제.
      const now = performance.now();
      if (source === 'human' && now - this._lastDownAt < this.config.DEBOUNCE_MS) return;
      this._lastDownAt = now;

      for (const h of [...this._buttonHandlers]) h({ id, source });
    } else {
      if (!this.pressed.delete(id)) return;
      this._updateHold();
      for (const h of this._rawHandlers) h({ type, id, source });
    }
  }

  /** 어트랙트 데모용 유령 입력 */
  injectPress(id, holdMs = 120) {
    this.emit('down', id, 'script');
    setTimeout(() => this.emit('up', id, 'script'), holdMs);
  }

  /** 지금 눌린 조합이 어느 콤보인가. 없으면 null. */
  _activeCombo() {
    const has = (a, b) => this.pressed.has(a) && this.pressed.has(b);
    if (this.exitComboEnabled) return has(RED, BLUE) ? 'exit' : null;
    return has(YELLOW, GREEN) ? 'admin' : null;
  }

  /** 콤보 조합이 눌려 있는 동안만 타이머를 돌린다. */
  _updateHold() {
    const kind = this._activeCombo();
    if (kind === this._holdKind) return;   // 이미 그 콤보의 타이머가 도는 중 (또는 둘 다 없음)
    this._cancelHold();
    if (!kind) return;

    const ms = kind === 'exit' ? this.config.EXIT_HOLD_MS : this.config.ADMIN_HOLD_MS;
    this._holdKind = kind;
    this._holdMs = ms;
    this._holdStartedAt = performance.now();
    this._holdTimer = setTimeout(() => {
      this._holdTimer = null;
      this._holdKind = null;
      // 콤보가 풀리지 않고 유지된 경우에만 성립
      if (this._activeCombo() !== kind) return;
      const handlers = kind === 'exit' ? this._exitHandlers : this._adminHandlers;
      for (const h of [...handlers]) h();
    }, ms);
  }

  _cancelHold() {
    if (this._holdTimer) clearTimeout(this._holdTimer);
    this._holdTimer = null;
    this._holdKind = null;
    this._holdStartedAt = 0;
  }

  /**
   * 즉시 홈으로 나가기를 요청한다 (ESC 등 콤보를 거치지 않는 경로).
   * 플레이 중이 아닐 때(exitComboEnabled=false)는 무시한다 — 이미 타이틀이다.
   */
  requestExit() {
    if (!this.exitComboEnabled) return;
    this._cancelHold();
    for (const h of [...this._exitHandlers]) h();
  }

  /** 운영자 화면을 바로 요청한다 (키보드 경로). 플레이 중에는 무시한다. */
  requestAdmin() {
    if (this.exitComboEnabled) return;
    this._cancelHold();
    for (const h of [...this._adminHandlers]) h();
  }

  /** 지금 콤보를 누르고 있는 중인가 (게이지를 띄울지 판단용) */
  isHolding() {
    return this._holdTimer !== null;
  }

  /** 누르고 있는 콤보 종류 'exit'|'admin', 없으면 null (게이지 문구용) */
  holdKind() {
    return this._holdKind;
  }

  /** 홀드 진행률 0..1 (게이지 길이용). 막 시작한 순간엔 0 이므로 isHolding() 과 함께 쓴다. */
  holdProgress() {
    if (!this._holdTimer) return 0;
    return Math.min(1, (performance.now() - this._holdStartedAt) / this._holdMs);
  }

  /** 씬 전환 시 눌림 상태를 털어낸다 (키가 눌린 채 씬이 바뀌는 경우 대비) */
  reset() {
    this.pressed.clear();
    this._cancelHold();
  }
}

/**
 * 키보드 1·2·3·4 입력. 화면 요소 탭/클릭은 각 씬이 직접
 * `input.emit('down'|'up', id)` 를 불러 처리한다 (모바일 테스트용).
 */
export class KeyboardInput {
  /** @param {InputManager} manager */
  constructor(manager, config = CONFIG) {
    this.manager = manager;
    this.config = config;
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
  }

  attach(target = window) {
    target.addEventListener('keydown', this._onKeyDown);
    target.addEventListener('keyup', this._onKeyUp);
    // 창 포커스를 잃으면 keyup 을 못 받으므로 눌림 상태를 정리한다.
    target.addEventListener('blur', this._onBlur);
    this._target = target;
    return this;
  }

  detach() {
    this._target?.removeEventListener('keydown', this._onKeyDown);
    this._target?.removeEventListener('keyup', this._onKeyUp);
    this._target?.removeEventListener('blur', this._onBlur);
  }

  _onKeyDown(ev) {
    if (ev.repeat) return;                      // 키 반복 이벤트는 무시 (§5.2)

    // 브라우저로 할 때는 ESC 한 번으로도 홈에 갈 수 있게 한다.
    // (실기에는 ESC 가 없으므로 빨강+파랑 홀드가 여전히 정식 경로다)
    if (ev.key === 'Escape') {
      ev.preventDefault();
      this.manager.requestExit();
      return;
    }
    // 운영자 화면 (실기에서는 타이틀에서 노랑+초록 3초 홀드가 정식 경로)
    if (ev.key === this.config.ADMIN_KEY) {
      ev.preventDefault();
      this.manager.requestAdmin();
      return;
    }

    const id = this.config.KEY_MAP[ev.key];
    if (id === undefined) return;
    ev.preventDefault();
    this.manager.emit('down', id, 'human');
  }

  _onKeyUp(ev) {
    const id = this.config.KEY_MAP[ev.key];
    if (id === undefined) return;
    ev.preventDefault();
    this.manager.emit('up', id, 'human');
  }

  _onBlur() {
    for (const id of [...this.manager.pressed]) this.manager.emit('up', id, 'human');
  }
}

/**
 * 우노 Q 브리지와 이어지는 WebSocket 클라이언트 (§5.2).
 * 서버가 없어도 에러 화면 없이 조용히 실패하고, 3초 간격으로 재시도한다.
 */
export class SocketInput {
  /** @param {InputManager} manager */
  constructor(manager, config = CONFIG) {
    this.manager = manager;
    this.config = config;
    this.connected = false;
    this.socket = null;
    this._retryTimer = null;
    this._retryDelay = config.WS_RETRY_MS;
    this._closed = false;
    /** 이 소켓이 눌렀다고 알려 온 버튼들 — 끊겼을 때 이것만 되돌린다 */
    this._downByBridge = new Set();
    /** @type {Set<(connected: boolean) => void>} */
    this._statusHandlers = new Set();
  }

  /** 접속 상태 변화 구독 (화면 구석 아이콘용) */
  onStatus(handler) {
    this._statusHandlers.add(handler);
    handler(this.connected);
    return () => this._statusHandlers.delete(handler);
  }

  _setStatus(connected) {
    if (this.connected === connected) return;
    this.connected = connected;
    for (const h of this._statusHandlers) h(connected);
  }

  connect() {
    if (this._closed) return this;
    let socket;
    try {
      socket = new WebSocket(this.config.WS_URL);
    } catch {
      // ws:// 자체를 못 여는 환경(예: https 페이지의 mixed content) — 조용히 포기
      this._scheduleRetry();
      return this;
    }
    this.socket = socket;

    socket.addEventListener('open', () => {
      this._retryDelay = this.config.WS_RETRY_MS;   // 붙었으면 간격을 원상복구
      this._setStatus(true);
    });
    socket.addEventListener('message', (ev) => this._onMessage(ev));
    socket.addEventListener('error', () => { /* close 로 이어지므로 무시 */ });
    socket.addEventListener('close', () => {
      this._setStatus(false);
      // 브리지가 끊기면 그 브리지가 "누르고 있다"고 알려 온 버튼만 되돌린다.
      // 키보드로 누르고 있는 버튼까지 건드리면 안 된다 — 브리지 없는 개발 PC 에서는
      // 재접속 실패가 주기적으로 일어나므로, 그때마다 홀드 콤보가 풀려 버린다.
      for (const id of [...this._downByBridge]) this.manager.emit('up', id, 'human');
      this._downByBridge.clear();
      this._scheduleRetry();
    });
    return this;
  }

  _onMessage(ev) {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (msg?.type === 'hello') return;
    if (msg?.type !== 'button') return;
    if (msg.state !== 'down' && msg.state !== 'up') return;

    const id = Number(msg.id);
    if (msg.state === 'down') this._downByBridge.add(id);
    else this._downByBridge.delete(id);

    this.manager.emit(msg.state, id, 'human');
  }

  /**
   * 재접속 예약. 브리지가 아예 없는 개발 PC 에서는 영영 붙지 않으므로,
   * 간격을 서서히 늘려 콘솔이 연결 실패 로그로 뒤덮이지 않게 한다.
   * (실기에서는 브리지가 곧 뜨므로 첫 재시도 간격이 그대로 적용된다.)
   */
  _scheduleRetry() {
    if (this._closed || this._retryTimer) return;
    const delay = this._retryDelay;
    this._retryDelay = Math.min(delay * 2, 60000);
    this._retryTimer = setTimeout(() => {
      this._retryTimer = null;
      this.connect();
    }, delay);
  }

  close() {
    this._closed = true;
    if (this._retryTimer) clearTimeout(this._retryTimer);
    this.socket?.close();
  }
}
