// 현장ON — 장비 점검: 출력 (주간 점검표 · 사진대지)
'use strict';
/* 장비 1대 출력 묶음: 주간 점검표 + 사진대지 */
/* 출력: which = 'both'(함께) · 'mgr'(관리자 점검만) · 'drv'(운전원 점검만). 있는 것만 나옴
   함께일 때 순서: 관리자 점검표 → 운전원 점검표 → 관리자 사진대지 → 운전원 사진대지 */
function eqPrintPages(e,mon,which='both'){const pages=[],days=weekDays(mon),trs=which==='both'?['mgr','drv']:[which];
  for(const tr of trs)if(days.some(d=>eqDayMark(e.id,d,tr)))pages.push(docEqWeek(e,mon,tr));
  for(const tr of trs){const bl=eqPhotoBlocks([e],mon,tr);if(bl.length)pages.push(...docPhotoSheet(bl))}
  return pages}
/* 출력 버튼: 함께 / 관리자만 / 운전원만 고르기 (쪽수 표시, 없는 쪽은 못 누름) */
function eqPrintChoose(list,mon,title){
  const opt=[['both','관리자 + 운전원 함께'],['mgr','관리자 점검만'],['drv','운전원 점검만']].map(([k,t])=>({k,t,pg:list.flatMap(e=>eqPrintPages(e,mon,k))}));
  if(!opt[0].pg.length)return toast('이번 주 점검표·사진이 없습니다');
  openModal(title,`<div class="small muted" style="margin-bottom:10px">${weekLabel(mon)} · 장비 ${list.length}대</div>${opt.map(o=>`<button class="btn ${o.k==='both'?'':'line'}" data-pk="${o.k}" style="width:100%;margin-bottom:8px" ${o.pg.length?'':'disabled'}><i class="i i-print"></i> ${o.t} <span class="small" style="opacity:.7">(${o.pg.length}쪽)</span></button>`).join('')}`,b=>{
    $$('[data-pk]',b).forEach(x=>x.onclick=()=>{const o=opt.find(y=>y.k===x.dataset.pk);closeModal();printPages(o.pg)})});
}

function docEqWeek(e,mon,tr='mgr'){const drvT=tr==='drv';
  const days=weekDays(mon),w=eqWeekRec(e.id,mon,tr),legacy=days.map(d=>drvT?null:eqLegacyDay(e.id,d));
  const its=eqWeekItems(e,w),titles=its.map(i=>i.t);
  const val=(t,i)=>{const v=w&&w.marks&&w.marks[t]?w.marks[t][i]:'';if(v)return v;const c=legacy[i];const it=c&&c.items.find(x=>x.t===t);return it?it.v:''};
  const sym=v=>v==='X'?'<b>×</b>':MARK_SYM[v]||'';
  const note=t=>{const n=[];if(w&&w.notes&&w.notes[t])n.push(h(w.notes[t]));legacy.forEach((c,i)=>{const it=c&&c.items.find(x=>x.t===t);if(it&&it.note)n.push(`${WD6[i]}: ${h(it.note)}`)});return n.join('<br>')};
  const sigSrc=w&&w.sig||(legacy.find(c=>c&&c.sig)||{}).sig;
  const remarks=[w&&w.remark?h(w.remark):'',...legacy.map((c,i)=>c&&c.remark?`${WD6[i]} ${h(c.remark)}`:'')].filter(Boolean);
  const done=eqWeekComplete(e.id,mon,tr);
  const memo=[...titles.map((t,r)=>{const n=note(t);return n?`<div><b>${r+1}. ${h(t)}</b> — ${n}</div>`:''}).filter(Boolean),...remarks.map(x=>`<div>${x}</div>`)];
  const rowH=Math.max(7,Math.min(20,Math.floor(129/Math.max(titles.length,1))));
  return `<div class="doc eqw">${done?stampHtml('doc'):''}<h1>${drvT?(FT('eqTitle').includes('전담관리자')?FT('eqTitle').replace('전담관리자','운전원'):FT('eqTitle')+' (운전원 점검)'):FT('eqTitle')}</h1>
  <div class="eqf"><div><span>■ 소속협력사 :</span><u>${h(e.company||'')}</u></div>
    <div><span>■ 장비종류 :</span><u>${h(e.type||'')}${eqFormOf(e)?` (${h(w&&w.form||eqFormName(e))} 양식)`:''}</u><span style="margin-left:6mm">■ 장비번호 :</span><u>${h(e.plate||'')}</u><span class="wl">${weekLabel(mon)}</span></div>
    <div><span>■ ${drvT?'운전원':'장비 전담관리자'} :</span><u>${h(w&&w.inspector||(drvT?e.operator:e.manager)||'')}</u><span class="sg">(서명)${sigSrc?`<img src="${sigSrc}">`:''}</span></div></div>
  <table class="grid6"><colgroup><col style="width:46%">${days.map(()=>'<col style="width:9%">').join('')}</colgroup>
  <tr><th class="it">점 검 항 목</th>${days.map((d,i)=>`<th>${WD6[i]}<br>( ${md(d)} )</th>`).join('')}</tr>
  ${titles.map((t,r)=>`<tr style="height:${rowH}mm"><td class="it">${r+1}. ${h(t)}${its[r].d?`<div class="md">${h(its[r].d)}</div>`:''}</td>${days.map((d,i)=>`<td class="mk">${sym(val(t,i))}</td>`).join('')}</tr>`).join('')}
  <tr class="memo"><th class="it">비 고</th><td colspan="6" class="rm">${memo.join('')}</td></tr>
  </table>
  <div class="eqfoot"><span>○ 적합 · × 부적합 · - 해당없음 · △ 기타의견 (부적합·기타의견은 비고에 내용)</span><span>${h(S.site||'')}</span></div></div>`;
}

