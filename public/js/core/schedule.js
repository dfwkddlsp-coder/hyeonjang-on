// 현장ON — 일정표 읽기 (화면·DB 없음, tests/schedule.test.mjs): 빠른 입력 한 줄 읽기 + 엑셀 계획서·당직자 명단 읽기
// 안전게시판(safety-noticeboard) core/schedule-parse.js · schedule-excel.js 를 옮겨 옴. 바뀐 점: 1~6시를 오후로 읽기는 설정으로 끔 가능
'use strict';
const SCHED_TXT=(()=>{
// Quick entry for the 일정표: one schedule per line, typed the way it would be said, e.g.
//   "14일 오후 노사협의체 회의"   "15일 14시 안전점검"   "10/20(화) 오전 9시 30분 교육"
// A line is "date, then optional time, then the title". A line without a date reuses the date of the
// line above it (a date can also stand alone on its own line), so a day's items can be listed under one date. Nothing is saved from here: the
// result is shown as a preview first, so a wrongly-read line is visible before it becomes a schedule.

const WD = '[일월화수목금토]';
// Optional weekday after the date: "(수)", "(수요일)", " 수요일". A bare "일" is not taken as a
// weekday, so "14일 일일점검" keeps its title.
const WEEKDAY = `\\s*(?:\\(\\s*${WD}(?:요일)?\\s*\\)|${WD}요일)?`;
const DATE_PATTERNS = [
  { re: new RegExp(`^(오늘|내일|모레)${WEEKDAY}`), kind: 'relative' },
  { re: new RegExp(`^(\\d{1,2})\\s*월\\s*(\\d{1,2})\\s*일${WEEKDAY}`), kind: 'monthDay' },
  { re: new RegExp(`^(\\d{1,2})\\s*[/.]\\s*(\\d{1,2})(?!\\d)\\.?${WEEKDAY}`), kind: 'monthDay' },
  { re: new RegExp(`^(\\d{1,2})\\s*일${WEEKDAY}`), kind: 'day' },
];
// "오후 2시 30분", "14시 반", "14:30", "오후 2:30"; a lone "오전" / "오후" / "종일" is kept as that word.
const CLOCK = /^(오전|오후)?\s*(\d{1,2})\s*(?:시\s*(?:(\d{1,2})\s*분|(반))?|:\s*(\d{2}))/;
const HALF_DAY = /^(오전|오후|종일|하루\s*종일)(?![가-힣])/;
const BULLET = /^[\s\-–·•*]+/;
const SEPARATOR = /^[\s,:~\-–·]+/;

const pad2 = (n) => String(n).padStart(2, '0');
const RELATIVE_DAYS = { 오늘: 0, 내일: 1, 모레: 2 };

function validDate(year, month, day) {
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

/**
 * The calendar date a typed date means. "14일" alone is this month's 14th, or next month's if the 14th
 * has already passed this month (schedules are entered ahead). "10/14" is this year, or next year if
 * that would be more than two months ago (typing January's dates in December).
 */
function resolveDate(kind, m, today) {
  const y = today.getFullYear();
  const mo = today.getMonth() + 1;
  if (kind === 'relative') return new Date(y, today.getMonth(), today.getDate() + RELATIVE_DAYS[m[1]]);
  if (kind === 'day') {
    const day = Number(m[1]);
    const thisMonth = validDate(y, mo, day);
    if (thisMonth && thisMonth >= today) return thisMonth;
    return validDate(mo === 12 ? y + 1 : y, mo === 12 ? 1 : mo + 1, day) ?? thisMonth;
  }
  const month = Number(m[1]);
  const day = Number(m[2]);
  const date = validDate(y, month, day);
  if (!date) return null;
  const twoMonthsAgo = new Date(y, today.getMonth() - 2, today.getDate());
  return date < twoMonthsAgo ? validDate(y + 1, month, day) : date;
}

/** "14:00" from the CLOCK match. An hour of 1~6 with no 오전/오후 is read as afternoon (site hours). */
function clockTime(m, pmRule = true) {
  const [, half, h, min, isHalf, colonMin] = m;
  let hour = Number(h);
  const minute = colonMin != null ? Number(colonMin) : min != null ? Number(min) : isHalf ? 30 : 0;
  if (half === '오후' && hour < 12) hour += 12;
  else if (half === '오전' && hour === 12) hour = 0;
  else if (!half && pmRule && hour >= 1 && hour <= 6) hour += 12;
  if (hour > 23 || minute > 59) return null;
  return `${pad2(hour)}:${pad2(minute)}`;
}

/**
 * Every non-blank line of `text`, read into { line, date: 'YYYY-MM-DD', time, title } or
 * { line, error } when it cannot be read. `time` is '' (none), 'HH:MM', or '오전' / '오후' / '종일'.
 */
function parseScheduleText(text, now = new Date(), pmRule = true) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const results = [];
  let lastDate = null;

  for (const original of String(text ?? '').split(/\r?\n/)) {
    const line = original.trim();
    if (!line) continue;
    let rest = line.replace(BULLET, '');

    let date = null;
    let dateFound = false;
    for (const { re, kind } of DATE_PATTERNS) {
      const m = re.exec(rest);
      if (!m) continue;
      dateFound = true;
      date = resolveDate(kind, m, today);
      rest = rest.slice(m[0].length).replace(SEPARATOR, '');
      break;
    }
    if (dateFound && !date) { results.push({ line, error: '없는 날짜예요' }); continue; }
    if (!dateFound) date = lastDate;
    if (!date) { results.push({ line, error: '날짜를 찾지 못했어요 (예: 14일)' }); continue; }
    lastDate = date;
    if (dateFound && !rest) continue; // a date on its own line heads the lines below it

    let time = '';
    const clock = CLOCK.exec(rest);
    if (clock) {
      time = clockTime(clock, pmRule);
      if (!time) { results.push({ line, error: '없는 시간이에요' }); continue; }
      rest = rest.slice(clock[0].length);
    } else {
      const half = HALF_DAY.exec(rest);
      if (half) {
        time = half[1].startsWith('하루') ? '종일' : half[1];
        rest = rest.slice(half[0].length);
      }
    }

    const title = rest.replace(SEPARATOR, '').trim();
    if (!title) { results.push({ line, error: '일정 내용이 없어요' }); continue; }
    results.push({ line, date: ymd(date), time, title });
  }
  return results;
}

/** Sort key so 종일 comes first, 오전 before the morning's clock times, 오후 at noon. */
const timeKey = (time) => ({ 종일: '', 오전: '00:00', 오후: '12:00' })[time] ?? (time || '');

/** Comparator for one day's schedule items. */
const byScheduleTime = (a, b) => timeKey(a.time).localeCompare(timeKey(b.time));
return {parseScheduleText,byScheduleTime};
})();
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
const isDutyItem = (item) => /일일\s*당직자\s*[:：]/.test(String(item?.title ?? ''));
const TODAY_DUTY = /일일\s*당직자\s*[:：]?\s*([가-힣]{2,4})/;
/** 그날 일정 중 "안전활동 일일당직자 : 이름"에서 이름 (없으면 null) */
function todayDutyName(scheduleItems) {
  for (const item of scheduleItems) { const m = TODAY_DUTY.exec(String(item.title ?? '')); if (m) return m[1]; }
  return null;
}
return {todayDutyName,splitItems,parsePlanSheet,monthFromFileName,dutyTitle,exportDateFromFileName,parseDutyRoster,parseDutyCalendar,isDutyItem};
})();
