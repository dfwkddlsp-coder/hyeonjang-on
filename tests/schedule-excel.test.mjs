import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './sched-load.mjs';

const { parsePlanSheet, splitItems, monthFromFileName } = await load();

// Same shape as the 월간 안전관리계획서 sheet (made-up content): weekday columns 0,1,3,5,7,9,11, merged cells left blank.
const week = (days) => [days[0], days[1], '', days[2], '', days[3], '', days[4], '', days[5], '', days[6]];
const ROWS = [
  [],
  ['', '2026년 11월', '', '', '안전보건 업무계획'],
  [],
  ['일', '월', '', '화', '', '수', '', '목', '', '금', '', '토'],
  week([1, 2, 3, 4, 5, 6, 7]),
  week(['※ 1주차 테마점검 화재예방점검', '', '', '1. 노사합동점검(아침조회 후)', '1. 주간업무 보고 2. 관리비 마감\n및 본사 송부', '', '1.J-POINT 적립 홍길동 근무']),
  week([8, 9, 10, 11, 12, 13, 14]),
  week(['', '1. 가설 사무실 점검 2, J-J Talk', '2. 노사협의체 회의 (14:00)', '', '', '', '']),
  week([29, 30, 1, 2, 3, 4, 5]),
  week(['※ 5주차 테마점검 공도구 점검', '1. 컨테이너 점검', '1. 다음 달 일정', '', '', '', '']),
  ['●<11월 중 확인점검 예정>, ●경영위원회 예정'],
  week([6, 7, 8, 9, 10, 11, 12]),
  week(['※ 다음 달 테마', '1. 다음 달', '', '', '', '', '']),
];

test('reads this month\'s items, splitting numbered items and pulling out times', () => {
  const plan = parsePlanSheet(ROWS);
  assert.equal(plan.year, 2026);
  assert.equal(plan.month, 11);
  assert.deepEqual(plan.items.map(({ date, time, title, theme }) => [date, time, title, theme]), [
    ['2026-11-02', '', '1주차 테마점검 화재예방점검', true],
    ['2026-11-04', '', '노사합동점검(아침조회 후)', false],
    ['2026-11-05', '', '주간업무 보고', false],
    ['2026-11-05', '', '관리비 마감 및 본사 송부', false],
    ['2026-11-07', '', 'J-POINT 적립 홍길동 근무', false],
    ['2026-11-09', '', '가설 사무실 점검', false],
    ['2026-11-09', '', 'J-J Talk', false],
    ['2026-11-10', '14:00', '노사협의체 회의', false],
    ['2026-11-30', '', '5주차 테마점검 공도구 점검', true],
    ['2026-11-30', '', '컨테이너 점검', false],
  ]);
});

test('lines without a date come back as notes', () => {
  assert.deepEqual(parsePlanSheet(ROWS).notes, ['11월 중 확인점검 예정', '경영위원회 예정']);
});

test('days of the previous month at the start are skipped', () => {
  const rows = [
    ['26년 08월 안전보건 업무계획'],
    ['일', '월', '', '화', '', '수', '', '목', '', '금', '', '토'],
    week([26, 27, 28, 29, 30, 31, 1]),
    week(['', '7월 일정', '', '', '', '', '8월 1일 일정']),
  ];
  const plan = parsePlanSheet(rows);
  assert.equal(plan.month, 8);
  assert.deepEqual(plan.items.map((i) => [i.date, i.title]), [['2026-08-01', '8월 1일 일정']]);
});

test('not a calendar, or no month anywhere → null; the file name can supply the month', () => {
  assert.equal(parsePlanSheet([['결 재', '담 당']]), null);
  const noTitle = ROWS.slice(3);
  assert.equal(parsePlanSheet(noTitle), null);
  assert.equal(parsePlanSheet(noTitle, monthFromFileName('26.11_월간_안전관리계획서.xlsx')).month, 11);
  assert.deepEqual(monthFromFileName('26.11_월간.xlsx'), { year: 2026, month: 11 });
  assert.equal(monthFromFileName('계획서.xlsx'), null);
});

