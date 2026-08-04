/**
 * util.js — 씬 구현에 공통으로 쓰이는 아주 작은 도우미 모음.
 *
 * 핵심은 "중도 이탈"(빨강+파랑 2초 홀드) 처리다. 게임 중 어느 씬에서든
 * 즉시 타이틀로 빠져나가야 하므로, 대기 함수는 전부 AbortSignal 을 받아
 * 중단 시 ExitToTitle 로 reject 한다 (설계명세서 §3.1 전역 규칙).
 */

/** 중도 이탈 신호. state.js 의 메인 루프가 잡아서 타이틀로 돌아간다. */
export class ExitToTitle extends Error {
  constructor() {
    super('ExitToTitle');
    this.name = 'ExitToTitle';
  }
}

/** 던져진 오류가 중도 이탈인지 */
export const isExit = (err) => err instanceof ExitToTitle;

/**
 * 중단 가능한 sleep.
 * @param {number} ms
 * @param {AbortSignal} [signal]
 * @returns {Promise<void>}
 */
export function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new ExitToTitle());
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(new ExitToTitle());
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * 버튼 입력 하나를 기다린다.
 * @param {import('./input.js').InputManager} input
 * @param {AbortSignal} [signal]
 * @param {{timeoutMs?: number, accept?: (id: number, ev: object) => boolean}} [opts]
 *   timeoutMs 0 이하면 무제한 (CONFIG.INPUT_TIMEOUT_MS 기본값이 0).
 * @returns {Promise<{id: number, source: string}|null>} 타임아웃이면 null
 */
export function waitButton(input, signal, opts = {}) {
  const { timeoutMs = 0, accept = null } = opts;
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new ExitToTitle());

    let timer = null;
    const off = input.onButton((ev) => {
      if (accept && !accept(ev.id, ev)) return;
      cleanup();
      resolve(ev);
    });

    function cleanup() {
      off();
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
    function onAbort() {
      cleanup();
      reject(new ExitToTitle());
    }

    if (timeoutMs > 0) {
      timer = setTimeout(() => { cleanup(); resolve(null); }, timeoutMs);
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * 엘리먼트 생성 도우미.
 * @param {string} tag 'div.klass.klass2' 형태의 축약 표기 허용
 * @param {object} [props] textContent / html / style / 그 밖의 속성
 * @param {...(Node|string|null)} children
 * @returns {HTMLElement}
 */
export function el(tag, props = {}, ...children) {
  const [name, ...classes] = tag.split('.');
  const node = document.createElement(name || 'div');
  if (classes.length) node.className = classes.join(' ');

  for (const [key, value] of Object.entries(props || {})) {
    if (value == null) continue;
    if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'style') Object.assign(node.style, value);
    else if (key === 'class') node.className += (node.className ? ' ' : '') + value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else node.setAttribute(key, value);
  }

  for (const child of children.flat()) {
    if (child == null) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/**
 * 줄바꿈(\n)이 든 문자열을 <br> 로 나눠 담는다. innerHTML 을 피하기 위함.
 * @param {string} tag
 * @param {string} text
 * @returns {HTMLElement}
 */
export function multiline(tag, text) {
  const node = el(tag);
  text.split('\n').forEach((line, i) => {
    if (i > 0) node.append(document.createElement('br'));
    node.append(document.createTextNode(line));
  });
  return node;
}

/**
 * 화면 전체를 새 씬으로 교체한다.
 * @param {HTMLElement} root
 * @param {HTMLElement} sceneNode
 * @returns {HTMLElement} sceneNode 그대로
 */
export function mount(root, sceneNode) {
  root.replaceChildren(sceneNode);
  return sceneNode;
}

/**
 * 화면 가장자리를 잠깐 물들여 정답/오답을 주변시로도 알린다.
 * 카드나 패드에 시선이 묶여 있어도 결과를 놓치지 않게 하는 장치.
 * @param {HTMLElement} sceneNode 플래시를 붙일 씬
 * @param {'correct'|'wrong'} kind
 */
export function edgeFlash(sceneNode, kind) {
  const layer = el('div.edge-flash', { class: `on-${kind}` });
  sceneNode.append(layer);
  layer.addEventListener('animationend', () => layer.remove(), { once: true });
  // 애니메이션 이벤트를 못 받는 경우(모션 최소화 등)를 대비한 안전장치
  setTimeout(() => layer.remove(), 1200);
}
