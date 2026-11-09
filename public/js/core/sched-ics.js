// 현장ON — 일정표 달력 파일(.ics) 만들기 (화면·DB 없음, tests/schedule-ics.test.mjs)
'use strict';
/* 달력 파일(.ics): 휴대폰 기본 달력(아이폰·갤럭시)에 한 달 일정을 넣는 복사본. 시각 있는 일정은 1시간(한국 시각 기준), 나머지는 종일 + 제목 앞에 오전·오후 등 */
const SCHED_ICS=(()=>{
const p2=n=>String(n).padStart(2,'0');
const esc=s=>String(s??'').replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
const utc=ms=>{const d=new Date(ms);return d.getUTCFullYear()+p2(d.getUTCMonth()+1)+p2(d.getUTCDate())+'T'+p2(d.getUTCHours())+p2(d.getUTCMinutes())+'00Z'};
/* 한 줄은 75바이트까지, 넘으면 줄을 접음 (한글 글자 중간에서 자르지 않음) */
const fold=line=>{const out=[];let cur='',n=0;for(const ch of line){const b=new TextEncoder().encode(ch).length;if(n+b>(out.length?74:75)){out.push(cur);cur='';n=0}cur+=ch;n+=b}out.push(cur);return out.join('\r\n ')};
/* 당직 일정 ("안전활동 일일당직자 : 이름") */
const isDuty=item=>/일일\s*당직자\s*[:：]/.test(String(item&&item.title||''));
/* opts.name: 구독 달력 이름 (달력 앱에 1시간마다 새로 읽으라고 알려 줌) */
function buildIcs(items,stampMs,opts={}){
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//hyeonjang-on//schedule//KO','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
  if(opts.name)L.push('X-WR-CALNAME:'+esc(opts.name),'REFRESH-INTERVAL;VALUE=DURATION:PT1H','X-PUBLISHED-TTL:PT1H');
  for(const x of items){
    const [y,m,d]=x.date.split('-').map(Number),t=String(x.time||''),c=/^(\d{1,2}):(\d{2})$/.exec(t);
    L.push('BEGIN:VEVENT','UID:'+esc(x.id)+'@hyeonjang-on','DTSTAMP:'+utc(stampMs));
    if(c){const s=Date.UTC(y,m-1,d,+c[1]-9,+c[2]);L.push('DTSTART:'+utc(s),'DTEND:'+utc(s+36e5))}
    else{const e=new Date(Date.UTC(y,m-1,d+1));L.push('DTSTART;VALUE=DATE:'+y+p2(m)+p2(d),'DTEND;VALUE=DATE:'+e.getUTCFullYear()+p2(e.getUTCMonth()+1)+p2(e.getUTCDate()))}
    L.push('SUMMARY:'+esc((t&&!c&&t!=='종일'?t+' ':'')+x.title),'END:VEVENT');
  }
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n')+'\r\n';
}
return {buildIcs,isDuty};
})();
if(typeof module!=='undefined')module.exports=SCHED_ICS; /* 서버(worker/routes/calfeed.js)도 같은 코드를 씀 */
