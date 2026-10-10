// 현장ON — 근로자·장비 관리대장
'use strict';
R.workers=()=>{
  const q=R.workers.q||'',co=R.workers.co||'';const comps=[...new Set(W.map(w=>w.company).filter(Boolean))].sort();
  const list=W.filter(w=>(!co||w.company===co)&&(!q||norm([w.name,w.company,w.job,w.helmet,w.phone,w.birth].join(' ')).includes(norm(q)))).sort((a,b)=>(a.company||'').localeCompare(b.company||'')||a.name.localeCompare(b.name));
  V$().innerHTML=`<h1>근로자 관리대장 <span class="badge">${W.length}명</span></h1>
  <div class="card"><div class="row">${isStaff()?'<label class="btn"><i class="i i-import"></i> 엑셀 불러오기<input type="file" accept=".xls,.xlsx,.csv" multiple hidden id="wf"></label>':''}<button class="btn ghost" id="wt">양식 다운로드</button><button class="btn ghost" id="wa"><i class="i i-plus"></i> 직접 추가</button><button class="btn line" id="wx">엑셀 저장</button></div>
  <div class="small muted" style="margin-top:8px">업체별 작성 양식을 여러 개 한 번에 올려도 됩니다. 같은 성명+생년월일은 자동 병합.</div></div>
  <div class="row" style="margin-bottom:10px"><input class="inp grow" id="wq" type="search" placeholder="성명 · 업체 · 직종" value="${h(q)}"><select class="inp" id="wc" style="width:auto;max-width:220px"><option value="">전체 업체</option>${comps.map(c=>`<option ${c===co?'selected':''}>${h(c)}</option>`).join('')}</select></div>
  <div class="card list">${list.length?list.slice(0,400).map(w=>{const k=pkey(w.name,w.company);const n=strikesOf(k).length;const ban=isBanned(k);return `<div class="it" data-wid="${w.id}"><span class="dot ${ban?'d3':n?'d'+Math.min(n,3):'d0'}">${ban?'퇴출':n?n+'회':'—'}</span><div class="m"><b>${h(w.name)}</b> <span class="muted">${h(w.company||'')}</span>${vulnOf(w.name,w.company)?' <span class="badge bbad"><i class="i i-heart"></i> 취약</span>':''}<div class="small muted ell">${h(w.job||'')}${w.phone?' · '+h(w.phone):''}</div></div></div>`}).join('')+(list.length>400?`<div class="empty">${list.length-400}명 더 있음 — 검색으로 좁히세요</div>`:''):'<div class="empty">근로자 없음. 양식을 내려받아 작성 후 불러오세요.</div>'}</div>`;
  $('#wq').oninput=e=>{R.workers.q=e.target.value;clearTimeout(R.workers.t);R.workers.t=setTimeout(()=>{R.workers();const i=$('#wq');i.focus();i.setSelectionRange(i.value.length,i.value.length)},250)};
  $('#wc').onchange=e=>{R.workers.co=e.target.value;R.workers()};
  $('#wt').onclick=tplWorkers;$('#wx').onclick=()=>exportWorkers(list);$('#wa').onclick=()=>editWorker();
  if($('#wf'))$('#wf').onchange=e=>importDialog('workers',[...e.target.files]);bindItems();
};
function importDialog(kind,files){
  if(!files.length)return;const has=(kind==='workers'?W:kind==='vuln'?VU:E).length;
  openModal('엑셀 불러오기',`<p>${files.map(f=>'<i class="i i-file"></i> '+h(f.name)).join('<br>')}</p>
   <div class="grid g2"><button class="btn" id="im">추가·갱신 (바뀐 것만 반영)</button>${has?`<button class="btn line" id="ir">현재 대장으로 맞추기</button>`:''}</div>
   <div class="small muted" style="margin-top:8px">어느 쪽이든 내용이 같은 ${kind==='equipment'?'장비':'사람'}는 그대로 두고, 지난 ${kind==='equipment'?'점검':kind==='vuln'?'상담·혈압':'적발·음주'} 기록과의 연결도 유지됩니다.${has?`<br><b>맞추기</b>는 파일에 없는 ${kind==='equipment'?'장비를 반출 처리':kind==='vuln'?'사람을 퇴사 처리':'사람을 대장에서 제외'}합니다.`:''}</div><div id="ires" style="margin-top:12px"></div>`,b=>{
    const run=async rep=>{if(rep&&!confirm(`파일에 없는 ${kind==='equipment'?'장비는 반출 처리':kind==='vuln'?'사람은 퇴사 처리':'사람은 대장에서 제외'}됩니다. 계속할까요?`))return;$('#ires').textContent='처리 중...';
      let r;try{r=await importFiles(kind,files,rep)}catch(x){$('#ires').innerHTML=`<div class="hint" style="color:var(--bad)">${h(x.message)}</div>`;return}$('#ires').innerHTML=`<div class="hint">추가 <b>${r.added}</b> · 변경 <b>${r.updated}</b> · 그대로 <b>${r.same||0}</b><br>${r.msgs.map(h).join('<br>')}</div><button class="btn" style="margin-top:10px;width:100%" id="idone">확인</button>`;
      $('#idone').onclick=()=>{closeModal();R[cur]()}};
    $('#im',b).onclick=()=>run(false);const ir=$('#ir',b);if(ir)ir.onclick=()=>run(true);
  });
}
function editWorker(id){
  const w=id?W.find(x=>x.id===id):{};
  openModal(id?'근로자 수정':'근로자 추가',Object.entries(WORKER_LABEL).map(([k,l])=>`<label class="f">${l}${k==='name'||k==='company'?' *':''}</label>${k==='company'||k==='job'?comboHtml('ew_'+k,k,w[k],l+' 직접 입력',`data-k="${k}"`):`<input class="inp" data-k="${k}" value="${h(w[k]||'')}">`}`).join('')+companyDatalist()+
   `${id?`<label class="row" style="margin-top:12px"><input type="checkbox" id="wb" ${w.banned?'checked':''} style="width:22px;height:22px"> 퇴출 상태</label>`:''}<div class="row" style="margin-top:14px"><button class="btn" id="ws" style="flex:1">저장</button>${id&&isAdmin()?'<button class="btn bad" id="wd">삭제</button>':''}</div>`,b=>{
    bindCombos(b);
    $('#ws',b).onclick=async()=>{const o={...w,id:w.id||uid()};$$('[data-k]',b).forEach(i=>o[i.dataset.k]=i.value.trim());if(!o.name||!o.company)return toast('성명과 소속업체는 필수');if(id)o.banned=$('#wb').checked;if(!id)o.created=nowLocal();await save('workers',o);closeModal();R[cur]()};
    const wd=$('#wd',b);if(wd)wd.onclick=async()=>{if(!confirm(`${w.name} 근로자를 대장에서 삭제할까요? (적발·측정 기록은 유지)`))return;await remove('workers',id);closeModal();R[cur]()};
  });
}
function showWorker(id){const w=W.find(x=>x.id===id);if(w)showPersonHistory(pkey(w.name,w.company),w.name,w.company,w)}
function showPersonHistory(k,name,company,w){
  w=w||workerByKey(k);const vs=V.filter(v=>v.pkey===k).sort((a,b)=>b.at.localeCompare(a.at));const as=A.filter(a=>a.pkey===k).sort((a,b)=>b.at.localeCompare(a.at));const n=strikesOf(k).length;
  openModal(`${name} · ${company}`,`<div class="who" style="margin-bottom:12px"><span class="dot ${isBanned(k)?'d3':n?'d'+Math.min(n,3):'d0'}" style="width:60px;height:60px;font-size:16px">${isBanned(k)?'퇴출':n+'회'}</span><div style="flex:1">${w?`<dl class="kv">${Object.entries(WORKER_LABEL).filter(([f])=>w[f]).map(([f,l])=>`<dt>${l}</dt><dd>${f==='phone'?`<a href="tel:${h(w[f])}">${h(w[f])}</a>`:h(w[f])}</dd>`).join('')}</dl>`:'<span class="muted">근로자 대장에 없음</span>'}${vulnBadge(name,company)}</div></div>
   <div class="row" style="margin-bottom:12px"><button class="btn" id="hs"><i class="i i-alert"></i> 적발 등록</button><button class="btn" id="ha"><i class="i i-alcohol"></i> 음주측정</button>${vulnOf(name,company)?'<button class="btn" id="hv"><i class="i i-heart"></i> 취약근로자</button>':''}${w?'<button class="btn line" id="he">정보 수정</button>':''}</div>
   <h2>삼진아웃 이력 (${vs.length})</h2><div class="card list">${vs.length?vs.map(vItem).join(''):'<div class="empty">없음</div>'}</div>
   <h2>음주측정 이력 (${as.length})</h2><div class="card list">${as.length?as.slice(0,30).map(alcItem).join(''):'<div class="empty">없음</div>'}</div>`,b=>{
    const p={name,company,job:w?w.job:'',helmet:w?w.helmet:'',workerId:w?w.id:''};
    $('#hs',b).onclick=()=>{closeModal();go('strike',{person:p})};
    $('#ha',b).onclick=()=>{closeModal();go('alcohol');alcForm(p)};
    const hv=$('#hv',b);if(hv)hv.onclick=()=>showVuln(vulnOf(name,company).id);
    const he=$('#he',b);if(he)he.onclick=()=>editWorker(w.id);
    bindItems(b);
  });
}

