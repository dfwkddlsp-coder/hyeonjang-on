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
/* ---------- 엑셀 불러오기 전 인식 결과 확인: 어느 열을 무엇으로 읽었는지 보여주고, 틀리거나 빠진 칸은 직접 고름 ---------- */
const IMP_LABEL={workers:{...WORKER_LABEL,emergency:'비상연락처',helmet:'안전모번호',inDate:'채용·투입일',hireY:'채용 연도',hireM:'채용 월',hireD:'채용 일',eduY:'기초교육 이수',eduN:'기초교육 미이수'},equipment:EQUIP_LABEL,
  vuln:{no:'순번',name:'성명',company:'업체명',job:'공종',age:'연령',exam:'검진명',grade:'건강구분',finding:'검진소견',follow1:'사후관리소견1',follow2:'사후관리소견2',note:'비고'}};
/* 대장마다: 구분 칸(*), 한 줄이 사람·장비인지, 같은 사람·장비를 알아보는 열쇠, 경고 */
const IMP_KIND={
  workers:{unit:'명',noun:'사람',what:'근로자',list:()=>W,key:wKey,keyf:['name','company','birth'],keyTxt:'성명·생년월일·업체',drop:'근로자가 대장에서 제외',
    valid:o=>!!o.name&&!/^(성명|이름)$/.test(o.name),
    warn:m=>[m.name==null&&['bad','성명 칸을 찾지 못했습니다. 아래에서 성명 칸을 골라 주세요.'],m.birth==null&&['warn','생년월일 칸이 없습니다 → 같은 사람인지 성명+업체로 구분합니다 (같은 업체의 동명이인은 한 사람으로 합쳐짐).'],m.company==null&&['warn','소속업체 칸이 없습니다.']]},
  equipment:{unit:'대',noun:'장비',what:'장비',list:()=>E,key:eqKey,keyf:['type','plate','operator','company'],keyTxt:'차량번호·운전원',drop:'장비가 반출 처리',
    valid:o=>!!(o.type||o.plate||o.operator),
    warn:m=>[m.plate==null&&['warn','차량번호 칸이 없습니다 → 같은 장비인지 업체+장비명+운전원으로 구분합니다.'],m.type==null&&m.plate==null&&m.operator==null&&['bad','장비명·차량번호·운전원 칸을 하나도 찾지 못했습니다.']]},
  vuln:{unit:'명',noun:'사람',what:'취약근로자',list:()=>VU,key:o=>vKey(o),keyf:['name','company','job'],keyTxt:'성명·업체·공종',drop:'취약근로자가 퇴사 처리',
    valid:o=>!!o.name&&!/예시/.test(o.name+(o.no||'')),
    warn:m=>[m.name==null&&['bad','성명 칸을 찾지 못했습니다. 아래에서 성명 칸을 골라 주세요.'],m.exam==null&&m.finding==null&&['bad','검진명·검진소견 칸이 없어 검진 내용을 읽을 수 없습니다.'],(m.company==null||m.job==null)&&['warn','업체나 공종 칸이 없습니다 → 같은 사람인지 가려낼 정보가 줄어듭니다.']]},
};
const colName=c=>{let s='';c++;while(c){const m=(c-1)%26;s=String.fromCharCode(65+m)+s;c=(c-m-1)/26}return s};
async function importDialog(kind,files){
  if(!files.length)return;
  const K=IMP_KIND[kind],FIELDS=regFields(kind),LB=IMP_LABEL[kind],learn={};
  /* parsed: 파일 → 시트 결과 목록 (근로자·장비는 가장 잘 맞는 시트 하나, 취약근로자는 머리글이 있는 모든 시트). false = 읽기 실패 */
  const parsed=new Map(),units=[];
  openModal('엑셀 인식 결과 확인','<div class="empty">파일을 읽는 중…</div>');
  for(const f of files){let rs;
    try{const wb=await readFile(f);rs=kind==='vuln'?parseVulnSheets(wb,FIELDS):[parseWorkbook(wb,FIELDS,kind==='workers'?2:3)].filter(Boolean)}catch(e){rs=false}
    parsed.set(f,rs);if(rs&&rs.length)rs.forEach(res=>units.push({f,res}));else units.push({f,res:rs})}
  const idx=new Set(K.list().map(K.key));
  const card=({f,res},i)=>{
    if(!res||!res.raw)return `<div class="card"><b>${h(f.name)}</b><div class="hint" style="color:var(--bad);margin-top:6px">${res===false?'파일을 읽지 못했습니다':'머리글 줄을 찾지 못했습니다 — 이 파일은 건너뜁니다'}</div></div>`;
    const rows=res.rows.filter(K.valid),known=rows.filter(o=>idx.has(K.key(o))).length,m=res.map;
    const warn=K.warn(m).filter(Boolean);
    if(rows.length&&K.list().length&&known===0)warn.push(['warn',`지금 대장과 같은 ${K.noun==='사람'?'사람이':'장비가'} 하나도 없습니다. 구분 칸(${K.keyTxt})이 맞게 잡혔는지 확인하세요. "맞추기"를 하면 기존 ${K.drop}됩니다.`]);
    const opts=sel=>`<option value="">— 사용 안 함</option>`+res.head.map((t,c)=>t||res.raw.slice(res.start,res.start+50).some(r=>String(r[c]??'').trim())?`<option value="${c}" ${sel===c?'selected':''}>${colName(c)}열 · ${h(t||'(머리글 없음)')}</option>`:'').join('');
    const shown=Object.keys(FIELDS).filter(k=>K.keyf.includes(k)||m[k]!=null);
    const prev=res.rows.filter(o=>Object.values(o).some(Boolean)).slice(0,3);
    return `<div class="card" data-imu="${i}"><b>${h(f.name)}</b><div class="small muted">시트 [${h(res.sheet)}] · 머리글 ${res.headRow}행 · ${K.what} <b>${rows.length}</b>${K.unit} (지금 대장에 있음 ${known} · 새로 ${rows.length-known})</div>
      ${warn.map(([t,s])=>`<div class="hint small" style="margin-top:6px;${t==='bad'?'color:var(--bad);font-weight:700':''}">${t==='bad'?'⛔':'⚠️'} ${h(s)}</div>`).join('')}
      <div class="imp-map">${shown.map(k=>`<label class="${K.keyf.includes(k)?'key':''}">${h(LB[k]||k)}${K.keyf.includes(k)?' *':''}</label><select class="inp" data-fk="${k}">${opts(m[k])}</select>`).join('')}</div>
      <details style="margin-top:8px"><summary class="small">다른 항목 연결하기 · 앞 3줄 미리 보기</summary>
        <div class="imp-map">${Object.keys(FIELDS).filter(k=>!shown.includes(k)).map(k=>`<label>${h(LB[k]||k)}</label><select class="inp" data-fk="${k}">${opts(m[k])}</select>`).join('')}</div>
        <div class="wkwrap" style="margin-top:8px"><table class="t"><tr>${shown.map(k=>`<th>${h(LB[k]||k)}</th>`).join('')}</tr>${prev.map(o=>`<tr>${shown.map(k=>`<td>${h(o[k]||'')}</td>`).join('')}</tr>`).join('')||'<tr><td>읽은 줄이 없습니다</td></tr>'}</table></div></details></div>`};
  const draw=()=>{$('#mBody').innerHTML=`<div class="small muted" style="margin-bottom:10px">앱이 머리글 글자를 보고 칸을 찾았습니다. 틀리거나 빠진 칸(*는 같은 ${K.noun==='사람'?'사람을':'장비를'} 알아보는 데 쓰는 칸)은 직접 골라 주세요. ${isAdmin()?'직접 고른 칸 제목은 기억해서 다음부터 자동으로 찾습니다.':'(운영자가 고르면 다음부터 자동으로 찾습니다)'}</div>
    ${units.map(card).join('')}<div id="imBtns"></div>`;
    $$('[data-imu]').forEach(el=>{const res=units[+el.dataset.imu].res;
      $$('[data-fk]',el).forEach(s=>s.onchange=()=>{const map={...res.map},k=s.dataset.fk;if(s.value==='')delete map[k];else{map[k]=+s.value;const t=(res.head[+s.value]||'').split(' / ').join('');if(t)learn[k]=t}applyMap(res,map);draw()})});
    const ok=units.some(u=>u.res&&u.res.rows&&u.res.rows.some(K.valid));
    importButtons(kind,files,$('#imBtns'),ok?parsed:null,()=>learnColumns(kind,learn))};
  draw();
}
function bindColAlias(){const box=$('#caBox');if(!box)return;const all=S.colAlias||{},rows=[];
  for(const kind of ['workers','equipment','vuln'])for(const [k,list] of Object.entries(all[kind]||{}))for(const t of list)rows.push({kind,k,t});
  box.innerHTML=rows.map((r,i)=>`<div class="row" style="padding:6px 0;border-top:1px solid var(--line);gap:8px;flex-wrap:nowrap"><span class="badge bgray">${IMP_KIND[r.kind].what}</span><span class="grow">"${h(r.t)}" → <b>${h(IMP_LABEL[r.kind][r.k]||r.k)}</b></span><button class="btn sm line" data-cad="${i}" aria-label="지우기"><i class="i i-x"></i></button></div>`).join('')||'<div class="small muted">아직 없습니다. 엑셀을 올릴 때 확인 화면에서 칸을 직접 고르면 여기에 쌓입니다.</div>';
  $$('[data-cad]',box).forEach(b=>b.onclick=async()=>{const r=rows[+b.dataset.cad];const c=JSON.parse(JSON.stringify(all));c[r.kind][r.k]=c[r.kind][r.k].filter(x=>x!==r.t);S.colAlias=c;await saveSettings();if(SERVER)await queueShared();toast('지웠습니다');bindColAlias()})}
