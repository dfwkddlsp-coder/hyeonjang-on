// 일정표 읽기 함수(public/js/core/schedule.js)를 node에서 시험하려고 불러옴 (브라우저용 일반 스크립트라 vm으로)
import fs from 'node:fs';
import vm from 'node:vm';
const code = ['text', 'excel', 'ics'].map((n) => fs.readFileSync(new URL(`../public/js/core/sched-${n}.js`, import.meta.url), 'utf8')).join('\n');
const pad = (n) => String(n).padStart(2, '0');
export async function load() {
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return vm.runInThisContext(`(function(ymd){${code}
return {...SCHED_TXT,...SCHED_XL,...SCHED_ICS};})`)(ymd);
}
