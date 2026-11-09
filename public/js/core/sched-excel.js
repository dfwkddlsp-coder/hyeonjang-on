// 현장ON — 일정표 엑셀 읽기: 월간 계획서 · KOSHA 당직자 명단 · 당직 달력표 (화면·DB 없음, tests/schedule-excel.test.mjs)
// 안전게시판 core/schedule-excel.js 를 옮겨 옴
'use strict';
const SCHED_XL=(()=>{
// 일정표 "엑셀로 넣기": reads the monthly safety plan workbook (월간 안전관리계획서) — a calendar laid out as
//   a weekday header (일 월 화 수 목 금 토), then for each week a row of day numbers and a row of that week's text —
// into schedule items. Pure: it gets the sheet as rows of cell text (SheetJS sheet_to_json header:1) so it can be tested.
// Nothing is saved here; the 일정표 screen shows the result with checkboxes first.

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MONTH_TITLE = /(\d{2,4})\s*년\s*(\d{1,2})\s*월/;
const DAY = /^\d{1,2}$/;
// "1. ", "2, ", "1.J-POINT": the numbering that separates several items written in one cell.
const ITEM_NUMBER = /(?:^|\s)\d{1,2}\s*[.,](?!\d)\s*/g;
const CLOCK = /\(?\s*(\d{1,2}):(\d{2})\s*\)?/;
const THEME = /^※\s*/;
// Phone numbers are left out of the titles: every approved worker can read the 일정표.
const PHONE = /\(?\s*0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}\s*\)?/g;
const noPhone = (text) => text.replace(PHONE, ' ').replace(/\s+/g, ' ').trim();

const clean = (cell) => String(cell ?? '').replace(/\r/g, '').trim();

/** Column of each weekday in the header row, or null when this sheet has no calendar header. */
function findHeader(rows) {
  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r].map(clean);
    const cols = WEEKDAYS.map((d) => cells.indexOf(d));
    if (cols.every((c) => c >= 0)) return { row: r, cols };
  }
  return null;
}

/** "2026년 11월" / "26년 08월" written above the calendar → { year, month }. */
function findMonth(rows, headerRow) {
  for (const row of rows.slice(0, headerRow + 1)) {
    for (const cell of row) {
      const m = MONTH_TITLE.exec(clean(cell));
      if (m) return { year: Number(m[1]) < 100 ? 2000 + Number(m[1]) : Number(m[1]), month: Number(m[2]) };
    }
  }
  return null;
}

const isDayRow = (row, cols) => cols.filter((c) => DAY.test(clean(row[c]))).length >= 5;

/**
 * One cell's text split into its numbered items, each with an optional "HH:MM" pulled out of the text.
 * Only the numbering separates items: a line break inside a cell is just wrapping ("…기성 마감\n및 본사 송부").
 */
function splitItems(text) {
  const items = [];
  for (const part of clean(text).replace(/\n+/g, ' ').split(ITEM_NUMBER)) {
    const raw = part.replace(/\s+/g, ' ').trim();
    if (!raw) continue;
    const clock = CLOCK.exec(raw);
    const time = clock && Number(clock[1]) < 24 && Number(clock[2]) < 60 ? `${clock[1].padStart(2, '0')}:${clock[2]}` : '';
    const title = noPhone((time ? raw.replace(clock[0], ' ') : raw).replace(/\(\s*\)/g, ''));
    if (title) items.push({ time, title });
  }
  return items;
}

/**
 * The plan's items for its own month: { year, month, items: [{ date, time, title, theme }], notes: [text] }.
 * Days shown from the previous/next month are skipped. The Sunday-column "※ N주차 테마점검 …" note becomes an
 * item on that week's Monday (theme: true). "●…" lines without a date come back as `notes`.
 * `fallback` ({ year, month }, e.g. from the file name "26.11_…") is used when the sheet does not say.
 * Returns null when the rows are not a calendar.
 */
