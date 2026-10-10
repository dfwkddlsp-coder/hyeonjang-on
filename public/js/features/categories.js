// 현장ON — 카테고리: PDF 문서함, 사진대지, 점검표, 작성 양식
'use strict';
/* ---------- 현장 운영안 (PDF) — 운영자가 올리고 모든 사용자가 열람 ---------- */
/* 문서함(PDF) 카테고리 — 운영자가 설정 → 현장 기준에서 추가·이름·공개 범위 지정. 각 카테고리는 홈 타일 하나 */
const docCats=()=>(Array.isArray(S.docCats)&&S.docCats.length?S.docCats:DEF.docCats);
const catVisible=c=>!SERVER||c.scope!=='staff'||isAdmin()||(ME&&ME.role==='manager');
const plansSorted=k=>PL.filter(p=>k===undefined||(p.cat||'plans')===k).sort((a,b)=>String(b.at).localeCompare(String(a.at)));
const fmtSize=n=>n>=1048576?(n/1048576).toFixed(1)+'MB':Math.max(1,Math.round(n/1024))+'KB';
const planUrl=p=>`/api/file/${p.fileId}?n=${encodeURIComponent(p.title)}`;

/* ---------- 카테고리 기록 (사진대지 · 점검표 · 작성 양식) ----------
   운영자가 설정 → 현장 기준 → 카테고리에서 유형과 내용 구성을 정함. 기록은 'records' 저장소 (cat = 카테고리 키) */
const CAT_TYPES={pdf:'PDF 문서함',photo:'사진대지',check:'점검표',form:'작성 양식'};
const FIELD_TYPES={text:'글자',area:'긴 글',num:'숫자',date:'날짜',sel:'선택',chk:'체크',photo:'사진',sig:'서명'};
const catType=c=>CAT_TYPES[c&&c.type]?c.type:'pdf';
const catItems=c=>String(c.items||'').split('\n').map(x=>x.trim()).filter(Boolean);
const recsOf=k=>RC.filter(r=>r.cat===k).sort((a,b)=>String(b.date||b.week||'').localeCompare(String(a.date||a.week||''))||String(b.at).localeCompare(String(a.at)));
const CK_SYM={O:'○',X:'×',N:'-'};
const canWriteCat=C=>!SERVER||(!isDriver()&&catVisible(C));
const canEditRec=r=>isAdmin()||!SERVER||(ME&&r.byId===ME.id);

function photoInputs(host,list,max){ // up to max photos with captions; list = [{src,cap}]
  const draw=()=>{host.innerHTML=Array.from({length:max},(_,i)=>{const p=list[i];return `<div class="card" style="padding:8px;margin:0">
      ${p?`<img src="${p.src}" style="width:100%;max-height:180px;object-fit:cover;border-radius:8px"><input class="inp" data-pc="${i}" value="${h(p.cap||'')}" placeholder="사진 설명 (선택)" style="margin-top:6px"><button type="button" class="btn sm line" data-pr="${i}" style="margin-top:6px;width:100%">사진 빼기</button>`
        :`<div class="grid g2" style="gap:6px"><label class="btn sm"><i class="i i-camera"></i> 촬영<input type="file" accept="image/*" capture="environment" data-pf="${i}" hidden></label><label class="btn sm line">갤러리<input type="file" accept="image/*" data-pg="${i}" hidden></label></div><div class="small muted" style="text-align:center;margin-top:4px">사진 ${i+1}</div>`}</div>`}).join('');
    host.className='grid g2';host.style.gap='8px';
    const add=async(i,f)=>{if(!f)return;try{list[i]={src:await compressImg(f),cap:''};draw()}catch(e){toast('사진을 읽을 수 없습니다')}};
    $$('[data-pf]',host).forEach(x=>x.onchange=()=>add(+x.dataset.pf,x.files[0]));
    $$('[data-pg]',host).forEach(x=>{const lab=x.parentElement;lab.onclick=e=>{if(e.target===x)return;e.preventDefault();withGalleryConsent(()=>x.click())};x.onchange=()=>add(+x.dataset.pg,x.files[0])});
    $$('[data-pc]',host).forEach(x=>x.oninput=()=>{list[+x.dataset.pc].cap=x.value});
    $$('[data-pr]',host).forEach(x=>x.onclick=()=>{list[+x.dataset.pr]=null;draw()})};
  draw();return ()=>list.filter(Boolean)}

