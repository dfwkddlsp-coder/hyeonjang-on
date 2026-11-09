// 현장ON — 일정표: 홈 맨 위 일정 공지 띠, 일정 화면(연간 예정·오늘부터·지난 일정), 빠른 입력, 엑셀 계획서·당직자 명단 넣기
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

/* ---------- 홈 맨 위 공지 띠 ---------- */
function schedBanner(){
  if(!can('sched.view'))return '';
  const t=today(),tm=addDays(t,1),td=scDay(t),duty=scDutyName(t),items=td.filter(x=>!scIsDuty(x)),nx=scDay(tm).filter(x=>!scIsDuty(x)),nd=scDutyName(tm);
  if(!items.length&&!duty&&!nx.length){
    const up=scDated().filter(x=>x.date>tm&&!scIsDuty(x)).sort(scSort)[0];
    if(up)return `<button type="button" class="sch-note slim" id="schGo"><i class="i i-records"></i><span class="sch-m">다음 일정 · ${h(md(up.date))}(${WD[new Date(up.date+'T00:00').getDay()]}) ${h(up.title)}</span><span class="sch-more">일정표 ›</span></button>`;
    return can('sched.add')?`<button type="button" class="sch-note slim" id="schGo"><i class="i i-records"></i><span class="sch-m">다가오는 일정이 없습니다</span><span class="sch-more">일정 추가 ›</span></button>`:'';
  }
  /* 두 줄만: 1줄 = 오늘 몇 건·당직, 2줄 = 오늘 일정을 한 줄로 이어 씀(넘치면 …). 오늘 일정이 없으면 내일 것. 자세한 건 눌러서 일정표 */
  const one=x=>`${x.time?`<span class="sch-t">${scTime(x.time)}</span> `:''}${h(x.title)}`;
  const line=items.length?items.map(one).join(' · '):nx.length?`내일 · ${nx.map(one).join(' · ')}`:nd?`내일 당직 ${h(nd)}`:'';
  return `<button type="button" class="sch-note" id="schGo">
    <div class="sch-h"><b><i class="i i-records"></i> 오늘 일정 ${items.length}건</b>${duty?`<span class="sch-duty">당직 ${h(duty)}</span>`:''}<span class="sch-more">전체 ›</span></div>
    ${line?`<div class="sch-line">${line}</div>`:''}
  </button>`;
}
function schedBannerMount(where){const b=$('#schGo');if(b)b.onclick=()=>go('schedule',b.textContent.includes('일정 추가')?'add':undefined)}
{const f=R.home;R.home=(...a)=>{f(...a);const html=schedBanner();if(!html)return;const hd=$('.hm-head',V$());if(hd)hd.insertAdjacentHTML('afterend',html);else V$().insertAdjacentHTML('afterbegin',html);schedBannerMount()}}
/* 장비운전원은 홈이 없고 장비점검이 첫 화면 → 그 위에 띠 */
{const f=R.eqcheck;R.eqcheck=(...a)=>{f(...a);if(viewOk('home'))return;const html=schedBanner();if(!html)return;V$().insertAdjacentHTML('afterbegin',html);schedBannerMount()}}