async function learnColumns(kind,learn){if(!isAdmin()||!Object.keys(learn).length)return;
  const all=JSON.parse(JSON.stringify(S.colAlias||{})),A=all[kind]=all[kind]||{};
  for(const [k,t] of Object.entries(learn)){for(const f in A)A[f]=A[f].filter(x=>norm(x)!==norm(t));(A[k]=A[k]||[]).push(t)}
  S.colAlias=all;await saveSettings();if(SERVER)await queueShared()}
function importButtons(kind,files,host,pre,onRun){
  const has=(kind==='workers'?W:kind==='vuln'?VU:E).length;
  if(pre===null){host.innerHTML='<div class="hint" style="color:var(--bad)">불러올 수 있는 줄이 없습니다. 위에서 칸을 골라 주세요.</div>';return}
  host.innerHTML=`
   <div class="grid g2"><button class="btn" id="im">추가·갱신 (바뀐 것만 반영)</button>${has?`<button class="btn line" id="ir">현재 대장으로 맞추기</button>`:''}</div>
   <div class="small muted" style="margin-top:8px">어느 쪽이든 내용이 같은 ${kind==='equipment'?'장비':'사람'}는 그대로 두고, 지난 ${kind==='equipment'?'점검':kind==='vuln'?'상담·혈압':'적발·음주'} 기록과의 연결도 유지됩니다.${has?`<br><b>맞추기</b>는 파일에 없는 ${kind==='equipment'?'장비를 반출 처리':kind==='vuln'?'사람을 퇴사 처리':'사람을 대장에서 제외'}합니다.`:''}</div><div id="ires" style="margin-top:12px"></div>`;const b=host;
    const run=async rep=>{if(rep&&!confirm(`파일에 없는 ${kind==='equipment'?'장비는 반출 처리':kind==='vuln'?'사람은 퇴사 처리':'사람은 대장에서 제외'}됩니다. 계속할까요?`))return;if(onRun)await onRun();$('#ires').textContent='처리 중...';
      let r;try{r=await importFiles(kind,files,rep,pre||undefined)}catch(x){$('#ires').innerHTML=`<div class="hint" style="color:var(--bad)">${h(x.message)}</div>`;return}$('#ires').innerHTML=`<div class="hint">추가 <b>${r.added}</b> · 변경 <b>${r.updated}</b> · 그대로 <b>${r.same||0}</b><br>${r.msgs.map(h).join('<br>')}</div><button class="btn" style="margin-top:10px;width:100%" id="idone">확인</button>`;
      $('#idone').onclick=()=>{closeModal();R[cur]()}};
    $('#im',b).onclick=()=>run(false);const ir=$('#ir',b);if(ir)ir.onclick=()=>run(true);
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
   <div class="row" style="margin-top:14px"><button class="btn" id="qs" style="flex:1">저장</button>${id&&canDelEq(e)?'<button class="btn bad" id="qd">삭제</button>':''}</div>`,b=>{
    $('#qs',b).onclick=async()=>{const o={...e,id:e.id||uid()};$$('[data-k]',b).forEach(i=>o[i.dataset.k]=i.value.trim());if(!o.type&&!o.plate)return toast('장비명 또는 차량번호 입력');if(!id){o.created=nowLocal();o.src='직접입력'}else o.updated=nowLocal();await save('equipment',o);closeModal();R[cur]()};
    const qd=$('#qd',b);if(qd)qd.onclick=()=>eqDelete(e,closeModal);
  });
}

/* --- 기록 --- */
