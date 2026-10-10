// 현장ON — home screen and shared list items
'use strict';
R.home=()=>{
  const t=today();const vt=V.filter(v=>v.date===t&&!v.void);const at=A.filter(a=>a.date===t&&!a.void&&!a.retestOf);const atBad=at.filter(a=>isAlcBad(alcFinal(a)));
  const pend=A.filter(a=>!a.void&&a.judge==='재측정'&&!retestChild(a));
  const banned=new Set(V.filter(v=>!v.void&&v.level===3).map(v=>v.pkey));W.filter(w=>w.banned).forEach(w=>banned.add(pkey(w.name,w.company)));A.filter(a=>a.out&&!a.void).forEach(a=>banned.add(a.pkey));
  const eduPend=V.filter(v=>!v.void&&v.level===2&&!(v.edu&&v.edu.done));
  const noNotice=A.filter(a=>!a.void&&isAlcBad(a)&&!a.notice);
  const vuAct=VU.filter(p=>!p.retired);const vuNo=vuAct.filter(p=>!(p.consults||[]).length);
  const expE=E.filter(e=>!e.outDate&&(['bad','warn'].includes(expState(e.inspect))||['bad','warn'].includes(expState(e.insurance))));
  const d=new Date();const ds=`${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())} (${WD[d.getDay()]})`;
  const tile=(n,view,nm,en,side,stat,ml,dark,wide)=>`<button class="tile${dark?' dark':''}${wide?' wide':''}" data-go="${view}"><span class="tic"><i class="i i-${view}"></i></span>
    <div><div class="nm">${nm}</div><div class="en">${en}</div></div>
    <div class="meta">${stat===null?'':`<span class="dotr${stat?'':' zero'}">${stat}</span>`}<div class="ml">${ml}</div></div></button>`;
  V$().innerHTML=`<div class="hm-head"><div><div class="hm-kicker">${ds} · 현장 안전관리 · field safety board</div><h1 class="hm-title">현장ON.</h1><p class="hm-motto">습관이 된 노력을 실력이라 한다.</p></div>
   <div class="hm-site"><b>${h(S.site||'현장명 미설정')}</b><br>${h([S.inspectorOrg,S.inspector].filter(Boolean).join(' ')||'점검자 미설정')}</div></div>
  ${!S.site||!S.inspector?`<div class="hint" style="margin-bottom:16px"><a href="#" id="toSet">설정</a>에서 ${!S.inspector?'<b>내 정보</b>(이름·서명)':''}${!S.site&&!S.inspector?'와 ':''}${!S.site?'현장명':''}을 등록하세요. 점검자 이름·서명이 자동으로 들어갑니다.</div>`:''}
  <div class="hm-grid">
   ${(()=>{const iu=eqTargets(),dn=iu.filter(e=>eqCheckOf(e.id,today())).length,mt=iu.filter(e=>isMine(e)&&!eqCheckOf(e.id,today())).length;return tile(1,'eqcheck','장비점검','daily inspection','',iu.length-dn,`오늘 점검 <b>${dn}</b>/${iu.length}대<br>${mt?`내 담당 미점검 <b>${mt}</b>`:'사진대지 · 주간 점검표'}`,true,true)})()}
   ${tile(2,'strike','삼진아웃','three strikes out','warning · education · exit',vt.length,`오늘 적발 <b>${vt.length}</b>건<br>퇴출 <b>${banned.size}</b> · 교육 미이수 <b>${eduPend.length}</b>`)}
   ${tile(3,'alcohol','음주측정','alcohol check','breath test',atBad.length,`오늘 측정 <b>${at.length}</b>명 · 적발 <b>${atBad.length}</b><br>${noNotice.length?`통지서 미작성 <b>${noNotice.length}</b>`:'통지서 모두 작성됨'}`)}
   ${tile(4,'workers','근로자','worker register','people',null,`등록 <b>${W.length}</b>명<br>업체 <b>${new Set(W.map(w=>w.company)).size}</b>곳`)}
   ${tile(5,'equip','장비','equipment register','machines',expE.length,`등록 <b>${E.length}</b>대<br>서류 만료·임박 <b>${expE.length}</b>`)}
   ${vulnVisible()?tile(6,'vuln','취약근로자','vulnerable workers','health care',vuNo.length,`관리 <b>${vuAct.length}</b>명 · 고혈압 <b>${vuAct.filter(p=>vulnTags(p).includes('고혈압')).length}</b><br>사후상담 미실시 <b>${vuNo.length}</b>`):tile(6,'vuln','취약근로자','vulnerable workers','health care',null,`건강정보 보호를 위해<br><b>운영자·관리자만</b> 열람`)}
   ${docCats().filter(catVisible).map((c,i)=>{const ty=catType(c);const pl=ty==='pdf'?plansSorted(c.k):recsOf(c.k);return tile(7+i,'plans',h(c.name),'documents',ty,null,pl.length?`등록 <b>${pl.length}</b>건<br>${ty==='pdf'?h(pl[0].title):'최근 '+h(pl[0].date||weekLabel(pl[0].week))}`:`${CAT_TYPES[ty]}<br>등록된 기록 없음`).replace('data-go="plans"',`data-go="plans" data-arg="${h(c.k)}" data-hl="d_${h(c.k)}"`)}).join('')}
  </div>
  ${noNotice.length?`<div class="hm-sec"><h2>통지서 미작성</h2><span>alcohol notice</span></div><div class="card list">${noNotice.map(alcItem).join('')}</div>`:''}
  ${pend.length?`<div class="hm-sec"><h2>재측정 대기</h2><span>retest</span></div><div class="card list">${pend.map(alcItem).join('')}</div>`:''}
  ${eduPend.length?`<div class="hm-sec"><h2>교육 미이수</h2><span>2nd strike</span></div><div class="card list">${eduPend.map(vItem).join('')}</div>`:''}
  ${expE.length?`<div class="hm-sec"><h2>장비 서류</h2><span>expiring</span></div><div class="card list">${expE.slice(0,10).map(eqItem).join('')}</div>`:''}
  <div class="hm-sec"><h2>today.</h2><span>오늘 삼진아웃 적발</span></div><div class="card list">${vt.length?vt.sort((a,b)=>b.at.localeCompare(a.at)).map(vItem).join(''):'<div class="empty">오늘 적발 기록 없음</div>'}</div>`;
  applyHomeLayout();
  $$('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go,b.dataset.arg));const ts=$('#toSet');if(ts)ts.onclick=e=>{e.preventDefault();go('settings',!S.inspector?'me':'site')};
  bindItems();
};
function vItem(v){return `<div class="it" data-vid="${v.id}">${lvDot(v.level)}<div class="m"><b>${h(v.name)}</b> <span class="muted">${h(v.company)}</span>${v.void?' <span class="badge bgray">무효</span>':''}${v.level===2?(v.edu&&v.edu.done?' <span class="badge bok">교육이수</span>':' <span class="badge bwarn">교육 미이수</span>'):''}${v.level===3?' <span class="badge b3">퇴출</span>':''}<div class="small muted ell">${fmtDT(v.at)} · ${h(v.type)}${v.place?' · '+h(v.place):''}</div></div></div>`}
function alcItem(a){const due=new Date(a.at);due.setMinutes(due.getMinutes()+10);return `<div class="it" data-aid="${a.id}"><span class="badge ${judgeCls(a.judge)}">${a.judge}</span><div class="m"><b>${h(a.name)}</b> <span class="muted">${h(a.company)}</span><div class="small muted">${fmtDT(a.at)} · ${a.refused?'측정거부':a.value.toFixed(3)+'%'}${a.judge==='재측정'&&!retestChild(a)?` · ${pad(due.getHours())}:${pad(due.getMinutes())} 이후 재측정`:''}${a.out?' · <b style="color:var(--bad)">영구퇴출</b>':''}${isAlcBad(a)&&!a.void?(a.notice?' · 통지서 완료':' · <b style="color:var(--bad)">통지서 미작성</b>'):''}</div></div></div>`}
function eqItem(e){return `<div class="it" data-eid="${e.id}"><span class="dot d0"><i class="i i-truck"></i></span><div class="m"><b>${h(e.type||'')}</b> <span class="muted">${h(e.plate||'')}</span><div class="small muted ell">${h(e.company||'')} · 운전원 ${h(e.operator||'')} · 검사 ${expCell(e.inspect)||'-'} · 보험 ${expCell(e.insurance)||'-'}</div></div></div>`}
function bindItems(root=V$()){
  $$('[data-vid]',root).forEach(el=>el.onclick=()=>showViolation(el.dataset.vid));
  $$('[data-aid]',root).forEach(el=>el.onclick=()=>showAlcohol(el.dataset.aid));
  $$('[data-eid]',root).forEach(el=>el.onclick=()=>showEquip(el.dataset.eid));
  $$('[data-wid]',root).forEach(el=>el.onclick=()=>showWorker(el.dataset.wid));
  $$('[data-uid]',root).forEach(el=>el.onclick=()=>showVuln(el.dataset.uid));
}

/* --- 삼진아웃 --- */
