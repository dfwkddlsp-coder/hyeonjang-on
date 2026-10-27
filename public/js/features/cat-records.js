// 현장ON — 카테고리 기록 (사진대지·점검표·작성 양식): 목록·보기·작성·출력·엑셀
'use strict';
R.recs=C=>{
  const t=catType(C),wk=t==='check'&&C.mode==='week';
  if(wk){R.recs.w=R.recs.w||weekMon(today())}else{R.recs.m=R.recs.m||today().slice(0,7)}
  const key=wk?R.recs.w:R.recs.m;
  const list=recsOf(C.k).filter(r=>wk?r.week===key:String(r.date||'').startsWith(key));
  V$().innerHTML=`<h1>${h(C.name)}</h1><div class="small muted" style="margin:-6px 0 10px">${CAT_TYPES[t]}${t==='check'?(wk?' · 주간(월~토)':' · 건별'):t==='photo'?' · 작성할 때 한 칸에 4장 / 1장 선택':''}${C.scope==='staff'?' · 운영자·관리자만':''}</div>
   ${canWriteCat(C)?`<button class="btn xl" id="rcNew" style="width:100%;margin-bottom:10px"><i class="i i-plus"></i> ${wk?'이번 주 점검표 작성':'새로 작성'}</button>`:''}
   <div class="row" style="margin-bottom:10px">${wk?`<button class="btn sm line" id="rcPrev">◀</button><div class="grow" style="text-align:center"><b>${weekLabel(key)}</b><div class="small muted">${md(key)} ~ ${md(addDays(key,5))}</div></div><button class="btn sm line" id="rcNext">▶</button>`
     :`<input class="inp" type="month" id="rcMonth" value="${key}" style="max-width:180px"><span class="grow"></span>`}</div>
   ${list.length?`<div class="grid g2" style="margin-bottom:10px"><button class="btn line" id="rcPrint"><i class="i i-print"></i> ${wk?'이 주':'이 달'} 전체 출력</button>${t!=='photo'?`<button class="btn line" id="rcXls"><i class="i i-save"></i> 엑셀로 받기</button>`:'<span></span>'}</div>`:''}
   <div class="card list">${list.map(r=>`<div class="it" data-rc="${h(r.id)}"><span class="dot d0"><i class="i i-${t==='photo'?'camera':t==='check'?'eqcheck':'pen'}"></i></span><div class="m"><b>${h(recTitle(C,r))}</b><div class="small muted ell">${h(wk?weekLabel(r.week):r.date||'')} · ${h(r.by||'')}${t==='check'&&!wk?` · 부적합 ${Object.values(r.marks||{}).filter(v=>v==='X').length}`:''}</div></div></div>`).join('')||'<div class="empty">기록이 없습니다</div>'}</div>`;
  if($('#rcNew'))$('#rcNew').onclick=()=>recEdit(C,null);
  if(wk){$('#rcPrev').onclick=()=>{R.recs.w=addDays(key,-7);R.recs(C)};$('#rcNext').onclick=()=>{R.recs.w=addDays(key,7);R.recs(C)}}
  else $('#rcMonth').onchange=e=>{R.recs.m=e.target.value||today().slice(0,7);R.recs(C)};
  if($('#rcPrint'))$('#rcPrint').onclick=()=>printPages(recPages(C,list.slice().reverse()));
  if($('#rcXls'))$('#rcXls').onclick=()=>recXls(C,list.slice().reverse(),key);
  $$('[data-rc]').forEach(el=>el.onclick=()=>recView(C,RC.find(r=>r.id===el.dataset.rc)));
};
function recTitle(C,r){const t=catType(C);if(t==='photo')return (r.content||((r.photos||[])[0]||{}).cap||'(내용 없음)')+` · 사진 ${(r.photos||[]).length}장 · ${recLayout(r)==='1'?'1장씩':'4장씩'}`;if(t==='check')return r.place||'(장소 미입력)';
  const f=(C.fields||[]).find(f=>['text','sel','num','date'].includes(f.t)&&r.v&&r.v[f.id]);return f?`${f.l}: ${r.v[f.id]}`:(r.date||'')}