/* ---------- 일정 화면 ---------- */
R.schedule=(arg)=>{
  if(!R.schedule.open)R.schedule.open=new Set();
  const O=R.schedule.open,t=today(),all=scDated();
  const yr=SC.filter(x=>!x.date&&x.period).sort((a,b)=>String(a.created||'').localeCompare(String(b.created||'')));
  const fut=[...new Set(all.filter(x=>x.date>=t).map(x=>x.date))].sort();
  const n=R.schedule.n||SC_DAYS,shown=fut.slice(0,n);
  const past=[...new Set(all.filter(x=>x.date<t).map(x=>x.date))].sort().reverse();
  const months=[];for(const d of past){const k=d.slice(0,7);let m=months.find(x=>x.k===k);if(!m)months.push(m={k,days:[]});m.days.push(d)}
  const item=x=>`<div class="it sch-it${scCanEdit(x)?'':' ro'}" data-id="${h(x.id)}"><span class="sch-t">${scTime(x.time)}</span><div class="m">${h(x.title)}</div>${scCanEdit(x)?'<i class="i i-pen"></i>':''}</div>`;
  const day=d=>`<div class="sch-dh">${scMD(d)}${d===t?' · <b>오늘</b>':''}</div><div class="list">${scDay(d).map(item).join('')}</div>`;
  const fold=(k,title,body)=>`<details class="card sch-fold" data-k="${h(k)}"${O.has(k)?' open':''}><summary>${title}</summary>${body}</details>`;
  V$().innerHTML=`<div id="schWrap"><h1>일정표</h1>
  ${can('sched.add')?`<button class="btn xl" id="schAdd" style="margin-bottom:12px"><i class="i i-plus"></i> 일정 추가</button>`:''}
  ${can('sched.add')&&can('file.excel')?`<div class="small muted sch-drop-h">PC에서는 엑셀 계획서·당직자 명단을 이 화면에 끌어다 놓아도 됩니다.</div>`:''}
  ${fold('yr',`<i class="i i-folder"></i> 연간 예정 일정표 (${yr.length}건)`,`<div class="list">${yr.map(x=>`<div class="it sch-it${scCanEdit(x)?'':' ro'}" data-id="${h(x.id)}"><span class="sch-t">${h(x.period)}</span><div class="m">${h(x.title)}</div>${scCanEdit(x)?'<i class="i i-pen"></i>':''}</div>`).join('')||'<div class="empty small">없습니다</div>'}</div>
    ${can('sched.add')?'<button class="btn sm ghost" id="schYr" style="margin-top:8px"><i class="i i-plus"></i> 연간 일정 추가</button>':''}`)}
  <div class="card sch-cal" id="schCal"></div>
  <div class="small muted" style="margin:14px 0 4px">오늘부터의 일정</div>
  <div class="card">${shown.map(day).join('')||'<div class="empty">다가오는 일정이 없습니다</div>'}
  ${fut.length>n?`<button class="btn sm line" id="schMore" style="width:100%;margin-top:10px">일정 더보기 (${fut.length-n}일 남음)</button>`:''}</div>
  ${past.length?fold('past',`<i class="i i-folder"></i> 지난 일정 (${past.length}일)`,months.map(m=>fold('m'+m.k,`${m.k.slice(0,4)}년 ${+m.k.slice(5)}월 · ${m.days.length}일 · ${m.days.reduce((s,d)=>s+scDay(d).length,0)}건`,m.days.map(day).join(''))).join('')):''}
  </div>`;
  const W$=$('#schWrap');
  $$('details.sch-fold',W$).forEach(d=>d.ontoggle=()=>{d.open?O.add(d.dataset.k):O.delete(d.dataset.k)});
  $$('.sch-it',W$).forEach(r=>r.onclick=()=>{const o=SC.find(x=>x.id===r.dataset.id);if(o&&scCanEdit(o))schedOne(o)});
  const b=(id,fn)=>{const e=$('#'+id,W$);if(e)e.onclick=fn};
  /* 월간 달력: 일요일 시작, 점은 그 날 일정 수(당직 제외, 최대 3개). 날짜를 누르면 아래에 그 날 일정. 이 칸만 다시 그려서 화면이 튀지 않음 */
  const cal=()=>{
    const st=R.schedule,now=t.slice(0,7);if(!st.m){st.m=now;st.sel=t}
    const [y,m]=st.m.split('-').map(Number),lead=new Date(y,m-1,1).getDay(),last=new Date(y,m,0).getDate(),nowY=+t.slice(0,4);
    const box=$('#schCal',W$),cell=i=>{const d=`${st.m}-${pad(i)}`,wd=(lead+i-1)%7,n=Math.min(3,scDay(d).filter(x=>!scIsDuty(x)).length);
      return `<button type="button" class="sch-cd${wd===0?' sun':wd===6?' sat':''}${d===t?' today':''}${d===st.sel?' sel':''}" data-d="${d}" aria-label="${scMD(d)}"><span class="n">${i}</span><span class="dots">${'<span></span>'.repeat(n)}</span></button>`};
    const list=scDay(st.sel);
    box.innerHTML=`<div class="sch-cal-t"><b>월간 계획 보기</b>${st.m===now?'':'<button type="button" class="btn sm ghost" id="schNow">오늘</button>'}</div>
    <div class="sch-cal-h"><button type="button" class="btn sm line" id="schPrev" aria-label="전월">◀</button><div class="sch-cal-m">${y===nowY?'':y+'년 '}${m}월</div><button type="button" class="btn sm line" id="schNext" aria-label="다음 달">▶</button></div>
    <div class="sch-cg">${[...WD].map(x=>`<div class="sch-cw">${x}</div>`).join('')}${'<div class="sch-ce"></div>'.repeat(lead)}${Array.from({length:last},(_,i)=>cell(i+1)).join('')}</div>
    <div class="sch-dh sch-cal-d">${scMD(st.sel)}${st.sel===t?' · <b>오늘</b>':''}</div>
    <div class="list">${list.map(item).join('')||'<div class="empty small">일정 없음</div>'}</div>
    ${can('sched.add')?'<button type="button" class="btn sm ghost" id="schDay" style="margin-top:8px"><i class="i i-plus"></i> 이 날 일정 추가</button>':''}`;
    const mv=n=>{const k=ymd(new Date(y,m-1+n,1)).slice(0,7);st.m=k;st.sel=k===now?t:k+'-01';cal()};
    $('#schPrev',box).onclick=()=>mv(-1);$('#schNext',box).onclick=()=>mv(1);
    const nw=$('#schNow',box);if(nw)nw.onclick=()=>{st.m=now;st.sel=t;cal()};
    $$('[data-d]',box).forEach(x=>x.onclick=()=>{st.sel=x.dataset.d;cal()});
    $$('.sch-it',box).forEach(r=>r.onclick=()=>{const o=SC.find(x=>x.id===r.dataset.id);if(o&&scCanEdit(o))schedOne(o)});
    const ad=$('#schDay',box);if(ad)ad.onclick=()=>schedOne({date:st.sel,time:'',title:''});
  };
  cal();
  b('schAdd',()=>schedQuick());b('schYr',()=>schedOne({period:''}));b('schMore',()=>{R.schedule.n=n+SC_DAYS;R.schedule()});
  if(can('sched.add')&&can('file.excel')){
    W$.ondragover=e=>{if([...(e.dataTransfer.types||[])].includes('Files')){e.preventDefault();W$.classList.add('sch-drag')}};
    W$.ondragleave=e=>{if(e.target===W$)W$.classList.remove('sch-drag')};
    W$.ondrop=e=>{e.preventDefault();W$.classList.remove('sch-drag');const f=e.dataTransfer.files[0];if(f)schedExcel(f)};
  }
  if(arg==='add'&&can('sched.add'))schedQuick();
};

