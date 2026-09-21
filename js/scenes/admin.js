/**
 * scenes/admin.js — 운영자 화면. 플레이 기록을 집계해 보여 준다.
 *
 * 여는 법: 타이틀에서 노랑+초록 3초 홀드 (브라우저는 0 키).
 * 안에서:  빨강 = 닫기 · 노랑 = 기간 바꾸기 · 초록 = CSV 저장 · 파랑 두 번 = 기록 지우기
 *
 * 부스 담당자가 "이번 달 몇 판 했고, 어느 게임이 인기고, 몇 개 기억에서
 * 다들 죽는지"를 사진 한 장으로 가져갈 수 있어야 한다. 그래서 숫자를 크게,
 * 막대는 굵게, 한 화면에 다 넣는다. 90초 방치하면 저절로 닫힌다.
 */
import { el, mount, waitButton } from '../util.js';
import { STR } from '../strings.js';
import { CONFIG, COLORS } from '../config.js';
import { RED, YELLOW, GREEN, BLUE } from '../games.js';
import {
  loadLog, clearLog, summarize, toCsv, periodRange, inRange, PERIODS, formatLocal,
} from '../playlog.js';

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const num = (n) => n.toLocaleString('ko-KR');

/** 밀리초 → "2분 40초" / "48초" */
function formatDuration(ms) {
  if (ms === null) return '—';
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m ? `${m}분 ${s % 60}초` : `${s}초`;
}

/** 기간 이름 + 실제 날짜 범위 */
function periodLabel(period, range, summary, now) {
  const name = STR.ADMIN_PERIOD[period];
  const d = new Date(range.from);
  if (period === 'today') return `${name} · ${d.getMonth() + 1}월 ${d.getDate()}일`;
  if (period === 'month' || period === 'lastMonth') {
    return `${name} · ${d.getFullYear()}년 ${d.getMonth() + 1}월`;
  }
  if (summary.first === null) return name;
  const f = new Date(summary.first);
  return `${name} · ${f.getFullYear()}년 ${f.getMonth() + 1}월 ${f.getDate()}일부터`;
}

/** 화면 요소를 직접 탭해도 실제 버튼처럼 동작시킨다 (브라우저·마우스용) */
function makeTappable(node, id, input) {
  node.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    input.emit('down', id, 'human');
  });
  const release = () => input.emit('up', id, 'human');
  node.addEventListener('pointerup', release);
  node.addEventListener('pointercancel', release);
  return node;
}

function statTile(label, value, note) {
  return el('div.admin-tile', {},
    el('div.admin-tile-label', { text: label }),
    el('div.admin-tile-value', { text: value }),
    note ? el('div.admin-tile-note', { text: note }) : null,
  );
}

/** 이름 + 굵은 막대 + 오른쪽 수치. 막대 길이는 최대값 대비. */
function barRow({ label, dot, ratio, text, color }) {
  return el('div.admin-row', {},
    el('span.admin-row-label', {},
      dot !== undefined ? el('span.admin-dot', { style: { background: COLORS[dot] } }) : null,
      el('span', { text: label }),
    ),
    el('span.admin-bar', {},
      el('span.admin-bar-fill', {
        style: { width: `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`, background: color },
      }),
    ),
    el('span.admin-row-text', { text }),
  );
}