function recView(C,r){if(!r)return;
  openModal(C.name,`<div style="overflow:auto;background:#fff;border-radius:10px;padding:8px;border:1px solid var(--line)"><div style="zoom:.55">${recPages(C,[r]).join('<hr>')}</div></div>
    <div class="grid g2" style="margin-top:12px"><button class="btn" id="rvPrint"><i class="i i-print"></i> 인쇄</button>${canEditRec(r)?'<button class="btn line" id="rvEdit">수정</button>':'<span></span>'}</div>
    ${canEditRec(r)?'<button class="btn line" id="rvDel" style="width:100%;margin-top:8px;color:var(--bad)">삭제</button>':''}`,b=>{
    $('#rvPrint',b).onclick=()=>printPages(recPages(C,[r]));
    if($('#rvEdit',b))$('#rvEdit',b).onclick=()=>recEdit(C,r);
    if($('#rvDel',b))$('#rvDel',b).onclick=async()=>{if(!confirm('이 기록을 삭제할까요?'))return;try{await remove('records',r.id);closeModal();R.recs(C)}catch(x){toast(x.message)}}})}

function recEdit(C,prev){
  const t=catType(C),wk=t==='check'&&C.mode==='week',items=catItems(C),r=prev?JSON.parse(JSON.stringify(prev)):{};
  let body='',getPhotos=null,pads={},mainPad=null;
  if(t==='photo'){
    body=`<label class="f">사진대지 형식</label><div class="seg" id="reL" style="margin:0 0 4px">
        <button type="button" data-lay="4" class="${recLayout(r)==='4'?'on':''}">한 칸에 4장씩</button><button type="button" data-lay="1" class="${recLayout(r)==='1'?'on':''}">한 칸에 1장씩</button></div>
      <div class="small muted" id="reLh"></div>
      <div class="grid g2"><div><label class="f">일시</label><input class="inp" type="date" id="reD" value="${h(r.date||today())}"></div><div></div></div>
      <label class="f" id="reCl"></label><input class="inp" id="reC" value="${h(r.content||'')}" placeholder="예) A동 3층 안전난간 설치 상태">
      <label class="f">사진 — 갤러리에서 여러 장을 한 번에 고르면 차례로 들어갑니다</label><div id="rePh"></div>`;
  }else if(t==='check'){
    if(!items.length){toast('운영자가 설정에서 점검 항목을 먼저 등록해야 합니다');return}
    const days=wk?weekDays(r.week||weekMon(today())):[];
    body=`<div class="grid g2">${wk?`<div><label class="f">주간</label><input class="inp" value="${h(weekLabel(r.week||weekMon(today())))}" disabled></div>`:`<div><label class="f">점검일</label><input class="inp" type="date" id="reD" value="${h(r.date||today())}"></div>`}
      <div><label class="f">점검 장소 · 대상 *</label><input class="inp" id="reP" value="${h(r.place||'')}" placeholder="예) A동 외부비계"></div></div>
      <div class="small muted" style="margin:8px 0 4px">${wk?'칸을 누를 때마다 ○ 적합 → × 부적합 → - 해당없음 → 빈칸':'항목마다 결과를 고르세요'}</div>
      ${wk?`<div style="overflow:auto"><table class="t" style="min-width:520px"><tr><th style="text-align:left">점검 항목</th>${days.map((d,i)=>`<th>${WD6[i]}<br><span class="small">${md(d)}</span></th>`).join('')}</tr>
        ${items.map((it,i)=>`<tr><td style="font-size:13px">${i+1}. ${h(it)}</td>${days.map((d,j)=>{const v=(r.marks||{})[i+'|'+j]||'';return `<td style="text-align:center"><button type="button" class="btn sm ${v?'':'line'}" data-wm="${i}|${j}" style="min-width:40px">${CK_SYM[v]||'&nbsp;'}</button></td>`}).join('')}</tr>`).join('')}</table></div>`
      :items.map((it,i)=>{const v=(r.marks||{})[i]||'';return `<div style="padding:8px 0;border-top:1px solid var(--line)"><div style="font-size:14px;margin-bottom:6px">${i+1}. ${h(it)}</div>
        <div class="row" style="gap:6px">${['O','X','N'].map(k=>`<button type="button" class="btn sm ${v===k?'':'line'}" data-cm="${i}" data-cv="${k}" style="min-width:64px">${CK_SYM[k]} ${{O:'적합',X:'부적합',N:'해당없음'}[k]}</button>`).join('')}
        <input class="inp grow" data-cn="${i}" value="${h((r.notes||{})[i]||'')}" placeholder="비고" style="min-width:80px;padding:6px 8px"></div></div>`}).join('')}
      <label class="f">비고 · 조치사항</label><textarea class="inp" id="reR" rows="2">${h(r.remark||'')}</textarea>
      <label class="f">점검자 서명</label><div id="reSig"></div>`;
  }else{
    const fs_=C.fields||[];if(!fs_.length){toast('운영자가 설정에서 양식 항목을 먼저 만들어야 합니다');return}
    body=`<label class="f">작성일</label><input class="inp" type="date" id="reD" value="${h(r.date||today())}" style="max-width:200px">`+fs_.map(f=>{const v=(r.v||{})[f.id];const L=`<label class="f">${h(f.l)}${f.req?' *':''}</label>`;
      switch(f.t){case 'area':return L+`<textarea class="inp" data-fv="${f.id}" rows="3">${h(v||'')}</textarea>`;
        case 'num':return L+`<input class="inp" type="number" inputmode="decimal" data-fv="${f.id}" value="${h(v??'')}">`;
        case 'date':return L+`<input class="inp" type="date" data-fv="${f.id}" value="${h(v||'')}">`;
        case 'sel':return L+`<select class="inp" data-fv="${f.id}"><option value=""></option>${String(f.o||'').split(',').map(x=>x.trim()).filter(Boolean).map(o=>`<option ${o===v?'selected':''}>${h(o)}</option>`).join('')}</select>`;
        case 'chk':return `<label class="row" style="margin-top:12px;gap:8px"><input type="checkbox" data-fv="${f.id}" ${v?'checked':''} style="width:22px;height:22px"> ${h(f.l)}</label>`;
        case 'photo':return L+`<div data-fp="${f.id}"></div>`;
        case 'sig':return L+`<div data-fs="${f.id}"></div>`;
        default:return L+`<input class="inp" data-fv="${f.id}" value="${h(v||'')}">`}}).join('');
  }
  openModal((prev?'수정 — ':'')+C.name,body+`<button class="btn xl" id="reSave" style="width:100%;margin-top:14px">저장</button>`,b=>{
    if(t==='photo'){let lay=recLayout(r),photos=(r.photos||[]).slice();
      const mount=()=>{const one=lay==='1';
        $$('[data-lay]',b).forEach(x=>x.classList.toggle('on',x.dataset.lay===lay));
        $('#reLh',b).textContent=one?'칸마다 사진 1장을 크게 — 사진마다 내용을 적습니다. 한 장에 위·아래 2칸 (사진 3장이면 2장).':'칸마다 사진 4장과 일시·내용 1개 — 지금 쓰는 사진대지 형식. 한 장에 2칸.';
        $('#reCl',b).textContent=one?'공통 내용 (선택 — 사진 내용이 비어 있으면 이 내용이 들어감)':'내용 *';
        getPhotos=photoInputs($('#rePh',b),photos,60,one?{cap:'이 사진의 내용',area:true}:{cap:'사진 설명 (선택)'})};
      $$('[data-lay]',b).forEach(x=>x.onclick=()=>{photos=getPhotos();lay=x.dataset.lay;r.layout=lay;mount()});
      mount()}
    if(t==='check'){
      r.marks=r.marks||{};
      $$('[data-cm]',b).forEach(x=>x.onclick=()=>{const i=x.dataset.cm;r.marks[i]=r.marks[i]===x.dataset.cv?'':x.dataset.cv;$$(`[data-cm="${i}"]`,b).forEach(y=>y.classList.toggle('line',r.marks[i]!==y.dataset.cv))});
      $$('[data-wm]',b).forEach(x=>x.onclick=()=>{const k=x.dataset.wm,nx={'':'O',O:'X',X:'N',N:''}[r.marks[k]||''];r.marks[k]=nx;x.innerHTML=CK_SYM[nx]||'&nbsp;';x.classList.toggle('line',!nx)});
      mainPad=sigPad($('#reSig',b),'점검자 서명',r.sig||S.mySig);
    }
    if(t==='form'){const ph={};
      $$('[data-fp]',b).forEach(x=>{const id=x.dataset.fp;ph[id]=photoInputs(x,[((r.v||{})[id])].filter(Boolean),1)});
      $$('[data-fs]',b).forEach(x=>{pads[x.dataset.fs]=sigPad(x,'서명',(r.v||{})[x.dataset.fs]||'')});getPhotos=ph}
    $('#reSave',b).onclick=async()=>{
      const o={...r,id:r.id||uid(),cat:C.k,scope:C.scope==='staff'?'staff':'all',type:t,at:r.at||nowLocal(),by:r.by||S.inspector||(ME&&ME.name)||'',byId:r.byId||(ME&&ME.id)||''};
      if(t==='photo'){o.date=$('#reD',b).value||today();o.content=$('#reC',b).value.trim();o.photos=getPhotos();o.layout=recLayout(r);if(!o.content&&o.layout!=='1')return toast('내용을 입력하세요');if(!o.photos.length)return toast('사진을 1장 이상 넣으세요')}
      if(t==='check'){o.place=$('#reP',b).value.trim();if(!o.place)return toast('점검 장소·대상을 입력하세요');
        if(wk){o.week=r.week||weekMon(today())}else{o.date=$('#reD',b).value||today();o.notes={};$$('[data-cn]',b).forEach(x=>{if(x.value.trim())o.notes[x.dataset.cn]=x.value.trim()})}
        o.remark=$('#reR',b).value.trim();o.items=items;o.sig=mainPad.isEmpty()?'':mainPad.data();o.inspector=S.inspector||(ME&&ME.name)||''}
      if(t==='form'){o.date=$('#reD',b).value||today();o.v={};o.fields=(C.fields||[]).map(f=>({id:f.id,l:f.l,t:f.t}));
        $$('[data-fv]',b).forEach(x=>{o.v[x.dataset.fv]=x.type==='checkbox'?x.checked:x.value.trim()});
        for(const [id,g] of Object.entries(getPhotos||{})){const p=g()[0];o.v[id]=p||''}
        for(const [id,p] of Object.entries(pads))o.v[id]=p.isEmpty()?'':p.data();
        const miss=(C.fields||[]).find(f=>f.req&&!o.v[f.id]);if(miss)return toast(miss.l+' 항목을 입력하세요')}
      o.updated=nowLocal();
      try{await save('records',o);closeModal();toast('저장했습니다');R.recs(C)}catch(x){toast(x.message)}};
  })}