/* ---------- 빠른 입력 (한 줄에 일정 하나) ---------- */
function schedQuick(){
  const xl=can('file.excel');
  openModal('일정 추가',`<div class="small muted">한 줄에 일정 하나: <b>날짜 → 시간(생략 가능) → 내용</b>. 날짜만 쓴 줄 아래 줄들은 그 날짜로 들어갑니다.</div>
    <textarea class="inp" id="scTx" rows="6" style="margin-top:8px" placeholder="14일 오후 노사협의체 회의&#10;15일 14시 안전점검&#10;내일 9시 30분 교육"></textarea>
    <div id="scPv" class="sch-pv"></div>
    <button class="btn" id="scGo" style="width:100%;margin-top:10px">등록하기</button>
    ${xl?'<button class="btn line" id="scXl" style="width:100%;margin-top:8px"><i class="i i-sheet"></i> 엑셀 계획서로 넣기</button><input type="file" id="scXf" accept=".xlsx,.xls,.xlsm" hidden>':''}
    <div style="text-align:center;margin-top:10px"><a href="#" id="scOne" class="small">날짜·시간 직접 고르기</a></div>`,b=>{
    const tx=$('#scTx',b),pv=$('#scPv',b),go1=$('#scGo',b);
    const read=()=>SCHED_TXT.parseScheduleText(tx.value,new Date(),S.schedPm!==false);
    const draw=()=>{const r=read(),ok=r.filter(x=>!x.error).length;
      pv.innerHTML=r.map(x=>x.error?`<div class="bad">${h(x.line)} — ${h(x.error)}</div>`:`<div>${scMD(x.date)}${x.time?' · '+h(x.time):''} · ${h(x.title)}</div>`).join('');
      go1.textContent=ok?`${ok}건 등록하기`:'등록하기'};
    tx.oninput=draw;
    MODAL_GUARD=()=>!tx.value.trim()||confirm('입력한 일정을 버릴까요?');
    go1.onclick=async()=>{const r=read();if(!r.length)return toast('일정을 입력하세요');
      if(r.some(x=>x.error)){draw();return toast('빨간 줄을 고쳐야 저장됩니다')}
      go1.disabled=true;const lines=tx.value.split(/\r?\n/);let n=0;
      try{for(const x of r){await save('schedule',{id:uid(),date:x.date,time:x.time,title:x.title,created:nowLocal()});n++;
          const i=lines.findIndex(l=>l.trim()===x.line);if(i>=0)lines.splice(i,1)}}
      catch(e){tx.value=lines.join('\n');draw();go1.disabled=false;return toast(`${n}건 저장 후 멈췄습니다: ${e.message||e}`)}
      MODAL_GUARD=null;closeModal();toast(`일정 ${n}건을 넣었습니다`);if(cur==='schedule')R.schedule()};
    $('#scOne',b).onclick=e=>{e.preventDefault();MODAL_GUARD=null;schedOne({date:today(),time:'',title:''})};
    if(xl){const fi=$('#scXf',b);$('#scXl',b).onclick=()=>fi.click();fi.onchange=()=>{const f=fi.files[0];if(f){MODAL_GUARD=null;schedExcel(f)}}}
    setTimeout(()=>tx.focus(),50);
  });
}