function renderBody(entries, period, now) {
  const range = periodRange(period, now);
  const inPeriod = entries.filter((e) => inRange(e, range));
  const s = summarize(inPeriod, { games: CONFIG.GAME_TYPES, levels: CONFIG.LEVELS });

  const head = el('header.admin-head', {},
    el('div.admin-head-left', {},
      el('h2.admin-title', { text: STR.ADMIN_TITLE }),
      el('div.admin-privacy', { text: STR.ADMIN_PRIVACY }),
    ),
    el('div.admin-period', { text: periodLabel(period, range, s, now) }),
  );

  if (!s.plays) {
    return el('div.admin-body', {}, head, el('div.admin-empty', { text: STR.ADMIN_EMPTY }));
  }

  const tiles = el('div.admin-tiles', {},
    statTile(STR.ADMIN_STAT_PLAYS, STR.ADMIN_UNIT_PLAYS(s.plays)),
    statTile(STR.ADMIN_STAT_CLEARS, num(s.clears), `${pct(s.clears, s.plays)}%`),
    statTile(STR.ADMIN_STAT_QUITS, num(s.quits), `${pct(s.quits, s.plays)}%`),
    statTile(STR.ADMIN_STAT_TIME, formatDuration(s.medianMs), STR.ADMIN_STAT_TIME_NOTE),
  );

  // 게임별 — 막대는 가장 인기 있는 게임을 100% 로
  const maxGame = Math.max(1, ...Object.values(s.byGame).map((g) => g.plays));
  const games = el('section.admin-panel', {},
    el('h3.admin-panel-title', { text: STR.ADMIN_BY_GAME }),
    ...Array.from({ length: CONFIG.GAME_TYPES }, (_, i) => {
      const g = s.byGame[i + 1] ?? { plays: 0, clears: 0 };
      return barRow({
        label: STR.GAME_SHORT[i + 1],
        dot: i,
        ratio: g.plays / maxGame,
        color: COLORS[i],
        text: STR.ADMIN_GAME_LINE(g.plays, g.plays ? g.clears / g.plays : null),
      });
    }),
  );

  // 어디까지 갔나 — 판 수 대비 그 단계에 들어선 비율. 마지막은 완주.
  const funnel = el('section.admin-panel', {},
    el('h3.admin-panel-title', { text: STR.ADMIN_FUNNEL },
      el('span.admin-panel-note', { text: STR.ADMIN_FUNNEL_NOTE })),
    ...s.funnel.map((n, i) => {
      const isClear = i === CONFIG.LEVELS;
      return barRow({
        label: isClear ? STR.ADMIN_FUNNEL_CLEAR : STR.ADMIN_FUNNEL_LEVEL(i + 1),
        ratio: n / s.plays,
        color: isClear ? 'var(--sun)' : 'var(--lav)',
        text: `${pct(n, s.plays)}% · ${num(n)}`,
      });
    }),
  );

  // 시간대별 — 부스 운영 시간 배치용. 값이 0인 시간도 자리를 지킨다.
  const maxHour = Math.max(1, ...s.byHour);
  const hours = el('section.admin-panel.admin-hours', {},
    el('h3.admin-panel-title', { text: STR.ADMIN_HOURS }),
    el('div.admin-hour-bars', {},
      ...s.byHour.map((n, h) => el('div.admin-hour', { title: `${h}시 ${n}판` },
        el('div.admin-hour-bar', {},
          el('div.admin-hour-fill', { style: { height: `${Math.round((n / maxHour) * 100)}%` } })),
        el('div.admin-hour-label', { text: h % 3 === 0 ? String(h) : '' }),
      )),
    ),
  );

  const foot = el('div.admin-foot', {
    text: s.last === null ? '' : STR.ADMIN_LAST(formatLocal(s.last)),
  });

  return el('div.admin-body', {}, head, tiles,
    el('div.admin-grid', {}, games, funnel), hours, foot);
}

/** CSV 를 다운로드 폴더로 떨어뜨린다. 키오스크 크로미움도 조용히 받아 준다. */
function downloadCsv(entries, period, now) {
  const csv = toCsv(entries, STR.GAME_SHORT);
  const stamp = period === 'all'
    ? `all-${formatLocal(now.getTime()).slice(0, 10)}`
    : formatLocal(periodRange(period, now).from).slice(0, period === 'today' ? 10 : 7);
  const name = `torus-log-${stamp}.csv`;
  // 앞의 BOM 이 없으면 윈도 엑셀이 한글을 깨뜨린다.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return name;
}

/**
 * @param {import('../state.js').Ctx} ctx
 */
export async function adminScene(ctx) {
  let period = PERIODS[0];
  let entries = loadLog();

  const content = el('div.admin-content');
  const toast = el('div.admin-toast');
  const key = (id, text) => makeTappable(
    el('button.admin-key', { type: 'button' },
      el('span.admin-dot', { style: { background: COLORS[id] } }),
      el('span', { text })),
    id, ctx.input,
  );
  const legend = el('div.admin-legend', {},
    key(RED, STR.ADMIN_KEY_CLOSE),
    key(YELLOW, STR.ADMIN_KEY_PERIOD),
    key(GREEN, STR.ADMIN_KEY_CSV),
    key(BLUE, STR.ADMIN_KEY_CLEAR),
  );

  const node = el('section.scene.scene-admin', {}, content, toast, legend);
  mount(ctx.root, node);
  ctx.input.exitComboEnabled = false;

  let toastTimer = null;
  const say = (text, ms = 4000) => {
    toast.textContent = text;
    toast.classList.add('on');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('on'), ms);
  };

  const render = () => content.replaceChildren(renderBody(entries, period, new Date()));
  render();

  let clearArmedUntil = 0;

  try {
    for (;;) {
      const ev = await waitButton(ctx.input, ctx.signal, { timeoutMs: CONFIG.ADMIN_IDLE_MS });
      if (ev === null || ev.id === RED) return;

      ctx.audio.blip();
      if (ev.id === YELLOW) {
        period = PERIODS[(PERIODS.indexOf(period) + 1) % PERIODS.length];
        render();
      } else if (ev.id === GREEN) {
        const range = periodRange(period, new Date());
        const inPeriod = entries.filter((e) => inRange(e, range));
        if (!inPeriod.length) say(STR.ADMIN_CSV_EMPTY);
        else say(STR.ADMIN_CSV_SAVED(downloadCsv(inPeriod, period, new Date())));
      } else if (ev.id === BLUE) {
        // 실수로 지우면 한 달치가 날아간다. 두 번 눌러야 지운다.
        if (performance.now() < clearArmedUntil) {
          clearLog();
          entries = [];
          clearArmedUntil = 0;
          render();
          say(STR.ADMIN_CLEARED);
        } else {
          clearArmedUntil = performance.now() + 5000;
          say(STR.ADMIN_CLEAR_CONFIRM, 5000);
        }
      }
    }
  } finally {
    if (toastTimer) clearTimeout(toastTimer);
  }
}