function recPages(C,list){
  const t=catType(C);
  if(t==='photo'){
    return docPhotoSheet(list.flatMap(r=>{const ph=r.photos||[],d=fmtDT(r.date);
      if(recLayout(r)==='1')return ph.map(p=>({single:true,date:d,content:p.cap||r.content||'',photos:[p]}));
      const out=[];for(let i=0;i<ph.length;i+=4)out.push({date:d,content:r.content||'',photos:ph.slice(i,i+4)});return out}))}
  return list.map(r=>{
    const head=`<div class="doc"><h1>${h(C.name)}</h1><div class="site">[ ${h(S.site||'현장명')} ]</div>`;
    if(t==='check'){const its=r.items||catItems(C);
      if(r.week){const days=weekDays(r.week);
        return head+`<table><tr><th>주간</th><td>${h(weekLabel(r.week))} (${md(days[0])}~${md(days[5])})</td><th>장소·대상</th><td>${h(r.place||'')}</td></tr></table>
        <table><tr><th style="width:8mm">No</th><th style="width:auto">점검 항목</th>${days.map((d,i)=>`<th style="width:13mm">${WD6[i]}<br>${md(d)}</th>`).join('')}</tr>
        ${its.map((it,i)=>`<tr><td style="text-align:center">${i+1}</td><td>${h(it)}</td>${days.map((d,j)=>`<td style="text-align:center;font-size:13pt">${CK_SYM[(r.marks||{})[i+'|'+j]]||''}</td>`).join('')}</tr>`).join('')}</table>
        <table><tr><th>비고</th><td style="height:14mm">${nl(r.remark||'')}</td></tr><tr><th>점검자</th><td>${h(r.inspector||r.by||'')} &nbsp; ${r.sig?`<img class="sigimg" src="${r.sig}">`:'(서명)'}</td></tr></table>
        <p style="font-size:9pt">○ 적합 · × 부적합 · - 해당없음</p></div>`}
      return head+`<table><tr><th>점검일</th><td>${h(r.date||'')}</td><th>장소·대상</th><td>${h(r.place||'')}</td></tr></table>
        <table><tr><th style="width:8mm">No</th><th style="width:auto">점검 항목</th><th style="width:18mm">결과</th><th style="width:45mm">비고</th></tr>
        ${its.map((it,i)=>`<tr><td style="text-align:center">${i+1}</td><td>${h(it)}</td><td style="text-align:center;font-size:13pt">${CK_SYM[(r.marks||{})[i]]||''}</td><td>${h((r.notes||{})[i]||'')}</td></tr>`).join('')}</table>
        <table><tr><th>비고·조치</th><td style="height:16mm">${nl(r.remark||'')}</td></tr><tr><th>점검자</th><td>${h(r.inspector||r.by||'')} &nbsp; ${r.sig?`<img class="sigimg" src="${r.sig}">`:'(서명)'}</td></tr></table>
        <p style="font-size:9pt">○ 적합 · × 부적합 · - 해당없음</p></div>`}
    const fl=r.fields||C.fields||[],v=r.v||{};
    const rows=fl.filter(f=>!['photo','sig'].includes(f.t)).map(f=>`<tr><th style="width:38mm;white-space:normal">${h(f.l)}</th><td>${f.t==='chk'?(v[f.id]?'☑ 예':'☐ 아니오'):f.t==='area'?nl(v[f.id]||''):h(v[f.id]??'')}</td></tr>`).join('');
    const phs=fl.filter(f=>f.t==='photo'&&v[f.id]&&v[f.id].src);
    const sigs=fl.filter(f=>f.t==='sig');
    return head+`<table><tr><th style="width:38mm">작성일</th><td>${h(r.date||'')}</td></tr>${rows}<tr><th style="width:38mm">작성자</th><td>${h(r.by||'')}</td></tr></table>
      ${phs.length?`<table><tr>${phs.map(f=>`<td style="text-align:center;width:${100/Math.min(phs.length,2)}%"><img src="${v[f.id].src}" style="max-width:100%;max-height:70mm"><div style="font-size:9pt">${h(f.l)}${v[f.id].cap?' — '+h(v[f.id].cap):''}</div></td>`).join('')}</tr></table>`:''}
      ${sigs.length?`<table><tr>${sigs.map(f=>`<th>${h(f.l)}</th><td style="height:16mm">${v[f.id]?`<img class="sigimg" src="${v[f.id]}">`:''}</td>`).join('')}</tr></table>`:''}</div>`});
}
function recXls(C,list,key){
  const t=catType(C);let aoa;
  if(t==='check'){const its=catItems(C);
    if(C.mode==='week')aoa=[['주간','장소·대상','점검 항목',...WD6.split(''),'비고','점검자'],...list.flatMap(r=>(r.items||its).map((it,i)=>[weekLabel(r.week),r.place,it,...[0,1,2,3,4,5].map(j=>CK_SYM[(r.marks||{})[i+'|'+j]]||''),i?'':r.remark||'',i?'':r.inspector||r.by||'']))];
    else aoa=[['점검일','장소·대상',...its,'비고','점검자'],...list.map(r=>[r.date,r.place,...its.map((_,i)=>CK_SYM[(r.marks||{})[i]]||''),r.remark||'',r.inspector||r.by||''])]}
  else{const fl=(C.fields||[]).filter(f=>!['photo','sig'].includes(f.t));aoa=[['작성일',...fl.map(f=>f.l),'작성자'],...list.map(r=>[r.date,...fl.map(f=>{const v=(r.v||{})[f.id];return f.t==='chk'?(v?'예':''):v??''}),r.by||''])]}
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),'기록');download(wb,`${C.name}_${key}.xlsx`)}

