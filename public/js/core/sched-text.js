// 현장ON — 일정표 빠른 입력 한 줄 읽기 (화면·DB 없음, tests/schedule-parse.test.mjs)
// 안전게시판 core/schedule-parse.js 를 옮겨 옴. 바뀐 점: "1~6시는 오후" 규칙을 끌 수 있음 (설정 schedPm)
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