/* ---------- 하나씩 추가·수정 (날짜 일정 또는 연간 예정) ---------- */
const SC_TIME_OK=/^(|오전|오후|종일|테마|([01]?\d|2[0-3]):[0-5]\d)$/;
function schedOne(o){
  const yr=!o.date&&'period' in o&&!o.date,isNew=!o.id;
  openModal(isNew?(yr?'연간 일정 추가':'일정 추가'):(yr?'연간 일정 수정':'일정 수정'),`
    ${yr?`<label class="f">시기 (예: 11월, 상반기)</label><input class="inp" id="soP" value="${h(o.period||'')}">`
      :`<label class="f">날짜</label><input class="inp" type="date" id="soD" value="${h(o.date||today())}">
        <label class="f">시간 (비우면 시간 없음)</label><input class="inp" id="soT" value="${h(o.time||'')}" placeholder="14:00">
        <div class="chips" style="margin-top:6px">${['종일','오전','오후'].map(x=>`<button type="button" class="chip${o.time===x?' on':''}" data-t="${x}">${x}</button>`).join('')}</div>`}
    <label class="f">일정 내용</label><input class="inp" id="soN" value="${h(o.title||'')}">
    <div class="small muted" style="margin-top:6px">전화번호는 넣지 마세요. 일정표는 모두가 봅니다.</div>
    <button class="btn" id="soS" style="width:100%;margin-top:12px">저장</button>
    ${!isNew&&canDel(o)?'<button class="btn line" id="soX" style="width:100%;margin-top:8px;color:var(--bad)">삭제</button>':''}`,b=>{
    $$('[data-t]',b).forEach(c=>c.onclick=()=>{$('#soT',b).value=c.dataset.t;$$('[data-t]',b).forEach(x=>x.classList.toggle('on',x===c))});
    $('#soS',b).onclick=async()=>{
      const title=$('#soN',b).value.trim();if(!title)return toast('일정 내용을 입력하세요');
      const n={...o,title};
      if(yr){n.period=$('#soP',b).value.trim();if(!n.period)return toast('시기를 입력하세요')}
      else{n.date=$('#soD',b).value;n.time=$('#soT',b).value.trim().replace(/^(\d):/,'0$1:');if(!n.date)return toast('날짜를 고르세요');if(!SC_TIME_OK.test(n.time))return toast('시간은 14:00 · 오전 · 오후 · 종일 처럼 쓰세요')}
      if(isNew){n.id=uid();n.created=nowLocal()}
      try{await save('schedule',n)}catch(e){return toast(e.message||'저장하지 못했습니다')}
      closeModal();toast('저장했습니다');if(cur==='schedule')R.schedule()};
    const x=$('#soX',b);if(x)x.onclick=async()=>{if(!confirm(`"${o.title}" 일정을 삭제할까요?`))return;
      try{await remove('schedule',o.id)}catch(e){return toast(e.message||'삭제하지 못했습니다')}closeModal();toast('삭제했습니다');if(cur==='schedule')R.schedule()};
  });
}

