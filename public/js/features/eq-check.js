// 현장ON — 장비 점검: 장비점검 화면 · 장비 삭제
'use strict';
function eqCheckForm(eid,ds){eqWeekForm(eid,weekMon(ds||today()))}

/* 장비 삭제: 추가한 사람·관리자·운영자 (잘못 추가한 장비). 그 장비의 점검 기록도 함께 지워짐 — 서버도 같은 규칙 */
const canDelEq=e=>!!e&&(can('equip.del')||canDel(e));
async function eqDelete(e,after){if(!e)return;
  const n=EC.filter(c=>c.equipId===e.id).length;
  if(!confirm(`「${eqName(e)}」을(를) 삭제할까요?${n?`
이 장비의 점검표·사진 기록 ${n}건도 함께 지워집니다.`:''}`))return;
  try{await remove('equipment',e.id);for(const c of EC.filter(c=>c.equipId===e.id)){await DB.del('eqchecks',c.id);memDel('eqchecks',c.id)}
    toast('장비를 삭제했습니다');if(after)after();R[cur]()}catch(x){if(x.message!=='offline')toast(x.message)}}
/* 관리자 목록의 장비 카드: 운전원이 따로 한 점검 요약 + 보기 */
function eqDrvLine(e,mon,days){const w=eqWeekRec(e.id,mon,'drv'),p=eqWeekPhoto(e.id,mon,'drv');if(!w&&!p)return '';
  const n=days.filter(d=>eqDayMark(e.id,d,'drv')).length,bad=days.some(d=>eqDayMark(e.id,d,'drv')==='X');
  return `<div class="eq-drv"><span class="grow small"><b>운전원 점검</b> · 점검표 ${n}일${bad?' <span class="badge bbad">부적합</span>':''} · 사진 ${p?(p.photos||[]).length:0}장</span>${w?`<button class="btn sm line" data-dwk="${e.id}">점검표</button>`:''}${p?`<button class="btn sm line" data-dwp="${e.id}">사진</button>`:''}</div>`}