function parsePlanSheet(rows, fallback = null) {
  const header = findHeader(rows);
  if (!header) return null;
  const ym = findMonth(rows, header.row) || fallback;
  if (!ym) return null;
  const { year, month } = ym;
  const iso = (d) => ymd(new Date(year, month - 1, d));

  const items = [];
  const notes = [];
  // 0: days of the previous month (before the 1st), 1: this month, 2: the next month (after the numbers restart).
  let phase = 0;
  let prevDay = null;
  let afterDayRow = false;

  for (let r = header.row + 1; r < rows.length; r++) {
    const row = rows[r];
    if (isDayRow(row, header.cols)) {
      const days = header.cols.map((c) => {
        const d = Number(clean(row[c]));
        if (phase === 0 && d === 1) phase = 1;
        else if (phase === 1 && prevDay !== null && d < prevDay) phase = 2;
        prevDay = d;
        return phase === 1 && DAY.test(clean(row[c])) ? d : null;
      });
      const text = rows[r + 1] || [];
      header.cols.forEach((c, i) => {
        const body = clean(text[c]);
        if (!body) return;
        if (i === 0 && THEME.test(body)) {
          // The week's theme check goes on its Monday (or the first day of this month in that week).
          const day = days.slice(1).find((d) => d !== null) ?? days[0];
          if (day) items.push({ date: iso(day), time: '', title: noPhone(body.replace(THEME, '')), theme: true });
          return;
        }
        if (days[i] === null) return;
        for (const item of splitItems(body)) items.push({ date: iso(days[i]), ...item, theme: false });
      });
      afterDayRow = true;
      r += 1; // the text row was read with its day row
      continue;
    }
    if (afterDayRow) {
      const text = row.map(clean).filter(Boolean).join(' ');
      for (const note of text.split('●')) {
        const t = noPhone(note.replace(/[<>]/g, '')).replace(/[,，]\s*$/, '').trim();
        if (t) notes.push(t);
      }
    }
  }
  return { year, month, items, notes };
}

/** "26.11_월간_안전관리계획서.xlsx" → { year: 2026, month: 11 } (used when the sheet has no "2026년 11월"). */
function monthFromFileName(name) {
  const m = /(?:^|\D)(\d{2})[._-](\d{1,2})(?:\D|$)/.exec(String(name));
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null;
  return { year: 2000 + Number(m[1]), month: Number(m[2]) };
}

// ---- KOSHA 일일안전당직자 명단 (MyKoshaData_YYYYMMDD.xlsx) ----
// One row per person (기업/협력사 · 성명 · 직위 …), one column per day ("11/01 (일)"), "O" on that person's duty days.
// Each "O" becomes the same schedule item the 일정표 already uses for the duty roster: "안전활동 일일당직자 : 이름"
// (the home screen's 오늘 당직 circle reads exactly that, core/duty.js todayDutyName).
const DAY_HEADER = /^(\d{1,2})\s*\/\s*(\d{1,2})\s*(?:\(\s*[일월화수목금토]\s*\))?$/;
const DUTY_MARK = /^[OoＯ○◯●VvY✓✔]$/;
const dutyTitle = (name) => `안전활동 일일당직자 : ${name}`;

/** "MyKoshaData_20261029.xlsx" → { year: 2026, month: 10 } (the export date; the roster's days have no year). */
function exportDateFromFileName(name) {
  const m = /(?:^|\D)(20\d{2})(\d{2})(\d{2})(?:\D|$)/.exec(String(name));
  return m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? { year: Number(m[1]), month: Number(m[2]) } : null;
}

/**
 * The duty roster sheet as { year, month, items, notes: [], kind: 'duty' }, or null when it is not one.
 * `ref` ({ year, month }, from the file name or today) gives the year: a day's month far before it means next year
 * (a January roster downloaded in December).
 */