R.recs=C=>{
  const t=catType(C),wk=t==='check'&&C.mode==='week';
  if(wk){R.recs.w=R.recs.w||weekMon(today())}else{R.recs.m=R.recs.m||today().slice(0,7)}
  const key=wk?R.recs.w:R.recs.m;
  const list=recsOf(C.k).filter(r=>wk?r.week===key:String(r.date||'').startsWith(key));
  V$().innerHTML=`<h1>${h(C.name)}</h1><div class="small muted" style="margin:-6px 0 10px">${CAT_TYPES[t]}${t==='check'?(wk?' · 주간(월~토)':' · 건별'):''}${C.scope==='staff'?' · 운영자·관리자만':''}</div>
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
function recTitle(C,r){const t=catType(C);if(t==='photo')return r.content||'(내용 없음)';if(t==='check')return r.place||'(장소 미입력)';
  const f=(C.fields||[]).find(f=>['text','sel','num','date'].includes(f.t)&&r.v&&r.v[f.id]);return f?`${f.l}: ${r.v[f.id]}`:(r.date||'')}

function recView(C,r){if(!r)return;
  openModal(C.name,`<div style="overflow:auto;background:#fff;border-radius:10px;padding:8px;border:1px solid var(--line)"><div style="zoom:.55">${recPages(C,[r]).join('<hr>')}</div></div>
    <div class="grid g2" style="margin-top:12px"><button class="btn" id="rvPrint"><i class="i i-print"></i> 인쇄</button>${canEditRec(r)?'<button class="btn line" id="rvEdit">수정</button>':'<span></span>'}</div>
    ${isAdmin()?'<button class="btn line" id="rvDel" style="width:100%;margin-top:8px;color:var(--bad)">삭제</button>':''}`,b=>{
    $('#rvPrint',b).onclick=()=>printPages(recPages(C,[r]));
    if($('#rvEdit',b))$('#rvEdit',b).onclick=()=>recEdit(C,r);
    if($('#rvDel',b))$('#rvDel',b).onclick=async()=>{if(!confirm('이 기록을 삭제할까요?'))return;try{await remove('records',r.id);closeModal();R.recs(C)}catch(x){toast(x.message)}}})}

function recEdit(C,prev){
  const t=catType(C),wk=t==='check'&&C.mode==='week',items=catItems(C),r=prev?JSON.parse(JSON.stringify(prev)):{};
  let body='',getPhotos=null,pads={},mainPad=null;
  if(t==='photo'){
    body=`<div class="grid g2"><div><label class="f">일시</label><input class="inp" type="date" id="reD" value="${h(r.date||today())}"></div><div></div></div>
      <label class="f">내용 *</label><input class="inp" id="reC" value="${h(r.content||'')}" placeholder="예) A동 3층 안전난간 설치 상태">
      <label class="f">사진 (최대 4장)</label><div id="rePh"></div>`;
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
    if(t==='photo')getPhotos=photoInputs($('#rePh',b),(r.photos||[]).slice(),4);
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
      if(t==='photo'){o.date=$('#reD',b).value||today();o.content=$('#reC',b).value.trim();o.photos=getPhotos();if(!o.content)return toast('내용을 입력하세요');if(!o.photos.length)return toast('사진을 1장 이상 넣으세요')}
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
  if(t==='photo')return docPhotoSheet(list.map(r=>({date:fmtDT(r.date),content:r.content||'',photos:(r.photos||[])})));
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

/* 설정: 카테고리 내용 구성 (점검 항목 / 양식 칸) */
function catConfig(c,done){const t=catType(c);
  if(t==='check'){openModal(c.name+' — 점검표 구성',`<label class="f">기록 방식</label><select class="inp" id="ccM"><option value="each" ${c.mode!=='week'?'selected':''}>건별 — 점검할 때마다 한 장</option><option value="week" ${c.mode==='week'?'selected':''}>주간 — 월~토를 한 장에 (장비점검처럼)</option></select>
      <label class="f">점검 항목 (한 줄에 한 항목)</label><textarea class="inp" id="ccI" rows="10" placeholder="안전난간 설치 상태&#10;작업발판 고정 상태">${h(c.items||'')}</textarea>
      <button class="btn xl" id="ccOk" style="width:100%;margin-top:12px">적용</button>`,b=>{$('#ccOk',b).onclick=()=>{c.mode=$('#ccM',b).value;c.items=$('#ccI',b).value.split('\n').map(x=>x.trim()).filter(Boolean).join('\n');if(!c.items)return toast('점검 항목을 1개 이상 입력하세요');closeModal();done()}});return}
  if(t==='form'){let F=(c.fields||[]).map(f=>({...f}));
    openModal(c.name+' — 양식 구성',`<div class="small muted">작성할 칸을 만드세요. 칸 종류: 글자 · 긴 글 · 숫자 · 날짜 · 선택(목록) · 체크 · 사진 · 서명. 작성일과 작성자는 자동으로 들어갑니다.</div><div id="ccF"></div>
      <button class="btn sm line" id="ccAdd" style="margin-top:8px"><i class="i i-plus"></i> 칸 추가</button><button class="btn xl" id="ccOk" style="width:100%;margin-top:12px">적용</button>`,b=>{
      const draw=()=>{$('#ccF',b).innerHTML=F.map((f,i)=>`<div style="padding:8px 0;border-top:1px solid var(--line)"><div class="row" style="gap:6px;flex-wrap:nowrap"><input class="inp grow" data-fl="${i}" value="${h(f.l)}" placeholder="칸 이름" style="min-width:0;padding:6px 8px">
          <select class="inp" data-ft="${i}" style="width:auto;padding:6px">${Object.entries(FIELD_TYPES).map(([k,l])=>`<option value="${k}" ${f.t===k?'selected':''}>${l}</option>`).join('')}</select>
          <button class="btn sm line" data-fu="${i}" ${i?'':'disabled'}>▲</button><button class="btn sm line" data-fx="${i}">✕</button></div>
          <div class="row" style="gap:8px;margin-top:6px">${f.t==='sel'?`<input class="inp grow" data-fo="${i}" value="${h(f.o||'')}" placeholder="선택지 (쉼표로 구분) 예) 양호, 불량, 보수필요" style="padding:6px 8px">`:''}<label class="small row" style="gap:4px"><input type="checkbox" data-fr="${i}" ${f.req?'checked':''}> 필수</label></div></div>`).join('')||'<div class="empty">칸을 추가하세요</div>';
        $$('[data-fl]',b).forEach(x=>x.oninput=()=>{F[+x.dataset.fl].l=x.value});
        $$('[data-fo]',b).forEach(x=>x.oninput=()=>{F[+x.dataset.fo].o=x.value});
        $$('[data-fr]',b).forEach(x=>x.onchange=()=>{F[+x.dataset.fr].req=x.checked});
        $$('[data-ft]',b).forEach(x=>x.onchange=()=>{F[+x.dataset.ft].t=x.value;draw()});
        $$('[data-fu]',b).forEach(x=>x.onclick=()=>{const i=+x.dataset.fu;[F[i-1],F[i]]=[F[i],F[i-1]];draw()});
        $$('[data-fx]',b).forEach(x=>x.onclick=()=>{F.splice(+x.dataset.fx,1);draw()})};
      draw();$('#ccAdd',b).onclick=()=>{F.push({id:uid(),l:'',t:'text'});draw();const ins=$$('[data-fl]',b);ins[ins.length-1].focus()};
      $('#ccOk',b).onclick=()=>{F=F.filter(f=>f.l.trim()).map(f=>({id:f.id,l:f.l.trim(),t:f.t,o:f.t==='sel'?(f.o||''):'',req:!!f.req}));if(!F.length)return toast('칸을 1개 이상 만드세요');c.fields=F;closeModal();done()}});return}
  toast(t==='photo'?'사진대지는 따로 구성할 것이 없습니다 (일시 · 내용 · 사진 4장)':'PDF 문서함은 따로 구성할 것이 없습니다')}
R.plans=(cat)=>{
  if(typeof cat==='string')R.plans.cat=cat;
  const C=docCats().find(x=>x.k===R.plans.cat)||docCats()[0];R.plans.cat=C.k;
  if(!catVisible(C)){V$().innerHTML=`<h1>${h(C.name)}</h1><div class="card empty">운영자·관리자만 볼 수 있는 항목입니다.</div>`;return}
  if(catType(C)!=='pdf')return R.recs(C);
  const pl=plansSorted(C.k);
  V$().innerHTML=`<h1>${h(C.name)}</h1>${C.scope==='staff'?'<div class="small muted" style="margin:-6px 0 10px">공개 범위: 운영자·관리자만</div>':''}
  ${isAdmin()&&SERVER?`<div class="card"><b>PDF 올리기</b> <span class="small muted">운영자만 · 30MB까지</span>
    <label class="f">제목</label><input class="inp" id="plT" placeholder="예) 2026년 10월 현장 운영안">
    <label class="f">PDF 파일</label><input class="inp" id="plF" type="file" accept="application/pdf,.pdf">
    <button class="btn" id="plUp" style="margin-top:10px">올리기</button></div>`:''}
  ${!SERVER?'<div class="hint">문서함은 서버에 로그인해서 사용할 때만 볼 수 있습니다.</div>':''}
  <div class="card list">${pl.map(p=>`<div class="it"><span class="dot d0"><i class="i i-plans"></i></span><div class="m"><b>${h(p.title)}</b><div class="small muted ell">${fmtDT(p.at)} · ${h(p.by||'')} · ${fmtSize(p.size||0)}</div></div>
    <a class="btn sm" href="${planUrl(p)}" target="_blank" rel="noopener">열기</a>${isAdmin()?`<button class="btn sm line" data-pdel="${h(p.id)}">삭제</button>`:''}</div>`).join('')||'<div class="empty">아직 올린 문서가 없습니다</div>'}</div>`;
  const f=$('#plF');if(f)f.onchange=()=>{const t=$('#plT');if(f.files[0]&&!t.value.trim())t.value=f.files[0].name.replace(/\.pdf$/i,'')};
  const up=$('#plUp');if(up)up.onclick=async()=>{
    const file=f.files[0],title=$('#plT').value.trim();
    if(!file)return toast('PDF 파일을 고르세요');if(!title)return toast('제목을 입력하세요');
    if(!/pdf$/i.test(file.type)&&!/\.pdf$/i.test(file.name))return toast('PDF 파일만 올릴 수 있습니다');
    if(file.size>30*1048576)return toast('PDF는 30MB까지 올릴 수 있습니다');
    if(!navigator.onLine)return toast('올리기는 인터넷 연결이 필요합니다');
    up.disabled=true;up.textContent='올리는 중…';
    try{const r=await fetch('/api/admin/files',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/pdf'},body:file});
      const j=await r.json().catch(()=>null);if(!r.ok||!j)throw new Error((j&&j.error)||'HTTP '+r.status);
      await save('plans',{id:uid(),cat:C.k,scope:C.scope==='staff'?'staff':'all',title,fileId:j.id,size:j.size,name:file.name,at:nowLocal(),by:S.inspector||''});await Sync.run();toast('올렸습니다');R.plans()}
    catch(x){toast(x.message);up.disabled=false;up.textContent='올리기'}};
  $$('[data-pdel]').forEach(b=>b.onclick=async()=>{const p=PL.find(x=>x.id===b.dataset.pdel);if(!p||!confirm(`「${p.title}」을(를) 삭제할까요?\nPDF 파일도 서버에서 지워집니다.`))return;try{await remove('plans',p.id);toast('삭제했습니다');R.plans()}catch(x){toast(x.message)}});
};
