// 현장ON — PDF 문서함
'use strict';
R.plans=(cat)=>{
  if(typeof cat==='string'){R.plans.cat=cat;R.plans.sorting=false}
  const C=docCats().find(x=>x.k===R.plans.cat)||docCats()[0];R.plans.cat=C.k;
  if(!catVisible(C)){V$().innerHTML=`<h1>${h(C.name)}</h1><div class="card empty">운영자·관리자만 볼 수 있는 항목입니다.</div>`;return}
  if(catType(C)!=='pdf')return R.recs(C);
  const pl=plansSorted(C.k);
  V$().innerHTML=`<h1>${h(C.name)}</h1>${C.scope==='staff'?'<div class="small muted" style="margin:-6px 0 10px">공개 범위: 운영자·관리자만</div>':''}
  ${can('file.pdf')&&SERVER?`<div class="card"><b>PDF 올리기</b> <span class="small muted">관리자·운영자 · 30MB까지</span>
    <label class="f">제목</label><input class="inp" id="plT" placeholder="예) 2026년 10월 현장 운영안">
    <label class="f">PDF 파일</label><input class="inp" id="plF" type="file" accept="application/pdf,.pdf">
    <button class="btn" id="plUp" style="margin-top:10px">올리기</button></div>`:''}
  ${!SERVER?'<div class="hint">문서함은 서버에 로그인해서 사용할 때만 볼 수 있습니다.</div>':''}
  ${can('file.pdf')&&SERVER&&pl.length>1?`<div class="row" style="margin-bottom:8px"><span class="grow small muted" id="plSortHint">${R.plans.sorting?'▲ ▼로 옮기고 완료를 누르세요':''}</span><button class="btn sm ${R.plans.sorting?'':'line'}" id="plSort">${R.plans.sorting?'완료':'순서 바꾸기'}</button></div>`:''}
  <div class="card list" id="plList"></div>`;
  const order=pl.slice(),sorting=R.plans.sorting&&can('file.pdf')&&SERVER;
  const drawList=()=>{$('#plList').innerHTML=order.map((p,i)=>`<div class="it"><span class="dot d0"><i class="i i-plans"></i></span><div class="m"><b>${h(p.title)}</b><div class="small muted ell">${fmtDT(p.at)} · ${h(p.by||'')} · ${fmtSize(p.size||0)}</div></div>
    ${sorting?`<button class="btn sm line" data-pu="${i}" ${i?'':'disabled'} aria-label="위로">▲</button><button class="btn sm line" data-pd="${i}" ${i<order.length-1?'':'disabled'} aria-label="아래로">▼</button>`
    :`<a class="btn sm" href="${planUrl(p)}" target="_blank" rel="noopener">열기</a>${canDel(p)?`<button class="btn sm line" data-pdel="${h(p.id)}">삭제</button>`:''}`}</div>`).join('')||'<div class="empty">아직 올린 문서가 없습니다</div>';
    $$('[data-pu]').forEach(b=>b.onclick=()=>{const i=+b.dataset.pu;[order[i-1],order[i]]=[order[i],order[i-1]];drawList()});
    $$('[data-pd]').forEach(b=>b.onclick=()=>{const i=+b.dataset.pd;[order[i+1],order[i]]=[order[i],order[i+1]];drawList()});
    $$('[data-pdel]').forEach(b=>b.onclick=async()=>{const p=PL.find(x=>x.id===b.dataset.pdel);if(!p||!confirm(`「${p.title}」을(를) 삭제할까요?\nPDF 파일도 서버에서 지워집니다.`))return;try{await remove('plans',p.id);toast('삭제했습니다');R.plans()}catch(x){toast(x.message)}})};
  drawList();
  const so=$('#plSort');if(so)so.onclick=async()=>{
    if(!sorting){R.plans.sorting=true;return R.plans()}
    so.disabled=true;let n=0;
    try{for(let i=0;i<order.length;i++)if(order[i].ord!==i){await save('plans',{...order[i],ord:i});n++}
      if(n)await Sync.run();R.plans.sorting=false;toast(n?'순서를 저장했습니다':'순서 그대로입니다');R.plans()}
    catch(x){toast(x.message);so.disabled=false}};
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
};