/* 사진대지: 장비별 주간 사진을 4장씩 한 건으로 (사진마다 항목명 표시) */
function eqPhotoBlocks(list,mon,tr='mgr'){const drvT=tr==='drv';
  const out=[],label=weekLabel(mon),days=weekDays(mon);
  for(const e of list){
    const wp=eqWeekPhoto(e.id,mon,tr);
    const order=eqSlots(e).map(s=>s.t);
    const ph=[...((wp&&wp.photos)||[]).slice().sort((a,b)=>order.indexOf(a.slot)-order.indexOf(b.slot)),
      ...(drvT?[]:EC).filter(c=>!c.kind&&c.equipId===e.id&&!c.void&&c.date>=days[0]&&c.date<=days[5]).flatMap(c=>(c.photos||[]))];
    for(let i=0;i<ph.length;i+=4){const g=ph.slice(i,i+4);out.push({date:label,content:eqName(e)+(drvT?' · 운전원 점검':''),photos:g.map(p=>({src:p.src,cap:p.cap||p.slot||''}))})}
  }
  return out;
}
/* 사진대지 한 장 = 2칸 (위·아래). 칸은 사진 4장(+일시·내용 1개) 또는 single:true면 사진 1장 크게 */
function docPhotoSheet(blocks){
  const cell=p=>p?`<td colspan="2" class="pc"><div class="pw"><img src="${p.src}">${p.cap?`<span class="pcap">${h(p.cap)}</span>`:''}</div></td>`:'<td colspan="2" class="pc"></td>';
  const one=b=>`<table class="pst"><colgroup><col style="width:9%"><col style="width:41%"><col style="width:9%"><col style="width:41%"></colgroup>
    <tr><td colspan="4" class="pc" style="height:106mm"><div class="pw" style="height:106mm"><img src="${b.photos[0].src}" style="object-fit:contain"></div></td></tr>
    <tr class="cap"><th>일 시</th><td>${h(b.date)}</td><th>내 용</th><td>${nl(b.content)}</td></tr></table>`;
  const block=b=>{if(b.single)return one(b);const ph=b.photos;return `<table class="pst"><colgroup><col style="width:9%"><col style="width:41%"><col style="width:9%"><col style="width:41%"></colgroup>
    <tr>${cell(ph[0])}${cell(ph[1])}</tr><tr>${cell(ph[2])}${cell(ph[3])}</tr>
    <tr class="cap"><th>일 시</th><td>${h(b.date)}</td><th>내 용</th><td>${h(b.content)}</td></tr></table>`};
  const pages=[];
  for(let i=0;i<blocks.length;i+=2){
    const two=blocks.slice(i,i+2);
    pages.push(`<div class="doc psheet"><h1>${FT('psTitle')}</h1><div class="pl">현장명 : ${h(S.site||'')}</div>
    ${two.map(block).join('')}${two.length===1?'<table class="pst"><tr><td class="pempty">이하 여백</td></tr></table>':''}</div>`);
  }
  return pages;
}
