import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './sched-load.mjs';

const { buildIcs } = await load();
const STAMP = Date.UTC(2026, 10, 9, 0, 0);
const unfold = (s) => s.replace(/\r\n /g, '');

test('시각 있는 일정: 한국 시각 → UTC, 1시간', () => {
  const s = buildIcs([{ id: 'a', date: '2026-11-09', time: '14:00', title: '회의' }], STAMP);
  assert.match(s, /DTSTART:20261109T050000Z\r\n/);
  assert.match(s, /DTEND:20261109T060000Z\r\n/);
  assert.match(s, /SUMMARY:회의\r\n/);
});
test('이른 아침은 UTC 전날', () => {
  assert.match(buildIcs([{ id: 'a', date: '2026-11-09', time: '08:30', title: 'x' }], STAMP), /DTSTART:20261108T233000Z/);
});
test('오전·종일·시간 없음은 종일 일정, 월말은 다음 달로', () => {
  const s = buildIcs([{ id: 'a', date: '2026-11-30', time: '오전', title: '점검' }, { id: 'b', date: '2026-12-31', time: '종일', title: '교육' }, { id: 'c', date: '2026-11-02', time: '', title: '보고' }], STAMP);
  assert.match(s, /DTSTART;VALUE=DATE:20261130\r\nDTEND;VALUE=DATE:20261201/);
  assert.match(s, /DTEND;VALUE=DATE:20270101/);
  assert.match(s, /SUMMARY:오전 점검/);
  assert.match(s, /SUMMARY:교육\r\n/);
  assert.match(s, /SUMMARY:보고\r\n/);
});
test('특수문자 처리, 긴 줄은 75바이트로 접고 한글을 자르지 않음', () => {
  const title = '안전, 점검; 가\\나 ' + '한글제목'.repeat(20);
  const s = buildIcs([{ id: 'a', date: '2026-11-09', time: '', title }], STAMP);
  for (const line of s.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, line);
  assert.ok(!s.includes('\uFFFD'));
  assert.ok(unfold(s).includes('SUMMARY:안전\\, 점검\\; 가\\\\나 '));
});
test('구조: 전체 틀과 일정마다 고유 UID, CRLF', () => {
  const s = buildIcs([{ id: 'a', date: '2026-11-09', time: '', title: 'x' }, { id: 'b', date: '2026-11-10', time: '', title: 'y' }], STAMP);
  assert.ok(s.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.ok(s.endsWith('END:VCALENDAR\r\n'));
  assert.equal((s.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(s, /UID:a@hyeonjang-on/);
  assert.match(s, /UID:b@hyeonjang-on/);
  assert.ok(!/[^\r]\n/.test(s));
});
