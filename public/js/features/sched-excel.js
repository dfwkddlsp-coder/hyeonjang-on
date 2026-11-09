// 현장ON — 일정표 엑셀로 넣기: 계획서 · 당직자 명단을 읽어 고른 것만 저장
'use strict';
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