/* ---------- 엑셀로 넣기: 월간 안전관리계획서 → KOSHA 당직자 명단 → 당직 달력표 순서로 읽어 봄 ---------- */
function schedSheetRead(wb,sheet,name){
  const rows=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,raw:false,defval:''});
  const now=new Date(),fm=SCHED_XL.monthFromFileName(name),ref=SCHED_XL.exportDateFromFileName(name)||fm||{year:now.getFullYear(),month:now.getMonth()+1};
  const plan=SCHED_XL.parsePlanSheet(rows,fm);
  if(plan&&(plan.items.length||plan.notes.length))return plan;
  return SCHED_XL.parseDutyRoster(rows,ref)||SCHED_XL.parseDutyCalendar(rows,ref);
}
async function schedExcel(f){
  if(!can('file.excel'))return toast('엑셀 파일은 관리자·운영자만 올릴 수 있습니다');
  let wb;try{wb=await readFile(f)}catch(e){return toast('엑셀 파일을 읽지 못했습니다')}
  const fm=SCHED_XL.monthFromFileName(f.name);
  const sheets=[...wb.SheetNames].sort((a,b)=>{const m=s=>fm&&new RegExp(`(^|\\D)0?${fm.month}(\\D|$)`).test(s)?0:1;return m(a)-m(b)});
  const found=sheets.map(s=>({s,r:schedSheetRead(wb,s,f.name)})).filter(x=>x.r);
  if(!found.length)return toast('일정을 찾지 못했습니다 (월간 계획서·당직자 명단 모양이 아닙니다)');
  schedImport(found,0,f.name);
}
function schedImport(found,k,fname){
  const {s,r}=found[k],have=new Set(scDated().map(scKey));
  const items=r.items.map(x=>({...x,dup:have.has(scKey(x))}));
  const newKeys=new Set(items.map(scKey)),ym=`${r.year}-${pad(r.month)}`;
  const oldDuty=r.kind==='duty'?scDated().filter(x=>x.date.startsWith(ym)&&scIsDuty(x)&&!newKeys.has(scKey(x))):[];
  const yrHave=new Set(SC.filter(x=>x.period).map(x=>x.period+'|'+x.title));
  const notes=(r.notes||[]).filter(t=>!yrHave.has(`${r.month}월|${t}`));
  openModal('엑셀로 일정 넣기',`<div class="small muted">${h(fname)}${found.length>1?'':` · ${h(s)}`} — ${r.year}년 ${r.month}월 ${r.kind==='duty'?'당직자 명단':'계획서'}</div>
    ${found.length>1?`<label class="f">시트</label><select class="inp" id="siS">${found.map((x,i)=>`<option value="${i}"${i===k?' selected':''}>${h(x.s)}</option>`).join('')}</select>`:''}
    ${oldDuty.length?`<label class="sch-ck warn"><input type="checkbox" id="siRep" checked> 기존 ${r.month}월 당직자 일정 ${oldDuty.length}건을 지우고 이 명단으로 바꾸기</label>`:''}
    <div class="row" style="margin:10px 0 4px"><button type="button" class="btn sm ghost" id="siAll">모두 선택</button><button type="button" class="btn sm ghost" id="siNone">모두 해제</button></div>
    <div class="sch-pick">${items.map((x,i)=>`<label class="sch-ck${x.dup?' dup':''}"><input type="checkbox" data-i="${i}"${x.dup?'':' checked'}> <span><b>${h(md(x.date))}</b>${x.time?' · '+h(x.time):''} ${h(x.title)}${x.dup?' <span class="badge bgray">이미 있음</span>':''}</span></label>`).join('')||'<div class="empty small">날짜 있는 일정이 없습니다</div>'}</div>
    ${notes.length?`<div class="small muted" style="margin-top:10px">날짜 없는 예정 — 고르면 <b>연간 예정</b>에 "${r.month}월"로 들어갑니다</div><div class="sch-pick">${notes.map((t,i)=>`<label class="sch-ck"><input type="checkbox" data-n="${i}"> <span>${h(t)}</span></label>`).join('')}</div>`:''}
    <button class="btn" id="siGo" style="width:100%;margin-top:12px">등록하기</button>`,b=>{
    const go1=$('#siGo',b),cks=()=>$$('input[data-i]',b),nks=()=>$$('input[data-n]',b);
    const cnt=()=>{const n=cks().filter(c=>c.checked).length+nks().filter(c=>c.checked).length;go1.textContent=n?`${n}건 등록하기`:($('#siRep',b)&&$('#siRep',b).checked?'당직자만 바꾸기':'등록하기')};
    b.onchange=cnt;cnt();
    $('#siAll',b).onclick=()=>{cks().forEach(c=>c.checked=true);cnt()};$('#siNone',b).onclick=()=>{cks().forEach(c=>c.checked=false);cnt()};
    const sel=$('#siS',b);if(sel)sel.onchange=()=>schedImport(found,+sel.value,fname);
    go1.onclick=async()=>{
      const pick=cks().filter(c=>c.checked).map(c=>items[+c.dataset.i]),np=nks().filter(c=>c.checked).map(c=>notes[+c.dataset.n]),rep=$('#siRep',b)&&$('#siRep',b).checked;
      if(!pick.length&&!np.length&&!rep)return toast('넣을 일정을 고르세요');
      go1.disabled=true;let n=0,del=0,miss=0;
      try{
        /* 새 명단 먼저 저장 → 그다음 옛 당직자 일정만 지움 (중간에 멈춰도 그 달 당직이 비지 않게) */
        for(const x of pick){await save('schedule',{id:uid(),date:x.date,time:x.time||(x.theme?'테마':''),title:x.title,src:'excel',created:nowLocal()});n++}
        for(const t of np){await save('schedule',{id:uid(),period:`${r.month}월`,title:t,src:'excel',created:nowLocal()});n++}
      }catch(e){go1.disabled=false;return toast(`${n}건 저장 후 멈췄습니다: ${e.message||e}`)}
      if(rep)for(const o of oldDuty){if(!canDel(o)){miss++;continue}try{await remove('schedule',o.id);del++}catch(e){miss++}}
      closeModal();toast(`일정 ${n}건을 넣었습니다.${del?` (기존 당직자 ${del}건 지움)`:''}${miss?` 기존 ${miss}건은 지우지 못했습니다(운영자·쓴 사람만 삭제)`:''}`);
      if(cur==='schedule')R.schedule();else go('schedule')};
  });
}
