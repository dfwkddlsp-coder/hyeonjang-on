// 현장ON — 일정표 화면: 연간 예정 · 월간 달력 자리 · 오늘부터 · 지난 일정 · 엑셀 끌어다 놓기
'use strict';
/* ---------- 일정 화면 ---------- */
R.schedule=(arg)=>{
  if(!R.schedule.open)R.schedule.open=new Set();
  const O=R.schedule.open,t=today(),all=scDated();
  const yr=SC.filter(x=>!x.date&&x.period).sort((a,b)=>String(a.created||'').localeCompare(String(b.created||'')));
  const fut=[...new Set(all.filter(x=>x.date>=t).map(x=>x.date))].sort();
  const n=R.schedule.n||SC_DAYS,shown=fut.slice(0,n);
  const past=[...new Set(all.filter(x=>x.date<t).map(x=>x.date))].sort().reverse();
  const months=[];for(const d of past){const k=d.slice(0,7);let m=months.find(x=>x.k===k);if(!m)months.push(m={k,days:[]});m.days.push(d)}
  const day=d=>`<div class="sch-dh">${scMD(d)}${d===t?' · <b>오늘</b>':''}</div><div class="list">${scDay(d).map(x=>scRow(x)).join('')}</div>`;
  const fold=(k,title,body)=>`<details class="card sch-fold" data-k="${h(k)}"${O.has(k)?' open':''}><summary>${title}</summary>${body}</details>`;
  V$().innerHTML=`<div id="schWrap"><h1>일정표</h1>
  ${can('sched.add')?`<button class="btn xl" id="schAdd" style="margin-bottom:12px"><i class="i i-plus"></i> 일정 추가</button>`:''}
  ${can('sched.add')&&can('file.excel')?`<div class="small muted sch-drop-h">PC에서는 엑셀 계획서·당직자 명단을 이 화면에 끌어다 놓아도 됩니다.</div>`:''}
  ${fold('yr',`<i class="i i-folder"></i> 연간 예정 일정표 (${yr.length}건)`,`<div class="list">${yr.map(x=>scRow(x,h(x.period))).join('')||'<div class="empty small">없습니다</div>'}</div>
    ${can('sched.add')?'<button class="btn sm ghost" id="schYr" style="margin-top:8px"><i class="i i-plus"></i> 연간 일정 추가</button>':''}`)}
  <div class="card sch-cal" id="schCal"></div>
  <div class="small muted" style="margin:14px 0 4px">오늘부터의 일정</div>
  <div class="card">${shown.map(day).join('')||'<div class="empty">다가오는 일정이 없습니다</div>'}
  ${fut.length>n?`<button class="btn sm line" id="schMore" style="width:100%;margin-top:10px">일정 더보기 (${fut.length-n}일 남음)</button>`:''}</div>
  ${past.length?fold('past',`<i class="i i-folder"></i> 지난 일정 (${past.length}일)`,months.map(m=>fold('m'+m.k,`${m.k.slice(0,4)}년 ${+m.k.slice(5)}월 · ${m.days.length}일 · ${m.days.reduce((s,d)=>s+scDay(d).length,0)}건`,m.days.map(day).join(''))).join('')):''}
  </div>`;
  const W$=$('#schWrap');
  $$('details.sch-fold',W$).forEach(d=>d.ontoggle=()=>{d.open?O.add(d.dataset.k):O.delete(d.dataset.k)});
  scBindRows(W$);
  const b=(id,fn)=>{const e=$('#'+id,W$);if(e)e.onclick=fn};
  schedCal($('#schCal',W$));
  b('schAdd',()=>schedQuick());b('schYr',()=>schedOne({period:''}));b('schMore',()=>{R.schedule.n=n+SC_DAYS;R.schedule()});
  if(can('sched.add')&&can('file.excel')){
    W$.ondragover=e=>{if([...(e.dataTransfer.types||[])].includes('Files')){e.preventDefault();W$.classList.add('sch-drag')}};
    W$.ondragleave=e=>{if(e.target===W$)W$.classList.remove('sch-drag')};
    W$.ondrop=e=>{e.preventDefault();W$.classList.remove('sch-drag');const f=e.dataTransfer.files[0];if(f)schedExcel(f)};
  }
  if(arg==='add'&&can('sched.add'))schedQuick();
};