/* --- 장비 --- */
const eqCat=t=>(String(t||'기타').split(/[(\s]/)[0]||'기타');
R.equip=()=>{
  const q=R.equip.q||'',cat=R.equip.cat||'',f=R.equip.f||'';
  const cats=[...new Set(E.map(e=>eqCat(e.type)))].sort();
  const list=E.filter(e=>(!cat||eqCat(e.type)===cat)&&(!q||norm(Object.values(e).join(' ')).includes(norm(q)))&&
    (!f||(f==='exp'?['bad','warn'].includes(expState(e.inspect))||['bad','warn'].includes(expState(e.insurance)):f==='in'?!e.outDate:!!e.outDate))).sort((a,b)=>(+a.no||999)-(+b.no||999));
  V$().innerHTML=`<h1>장비 관리대장 <span class="badge">${E.length}대</span></h1>
  <div class="card"><div class="row">${isStaff()?'<label class="btn"><i class="i i-import"></i> 엑셀 불러오기<input type="file" accept=".xls,.xlsx" multiple hidden id="ef"></label>':''}<button class="btn ghost" id="et">양식 다운로드</button><button class="btn ghost" id="ea"><i class="i i-plus"></i> 직접 추가</button><button class="btn line" id="ex">엑셀 저장</button></div>
  <div class="small muted" style="margin-top:8px">"장비 전담 관리자 지정서" 양식 그대로 올리면 됩니다. 같은 차량번호+운전원은 최신 내용으로 갱신.</div></div>
  <input class="inp big" id="eq" type="search" placeholder="차량번호 · 장비명 · 운전원 · 업체 · 전담관리자" value="${h(q)}" style="margin-bottom:10px">
  <div class="chips scroll" style="margin-bottom:8px"><button class="chip ${!cat?'on':''}" data-c="">전체</button>${cats.map(c=>`<button class="chip ${c===cat?'on':''}" data-c="${h(c)}">${h(c)} ${E.filter(e=>eqCat(e.type)===c).length}</button>`).join('')}</div>
  <div class="chips scroll" style="margin-bottom:12px">${[['','전체'],['in','반입중'],['out','반출'],['exp','<i class="i i-alert"></i> 서류 만료·임박']].map(([v,t])=>`<button class="chip ${f===v?'on':''}" data-f="${v}">${t}</button>`).join('')}</div>
  <div class="card list ph-only">${list.length?list.map(eqItem).join(''):'<div class="empty">장비 없음</div>'}</div>
  <div class="tbl-wrap pc-only"><table class="t"><tr><th>번호</th><th>장비명</th><th>차량번호</th><th>소속업체</th><th>운전원</th><th>연락처</th><th>반입</th><th>검사기간</th><th>보험</th><th>전담관리자</th><th>작업지휘자</th><th>신호수</th></tr>
  ${list.length?list.map(e=>`<tr class="click" data-eid="${e.id}"><td>${h(e.no)}</td><td><b>${h(e.type)}</b></td><td>${h(e.plate)}</td><td>${h(e.company)}</td><td>${h(e.operator)}</td><td>${h(e.phone)}</td><td>${h(e.inDate)}${e.outDate?'<br><span class="muted small">반출 '+h(e.outDate)+'</span>':''}</td><td>${expCell(e.inspect)}</td><td>${expCell(e.insurance)}</td><td>${h(e.manager)}</td><td>${h(e.commander)}</td><td>${h(e.signal)}</td></tr>`).join(''):'<tr><td colspan="12" class="empty">장비 없음</td></tr>'}</table></div>`;
  $('#eq').oninput=e=>{R.equip.q=e.target.value;clearTimeout(R.equip.t);R.equip.t=setTimeout(()=>{R.equip();const i=$('#eq');i.focus();i.setSelectionRange(i.value.length,i.value.length)},250)};
  $$('[data-c]').forEach(b=>b.onclick=()=>{R.equip.cat=b.dataset.c;R.equip()});
  $$('[data-f]').forEach(b=>b.onclick=()=>{R.equip.f=b.dataset.f;R.equip()});
  $('#et').onclick=tplEquip;$('#ex').onclick=()=>exportEquip(list);$('#ea').onclick=()=>editEquip();
  if($('#ef'))$('#ef').onchange=e=>importDialog('equipment',[...e.target.files]);bindItems();
};
function showEquip(id){
  const e=E.find(x=>x.id===id);if(!e)return;
  openModal(`${e.type||'장비'} · ${e.plate||''}`,`<dl class="kv">${Object.entries(EQUIP_LABEL).filter(([k])=>e[k]).map(([k,l])=>`<dt>${l}</dt><dd>${k==='phone'?`<a href="tel:${h(e[k])}">${h(e[k])}</a>`:k==='inspect'||k==='insurance'?expCell(e[k]):h(e[k])}</dd>`).join('')}</dl>
   <p class="small muted">출처: ${h(e.src||'')} ${h(e.updated||e.created||'')}</p>
   <div class="row" style="margin-top:12px">${e.operator?'<button class="btn" id="ea"><i class="i i-alcohol"></i> 운전원 음주측정</button><button class="btn" id="es"><i class="i i-alert"></i> 운전원 적발</button>':''}<button class="btn" id="ek"><i class="i i-eqcheck"></i> 점검표</button><button class="btn line" id="ee">수정</button></div>`,b=>{
    $('#ek',b).onclick=()=>{closeModal();eqCheckForm(e.id,today())};
    const p={name:e.operator,company:e.company,job:'장비운전원',equip:e.type,plate:e.plate};const w=W.find(x=>pkey(x.name,x.company)===pkey(e.operator,e.company));if(w){p.job=w.job||p.job;p.workerId=w.id;p.helmet=w.helmet}
    const ea=$('#ea',b);if(ea)ea.onclick=()=>{closeModal();go('alcohol');alcForm(p)};
    const es=$('#es',b);if(es)es.onclick=()=>{closeModal();go('strike',{person:p})};
    $('#ee',b).onclick=()=>editEquip(id);
  });
}
function editEquip(id){
  const e=id?E.find(x=>x.id===id):{};
  openModal(id?'장비 수정':'장비 추가',`<div class="grid g2">${Object.entries(EQUIP_LABEL).map(([k,l])=>`<div><label class="f">${l}</label><input class="inp" data-k="${k}" value="${h(e[k]||'')}" ${k==='company'?'list="companyList"':''}></div>`).join('')}</div>${companyDatalist()}
   <div class="row" style="margin-top:14px"><button class="btn" id="qs" style="flex:1">저장</button>${id&&isAdmin()?'<button class="btn bad" id="qd">삭제</button>':''}</div>`,b=>{
    $('#qs',b).onclick=async()=>{const o={...e,id:e.id||uid()};$$('[data-k]',b).forEach(i=>o[i.dataset.k]=i.value.trim());if(!o.type&&!o.plate)return toast('장비명 또는 차량번호 입력');if(!id){o.created=nowLocal();o.src='직접입력'}else o.updated=nowLocal();await save('equipment',o);closeModal();R[cur]()};
    const qd=$('#qd',b);if(qd)qd.onclick=async()=>{if(!confirm('이 장비를 대장에서 삭제할까요?'))return;await remove('equipment',id);closeModal();R[cur]()};
  });
}

/* --- 기록 --- */