test('splitItems keeps plain text whole and ignores numbers that are not item numbers', () => {
  assert.deepEqual(splitItems('정기교육(~19일 공종별 진행)'), [{ time: '', title: '정기교육(~19일 공종별 진행)' }]);
  assert.deepEqual(splitItems('1. (07:00) MSDS 교육 2. 3동 점검'), [{ time: '07:00', title: 'MSDS 교육' }, { time: '', title: '3동 점검' }]);
});

test('phone numbers are left out of the titles (the 일정표 is visible to every approved worker)', () => {
  assert.deepEqual(splitItems('1.J-POINT 적립 홍길동 매니저 근무 (010-1234-5678)'), [{ time: '', title: 'J-POINT 적립 홍길동 매니저 근무' }]);
  assert.deepEqual(splitItems('1. 안전교육 (14:00) 문의 010.1234.5678'), [{ time: '14:00', title: '안전교육 문의' }]);
  assert.deepEqual(splitItems('2. 3동 101호 점검 2026년'), [{ time: '', title: '3동 101호 점검 2026년' }]);
});

test('KOSHA 일일안전당직자 roster: each "O" becomes "안전활동 일일당직자 : 이름" on that day', async () => {
  const { parseDutyRoster, exportDateFromFileName, dutyTitle } = await load();
  const { todayDutyName } = await load();
  const rows = [
    ['기업/협력사', '성명', '직위', '현장직책', '일별의무건수', '11/01 (일)', '11/02 (월)', '11/03 (화)', '11/04 (수)', '11/05 (목)'],
    ['제일건설(주)', '홍길동', '매니저', '안전관리자', '2', '', 'O', '', '', 'O'],
    ['제일건설(주)', '김철수', '매니저', '건축팀원', '2', '', '', 'O', '', ''],
    ['제일건설(주)', '이영희', '책임매니저', '현장소장', '0', '', '', '', '', ''],
  ];
  const ref = exportDateFromFileName('MyKoshaData_20261029.xlsx');
  assert.deepEqual(ref, { year: 2026, month: 10 });
  const roster = parseDutyRoster(rows, ref);
  assert.equal(roster.kind, 'duty');
  assert.equal(roster.month, 11);
  assert.deepEqual(roster.items.map((i) => [i.date, i.title]), [
    ['2026-11-02', '안전활동 일일당직자 : 홍길동'],
    ['2026-11-03', '안전활동 일일당직자 : 김철수'],
    ['2026-11-05', '안전활동 일일당직자 : 홍길동'],
  ]);
  assert.equal(todayDutyName([{ title: dutyTitle('홍길동') }]), '홍길동', 'the home duty circle reads it');
  // A January roster downloaded in December belongs to next year.
  const jan = parseDutyRoster([['성명', '1/01 (금)', '1/02 (토)', '1/03 (일)', '1/04 (월)', '1/05 (화)'], ['홍길동', 'O']], { year: 2026, month: 12 });
  assert.deepEqual(jan.items.map((i) => i.date), ['2027-01-01']);
  assert.equal(parseDutyRoster([['결 재', '담 당']], ref), null);
});

test('일일안전당직자 달력표: the person under each date cell, the month from the title, holidays skipped', async () => {
  const { parseDutyCalendar, isDutyItem } = await load();
  const rows = [
    ['(26.11월) 일일안전당직자'],
    ['월', '', '화', '', '수', '', '목', '', '금', '', '토', '', '일'],
    ['10/26', '', '10/27', '', '11/1'],
    ['지난달', '', '', '', ''],
    [],
    ['11/2', '', '11/3', '', '11/4', '', '11/5'],
    ['홍길동', '', '김 철 수', '', '추석연휴', '', ''],
    ['*변경 필요시 안전보건팀에 문의.'],
  ];
  const roster = parseDutyCalendar(rows, null);
  assert.equal(roster.kind, 'duty');
  assert.deepEqual([roster.year, roster.month], [2026, 11]);
  assert.deepEqual(roster.items.map((i) => [i.date, i.title]), [
    ['2026-11-02', '안전활동 일일당직자 : 홍길동'],
    ['2026-11-03', '안전활동 일일당직자 : 김철수'],
  ]);
  assert.equal(parseDutyCalendar([['월간 안전관리계획서']], null), null);
  assert.equal(isDutyItem({ title: '안전활동 일일당직자 : 홍길동' }), true);
  assert.equal(isDutyItem({ title: '노사협의체 회의' }), false);
});