R.eqcheck=()=>{
  const ds=R.eqcheck.d||today();const mon=weekMon(ds);const days=weekDays(mon);const t=today();
  const f=R.eqcheck.f||(E.some(isMine)?'mine':'all');const q=R.eqcheck.q||'';
  const inUse=eqTargets();
  const list=inUse.filter(e=>(f!=='mine'||isMine(e))&&(f!=='todo'||!eqDayMark(e.id,t))&&(!q||norm([e.type,e.plate,e.company,e.manager,e.operator].join(' ')).includes(norm(q))))
    .sort((a,b)=>(isMine(b)-isMine(a))||(+a.no||999)-(+b.no||999));
  const done=inUse.filter(e=>eqDayMark(e.id,t)).length,mine=inUse.filter(isMine),mineTodo=mine.filter(e=>!eqDayMark(e.id,t));
  const phDone=inUse.filter(e=>{const p=eqWeekPhoto(e.id,mon);return p&&(p.photos||[]).length>=eqSlots(e).length}).length;
  const future=mon>weekMon(t),drv=!can('equip.view'); // 모든 장비를 못 보면(운전원) 필터·검색 없이 본인 장비만
  V$().innerHTML=`<div class="row" style="justify-content:space-between"><h1>장비 점검</h1>${!can('equip.add')?'':'<button class="btn sm" id="eqAdd"><i class="i i-plus"></i> 장비 추가</button>'}</div>
  <div class="row" style="margin-bottom:10px"><button class="btn sm line" id="wPrev">◀</button><div class="grow" style="text-align:center"><b>${weekLabel(mon)}</b><div class="small muted">${md(days[0])} ~ ${md(days[5])}</div></div><button class="btn sm line" id="wNext">▶</button>${mon!==weekMon(t)?'<button class="btn sm ghost" id="wNow">이번 주</button>':''}</div>
  <div class="grid g4" style="margin-bottom:10px"><div class="stat"><div class="t">오늘 점검</div><div class="n">${done}<span class="small muted">/${inUse.length}대</span></div></div>
   ${drv?'':`<div class="stat"><div class="t">내 담당 미점검</div><div class="n" style="color:${mineTodo.length?'var(--bad)':'inherit'}">${mineTodo.length}<span class="small muted">/${mine.length}대</span></div></div>`}
   <div class="stat"><div class="t">주간 사진 완료</div><div class="n">${phDone}<span class="small muted">/${inUse.length}대</span></div></div></div>
  ${drv?'':`<button class="btn line" id="pAll" style="width:100%;margin-bottom:10px"><i class="i i-print"></i> 주간 출력</button>
  <div class="chips scroll" style="margin-bottom:8px">${[['mine','내 담당'],['all','전체'],['todo','오늘 미점검']].map(([k,l])=>`<button class="chip ${f===k?'on':''}" data-ef="${k}">${l}</button>`).join('')}</div>
  <input class="inp" id="eqq" type="search" placeholder="장비명·차량번호·업체·전담관리자" value="${h(q)}" style="margin-bottom:10px">`}
  ${!inUse.length?`<div class="card empty">${isGuest()?'<b>＋ 장비 추가</b>를 눌러 오늘 쓸 장비를 등록하세요.':drv?'내 장비가 없습니다. 장비 대장의 운전원 연락처가 로그인 번호와 같은지 관리자에게 확인해 주세요.':'장비 대장이 비어 있습니다. 관리대장 → 장비에서 엑셀을 불러오세요.'}</div>`:''}
  ${list.map(e=>{const wp=eqWeekPhoto(e.id,mon),pn=wp?(wp.photos||[]).length:0,slots=eqSlots(e).length;
    return `<div class="card eqc"><div class="row" style="gap:8px"><div class="grow" style="min-width:0"><b>${h(eqName(e))}</b>${isMine(e)?' <span class="badge">내 담당</span>':''}${eqWeekComplete(e.id,mon)?' '+stampHtml('sm'):''}<div class="small muted ell">${h(e.company||'')} · 전담 ${h(e.manager||'미지정')}${e.operator?' · 운전원 '+h(e.operator):''} · 양식 ${h(eqFormName(e))}</div></div>${canDelEq(e)?`<button class="btn sm line" data-eqdel="${e.id}" aria-label="장비 삭제" title="장비 삭제"><i class="i i-x"></i></button>`:''}</div>
    <div class="eqdays">${days.map((d,i)=>{const m=eqDayMark(e.id,d);return `<div class="eqd${d===t?' today':''}${m==='O'?' ok':m==='X'?' bad':''}${d>t&&!m?' off':''}"><span>${WD6[i]} ${md(d)}</span><b>${m==='O'?'○':m==='X'?'×':m==='P'?'…':d>t?'':'–'}</b></div>`}).join('')}</div>
    ${future?'':`<div class="eq-acts"><button class="btn sm${eqWeekRec(e.id,mon)?' line':''}" data-wk="${e.id}"><i class="i i-pen"></i> ${eqWeekRec(e.id,mon)?'점검표 수정':'주간 점검표'}</button>
      <button class="btn sm ${pn>=slots?'line':'ghost'}" data-wp="${e.id}"><i class="i i-camera"></i> 주간 사진 ${pn}/${slots}</button></div>
      ${drv?'':`<button class="btn sm line" data-pr="${e.id}" style="width:100%;margin-top:8px"><i class="i i-print"></i> 이 장비 출력</button>`}`}${drv?'':eqDrvLine(e,mon,days)}</div>`}).join('')}
  ${inUse.length&&!list.length?'<div class="card empty">해당 장비 없음</div>':''}`;
  const setD=v=>{R.eqcheck.d=v;R.eqcheck()};
  $('#wPrev').onclick=()=>setD(addDays(mon,-7));$('#wNext').onclick=()=>setD(addDays(mon,7));if($('#wNow'))$('#wNow').onclick=()=>setD(t);
  $$('[data-ef]').forEach(b=>b.onclick=()=>{R.eqcheck.f=b.dataset.ef;R.eqcheck()});
  if($('#eqq'))bindSearch('#eqq',v=>R.eqcheck.q=v,()=>R.eqcheck());
  $$('[data-wk]').forEach(b=>b.onclick=()=>eqWeekForm(b.dataset.wk,mon));
  if($('#eqAdd'))$('#eqAdd').onclick=eqQuickAdd;
  $$('[data-wp]').forEach(b=>b.onclick=()=>eqWeekPhotoForm(b.dataset.wp,mon));
  $$('[data-eqdel]').forEach(b=>b.onclick=()=>eqDelete(E.find(x=>x.id===b.dataset.eqdel)));
  $$('[data-dwk]').forEach(b=>b.onclick=()=>eqWeekForm(b.dataset.dwk,mon,false,'drv'));
  $$('[data-dwp]').forEach(b=>b.onclick=()=>eqWeekPhotoForm(b.dataset.dwp,mon,'drv'));
  $$('[data-pr]').forEach(b=>b.onclick=()=>{const e=E.find(x=>x.id===b.dataset.pr);eqPrintChoose([e],mon,`출력 · ${eqName(e)}`)});
  if($('#pAll'))$('#pAll').onclick=()=>eqPrintChoose(list,mon,'주간 출력 — 목록의 모든 장비');
};

/* 주간 점검표: 항목 × 월~토 표에서 칸을 눌러 ○ → × → - → 빈칸 */