function parseDutyRoster(rows, ref) {
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const cells = rows[r].map(clean);
    const nameCol = cells.indexOf('성명');
    const days = cells.map((c, i) => [i, DAY_HEADER.exec(c)]).filter(([, m]) => m);
    if (nameCol < 0 || days.length < 5) continue;

    const yearOf = (month) => (ref && month < ref.month - 6 ? ref.year + 1 : ref?.year ?? new Date().getFullYear());
    const items = [];
    for (const row of rows.slice(r + 1)) {
      const name = clean(row[nameCol]).replace(/\s+/g, '');
      if (!name) continue;
      for (const [col, m] of days) {
        if (!DUTY_MARK.test(clean(row[col]))) continue;
        const month = Number(m[1]);
        items.push({ date: ymd(new Date(yearOf(month), month - 1, Number(m[2]))), time: '', title: dutyTitle(name), theme: false });
      }
    }
    items.sort((a, b) => a.date.localeCompare(b.date));
    const counts = {};
    for (const item of items) counts[item.date.slice(0, 7)] = (counts[item.date.slice(0, 7)] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!top) return null;
    return { year: Number(top.slice(0, 4)), month: Number(top.slice(5)), items, notes: [], kind: 'duty' };
  }
  return null;
}

// ---- 일일안전당직자 달력표 ("(26.11월) 일일안전당직자": a date cell "11/2" with that day's person in the cell below) ----
const ROSTER_TITLE = /(?:\(\s*(\d{2,4})\s*[.년]\s*(\d{1,2})\s*월\s*\))?\s*일일\s*안전\s*당직자/;
const DATE_CELL = /^(\d{1,2})\s*\/\s*(\d{1,2})$/;
const PERSON = /^[가-힣]{2,4}$/;
const NOT_PERSON = /휴|연휴|공휴|없음|미정|당직/;

/**
 * The duty calendar sheet as { year, month, items, notes: [], kind: 'duty' }, or null when it is not one.
 * The month is the one in the title (the sheet name may say another); days of other months are skipped.
 * A cell under a date that is not a person's name ("추석연휴") is skipped too.
 */
function parseDutyCalendar(rows, ref) {
  let title = null;
  for (const row of rows.slice(0, 5)) {
    for (const cell of row) {
      const m = ROSTER_TITLE.exec(clean(cell));
      if (m) { title = m; break; }
    }
    if (title) break;
  }
  if (!title) return null;
  const month = Number(title[2]) || ref?.month;
  if (!month) return null;
  const year = title[1] ? (Number(title[1]) < 100 ? 2000 + Number(title[1]) : Number(title[1])) : ref?.year ?? new Date().getFullYear();

  const items = [];
  for (let r = 0; r < rows.length; r++) {
    rows[r].forEach((cell, c) => {
      const d = DATE_CELL.exec(clean(cell));
      if (!d || Number(d[1]) !== month) return;
      // The person is in the first non-empty cell below the date, before the next row of dates.
      for (let below = r + 1; below < Math.min(rows.length, r + 4); below++) {
        const text = clean(rows[below]?.[c]).replace(/\s+/g, '');
        if (!text) continue;
        if (DATE_CELL.test(text)) break;
        if (PERSON.test(text) && !NOT_PERSON.test(text)) {
          items.push({ date: ymd(new Date(year, month - 1, Number(d[2]))), time: '', title: dutyTitle(text), theme: false });
        }
        break;
      }
    });
  }
  if (!items.length) return null;
  items.sort((a, b) => a.date.localeCompare(b.date));
  return { year, month, items, notes: [], kind: 'duty' };
}

/** Schedule items that are a duty-roster entry ("안전활동 일일당직자 : 이름"), e.g. to replace a month's roster. */
const isDutyItem = (item) => SCHED_ICS.isDuty(item);
const TODAY_DUTY = /일일\s*당직자\s*[:：]?\s*([가-힣]{2,4})/;
/** 그날 일정 중 "안전활동 일일당직자 : 이름"에서 이름 (없으면 null) */
function todayDutyName(scheduleItems) {
  for (const item of scheduleItems) { const m = TODAY_DUTY.exec(String(item.title ?? '')); if (m) return m[1]; }
  return null;
}
return {todayDutyName,splitItems,parsePlanSheet,monthFromFileName,dutyTitle,exportDateFromFileName,parseDutyRoster,parseDutyCalendar,isDutyItem};
})();
