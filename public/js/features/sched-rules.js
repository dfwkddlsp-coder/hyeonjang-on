// 현장ON — 일정표 공통: 기록 형태, 조회, 일정 한 줄, 파일 내려받기
'use strict';
/* 기록(store 'schedule'): 날짜 일정 {date:'YYYY-MM-DD', time:''|'HH:MM'|'오전'|'오후'|'종일'|'테마', title, src?}
   연간 예정 {period:'11월'|'상반기'…, title}. 당직자는 일정 제목 "안전활동 일일당직자 : 이름" (KOSHA 명단과 같은 모양).
   권한: 보기 sched.view, 추가·수정 sched.add(본인 글만, 운영자는 전부), 엑셀은 file.excel도, 삭제는 본인 글·운영자 (서버도 같은 검사) */
const SC_DAYS=10;
const scDated=()=>SC.filter(x=>x.date);
const scSort=(a,b)=>a.date.localeCompare(b.date)||SCHED_TXT.byScheduleTime(a,b)||String(a.created||'').localeCompare(String(b.created||''));
const scDay=ds=>scDated().filter(x=>x.date===ds).sort(scSort);
const scIsDuty=x=>SCHED_XL.isDutyItem(x);
const scDutyName=ds=>SCHED_XL.todayDutyName(scDay(ds));
const scTime=t=>t?h(t):'';
const scMD=ds=>{const d=new Date(ds+'T00:00');return `${d.getMonth()+1}월 ${d.getDate()}일 (${WD[d.getDay()]})`};
const scCanEdit=o=>can('sched.add')&&ownRec(o);
const scKey=x=>x.date+'|'+String(x.title).replace(/\s+/g,'');
/* 일정 한 줄 (달력·목록·연간 예정 공통). label을 안 주면 시간 칸 */
const scRow=(x,label=scTime(x.time))=>`<div class="it sch-it${scCanEdit(x)?'':' ro'}" data-id="${h(x.id)}"><span class="sch-t">${label}</span><div class="m">${h(x.title)}</div>${scCanEdit(x)?'<i class="i i-pen"></i>':''}</div>`;
function scBindRows(root){$$('.sch-it',root).forEach(r=>r.onclick=()=>{const o=SC.find(x=>x.id===r.dataset.id);if(o&&scCanEdit(o))schedOne(o)})}
/* 달력 파일 내려받기 (이 기기에 이미 있는 일정으로 만듦) */
function scDownload(name,text,type){const u=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000)}
