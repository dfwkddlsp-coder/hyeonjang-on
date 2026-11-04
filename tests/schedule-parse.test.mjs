import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './sched-load.mjs';

const { parseScheduleText, byScheduleTime } = await load();

// 2026-10-12 (월)
const NOW = new Date(2026, 9, 12, 9, 0);
const read = (text, now = NOW) => parseScheduleText(text, now).map(({ line, ...rest }) => rest);

test('the two example lines: 오후 kept as a word, 14시 read as a clock time', () => {
  assert.deepEqual(read('14일 오후 노사협의체 회의\n15일 14시 안전점검'), [
    { date: '2026-10-14', time: '오후', title: '노사협의체 회의' },
    { date: '2026-10-15', time: '14:00', title: '안전점검' },
  ]);
});

test('clock forms: 오전/오후 N시, N시 M분, N시 반, HH:MM, and 1~6시 alone as afternoon', () => {
  assert.deepEqual(read(`14일 오전 9시 TBM
14일 오후 2시 30분 교육
14일 10시 반 순회점검
14일 16:30 회의
14일 3시 장비점검
14일 오전 12시 야간작업 종료`).map((r) => r.time), ['09:00', '14:30', '10:30', '16:30', '15:00', '00:00']);
});

test('date forms: N월 N일, M/D, M.D, weekday in brackets or 요일, 오늘/내일/모레', () => {
  assert.deepEqual(read(`10월 20일 교육
10/21(수) 점검
10.22 목요일 회의
오늘 TBM
내일(화) 순회
모레 반입`).map((r) => r.date), ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-12', '2026-10-13', '2026-10-14']);
});

test('a day already past this month means next month; a month long past means next year', () => {
  assert.equal(read('5일 회의')[0].date, '2026-11-05');
  assert.equal(read('12일 회의')[0].date, '2026-10-12');
  assert.equal(read('1/8 회의', new Date(2026, 11, 20))[0].date, '2027-01-08');
  assert.equal(read('9/30 회의')[0].date, '2026-09-30');
});

test('a line without a date belongs to the date above it', () => {
  assert.deepEqual(read('14일\n오전 TBM\n- 오후 2시 점검'), [
    { date: '2026-10-14', time: '오전', title: 'TBM' },
    { date: '2026-10-14', time: '14:00', title: '점검' },
  ]);
});

test('titles that start like a time or weekday are left alone', () => {
  assert.deepEqual(read('14일 일일점검\n14일 3차 안전교육\n14일 오후반 작업'), [
    { date: '2026-10-14', time: '', title: '일일점검' },
    { date: '2026-10-14', time: '', title: '3차 안전교육' },
    { date: '2026-10-14', time: '', title: '오후반 작업' },
  ]);
});

test('unreadable lines are reported, not guessed', () => {
  assert.deepEqual(read('회의\n31일(?) x'), [{ error: '날짜를 찾지 못했어요 (예: 14일)' }, { date: '2026-10-31', time: '', title: '(?) x' }]);
  assert.deepEqual(read('2/30 회의'), [{ error: '없는 날짜예요' }]);
  assert.deepEqual(read('14일 25시 회의'), [{ error: '없는 시간이에요' }]);
});

test('sorting puts 종일 and untimed first, 오전 before morning times, 오후 at noon', () => {
  const items = ['14:00', '오후', '09:00', '오전', '종일'].map((time) => ({ time }));
  assert.deepEqual(items.sort(byScheduleTime).map((i) => i.time), ['종일', '오전', '09:00', '오후', '14:00']);
});

test('현장ON 설정: "1~6시는 오후" 규칙을 끄면 오전으로 읽음', () => {
  assert.equal(parseScheduleText('14일 3시 교육', NOW)[0].time, '15:00');
  assert.equal(parseScheduleText('14일 3시 교육', NOW, false)[0].time, '03:00');
});
