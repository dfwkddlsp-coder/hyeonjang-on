// 현장ON — A4 printing and printed documents (삼진아웃 확인서, 음주 통지서)
'use strict';
/* ---------- printing ---------- */
/* 각 장을 A4 한 장(인쇄 영역 190x277mm)에 맞게 자동 축소 */
async function printPages(pages){
  const P=$('#print');
  P.innerHTML=pages.map(p=>`<div class="pg${/class="doc eqw/.test(p)?' land':''}">${p}</div>`).join('');
  P.style.cssText='display:block;position:absolute;left:-10000px;top:0';
  await Promise.all($$('img',P).map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r})));
  /* 내용이 A4 상자보다 크면 그 장만 비율 축소 */
  $$('.pg',P).forEach(pg=>{const d=pg.firstElementChild;if(!d)return;d.style.zoom='';
    const availH=pg.clientHeight-12*96/25.4,h=d.scrollHeight;if(h>availH)d.style.zoom=(availH/h).toFixed(3)});
  P.style.cssText='';setTimeout(()=>window.print(),100);
}
const FORM_DEF={
  vTitle:'삼진아웃제 위반 적발 확인서',
  vPledge:'본인은 위 위반 사항을 확인하였으며, 삼진아웃제(1차 경고 · 2차 교육 · 3차 퇴출) 운영 기준에 따른 조치에 동의합니다. 향후 동일 사항이 재발하지 않도록 안전수칙을 준수하겠습니다.',
  aTitle:'음주 측정 결과 통지서',
  aIntro:'본 통지서는 당사 안전보건관리규정 및 현장 음주관리 기준에 의거하여 실시한 음주 측정 결과, 기준치를 초과한 근로자에 대한 조치 내용을 기록하고 본인에게 고지하였음을 확인하는 문서입니다.',
  aPledge:'본인은 위 측정 결과와 조치 내용을 확인하였으며, 아래 사항을 엄격히 준수할 것을 서약합니다.\n본인의 음주 상태를 인정하며, 현장의 작업 중단 및 퇴장 지시에 즉시 따르겠습니다.\n회사의 경고에 따라 직접 운전(귀가)하지 않을 것이며 이를 어기고 발생한 모든 사고의 책임은 본인에게 있음을 확인합니다.\n향후 재발 방지를 약속하며, 현장 영구 퇴출 등의 강화된 조치에 이의를 제기하지 않겠습니다.',
  aListTitle:'음주측정관리명부',
  cTitle:'건강검진 결과 및 사후상담일지',
  cPledge:'위의 건강검진 결과에 대해 안내 받았으며, 결과에 따른 현장 조치사항에 성실히 임할 것을 서약합니다.',
  eqTitle:'장비 전담관리자 일일점검표',
  psTitle:'사 진 대 지'
};
const FORM_FIELDS=[['vTitle','삼진아웃 확인서 — 제목',0],['vPledge','삼진아웃 확인서 — 확인 문구',1],['aTitle','음주 통지서 — 제목',0],['aIntro','음주 통지서 — 머리말',1],['aPledge','음주 통지서 — 근로자 서약 (줄바꿈 그대로 인쇄)',1],['aListTitle','음주측정관리명부 — 제목',0],['cTitle','사후상담일지 — 제목 (앞에 "OOOO년" 자동)',0],['cPledge','사후상담일지 — 서약 문구',1],['eqTitle','장비 점검표 — 제목',0],['psTitle','사진대지 — 제목',0]];
/* 양식 문구: 운영자가 설정 → 현장 기준 → 양식 문구에서 바꿈 (비우면 기본 문구) */
const FT=k=>h((S.forms&&String(S.forms[k]||'').trim())||FORM_DEF[k]);
const FN=k=>nl((S.forms&&String(S.forms[k]||'').trim())||FORM_DEF[k]);
function docViolation(v){
  const lv=S.levels[v.level-1];
  return `<div class="doc"><h1>${FT('vTitle')}</h1><div class="site">[ ${h(S.site||'현장명')} ]</div>
  <div class="sec">1. 위반자 인적사항</div>
  <table><tr><th>소속업체</th><td>${h(v.company)}</td><th>성명</th><td>${h(v.name)}</td></tr>
  <tr><th>직종</th><td colspan="3">${h(v.job)}</td></tr></table>
  <div class="sec">2. 적발 내용</div>
  <table><tr><th>적발일시</th><td>${fmtDT(v.at)}</td><th>적발장소</th><td>${h(v.place||'')}</td></tr>
  <tr><th>위반내용</th><td colspan="3">${h(v.type)}${v.detail?'<br>'+nl(v.detail):''}</td></tr>
  <tr><th>적발차수</th><td colspan="3"><span class="lv">${h(lv.name)} (${h(lv.sticker)} 스티커)</span>${v.level!==v.autoLevel?` <small>※ 누적기준 ${v.autoLevel}차 → 관리자 판단 ${v.level}차 적용</small>`:''}</td></tr>
  <tr><th>조치사항</th><td colspan="3">${nl(v.action)}</td></tr>
  ${v.level===2?`<tr><th>교육이수</th><td colspan="3">${v.edu&&v.edu.done?`이수 완료 ${fmtDT(v.edu.at)} (교육자: ${h(v.edu.by||'')})`:'□ 이수 &nbsp;&nbsp; 일시: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 교육자:'}</td></tr>`:''}
  </table>
  ${v.photos&&v.photos.length?`<div class="sec">3. 현장 사진</div><div>${v.photos.map(p=>`<img class="ph" src="${p}">`).join('')}</div>`:''}
  <div class="sec">${v.photos&&v.photos.length?4:3}. 확인</div>
  <div class="note">${FN('vPledge')}</div>
  <table><tr><th>위반자</th><td>${h(v.company)} &nbsp; ${h(v.name)}</td><td style="width:65mm;text-align:center">${v.violatorRefused?`서명 거부 (입회자: ${h(v.witness||'')})`:v.sigViolator?`<img class="sigimg" src="${v.sigViolator}">`:'(서명)'}</td></tr>
  <tr><th>점검자</th><td>${h(v.inspectorOrg||'')} &nbsp; ${h(v.inspector||'')}</td><td style="text-align:center">${v.sigInspector?`<img class="sigimg" src="${v.sigInspector}">`:'(서명)'}</td></tr></table>
  <p style="text-align:right;font-size:9pt">문서번호 ${h(v.id)} · 작성 ${fmtDT(v.created)}${v.void?` · <b>무효 처리: ${h(v.void.reason)}</b>`:''}</p></div>`;
}
function docAlcohol(a){
  const n=a.notice||{};const items=n.items||[];const ck=t=>items.includes(t)?'[ ✔ ]':'[&nbsp;&nbsp;&nbsp;&nbsp;]';const d=a.date.split('-');
  const label=k=>k==='ban'?`향후 현장 출입 제한 ( ${h(n.days)||'&nbsp;&nbsp;&nbsp;'} 일)`:k==='etc'?`기타 ( ${h(n.etc||'')} )`:NOTICE_ITEMS.find(x=>x[0]===k)[1];
  return `<div class="doc"><div class="site">[ ${h(S.site||'현장명')} ]</div><h1>${FT('aTitle')}</h1>
  <div class="note">${FN('aIntro')}</div>
  <div class="sec">1. 근로자 및 측정 인적사항</div>
  <table><tr><th>소속 업체명</th><td>${h(a.company)}</td><th>성명</th><td>${h(a.name)}</td></tr>
  <tr><th>직종</th><td>${h(a.job||'')}${a.equip?' / '+h(a.equip)+' '+h(a.plate||''):''}</td><th>측정 장소</th><td>${h(n.place||'')}</td></tr>
  <tr><th>측정 일시</th><td>${fmtDT(a.at)}</td><th>적발 횟수</th><td>${a.badNo?a.badNo+'회':''}${a.out?' (영구퇴출 대상)':''}</td></tr>
  <tr><th>측정 수치</th><td><b>${a.refused?'측정 거부':`혈중알코올농도: ( ${f3(a.value)} )%`}</b>${a.retestOf?'<br><small>(재측정 결과)</small>':''}</td><th>판정</th><td><b>${h(a.judge)}</b></td></tr></table>
  <div class="sec">2. 현장 음주관리 기준</div>
  <table>${alcCriteria().map((c,i)=>`<tr><td>${i+1}. ${h(c)}</td></tr>`).join('')}</table>
  <div class="sec">3. 조치 내용</div>
  <table>${NOTICE_ITEMS.map(([k])=>`<tr><td>${ck(k)} ${label(k)}</td></tr>`).join('')}</table>
  <div class="sec">4. 근로자 서약 및 확인</div>
  <div class="note">${FN('aPledge')}</div>
  <p style="text-align:center;margin:4mm 0">${d[0]}년 ${+d[1]}월 ${+d[2]}일</p>
  <table><tr><th>근로자</th><td>${h(a.company)} &nbsp; ${h(a.name)}</td><td style="width:65mm;text-align:center">${n.refusedSign?`서명 거부 (입회자: ${h(n.witness||'')})`:n.sigW?`<img class="sigimg" src="${n.sigW}">`:'( 서명 또는 인 )'}</td></tr>
  <tr><th>측정자</th><td>${h(S.inspectorOrg||'')} &nbsp; ${h(a.measurer)}</td><td style="text-align:center">${n.sigM?`<img class="sigimg" src="${n.sigM}">`:'(인)'}</td></tr></table>
  <p style="text-align:right;font-size:9pt">문서번호 ${h(a.id)}${a.void?` · <b>무효 처리: ${h(a.void.reason)}</b>`:''}</p></div>`;
}
function docAlcoholList(ds){
  const aoa=alcSheetAoa(ds);const rows=aoa.slice(3);
  return `<div class="doc list"><h1>${FT('aListTitle')}</h1><table style="border:0"><tr><td style="border:0;text-align:left">현장명 : ${h(S.site)}</td><td style="border:0;text-align:right">${aoa[1][9]}</td></tr></table>
  <table><tr>${aoa[2].map(x=>`<th>${x}</th>`).join('')}</tr>${rows.map(r=>`<tr>${Array.from({length:10},(_,i)=>`<td>${h(r[i]??'')}</td>`).join('')}</tr>`).join('')}</table></div>`;
}
