// 현장ON — 취약근로자
'use strict';
/* ---------- 취약근로자 ---------- */
const VULN_FIELDS={no:['순번','번호'],name:['성명','이름'],company:['업체명','협력사명','소속업체','업체'],job:['공종명','공종','직종'],age:['연령','나이'],exam:['검진명','검진종류','유해인자'],grade:['건강구분1','건강구분'],finding:['검진소견1','검진소견'],follow1:['사후관리소견1','사후관리소견'],follow2:['사후관리소견2'],note:['비고']};
const compNorm=c=>norm(String(c||'').replace(/\((유|주)\)|㈜|주식회사|유한회사/g,''));
const vKey=p=>norm(p.name)+'|'+compNorm(p.company)+'|'+norm(p.job);
function vulnOf(name,company){const n=norm(name),c=compNorm(company);if(!n)return null;return VU.find(p=>!p.retired&&norm(p.name)===n&&(!c||!compNorm(p.company)||compNorm(p.company)===c))||null}
function vulnTags(p){const all=[...(p.items||[]).map(i=>[i.exam,i.finding,i.follow1,i.follow2,i.note].join(' ')),p.note||''].join(' ');const t=[];
  if(/혈압/.test(all))t.push('고혈압');if(/당뇨/.test(all))t.push('당뇨');if(/소음|난청/.test(all))t.push('소음성난청');if(/분진/.test(all))t.push('분진');
  if(+String(p.age).replace(/\D/g,'')>=S.vulnAge)t.push('고령');if((p.items||[]).some(i=>/^D/i.test(i.grade)))t.push('유소견(D)');
  if(/특검/.test(all))t.push('특검대상');if(/상담|진료|병원|치료/.test(all))t.push('상담·진료필요');return t}
const tagCls=t=>t==='유소견(D)'||t==='상담·진료필요'||t==='고혈압'?'bbad':'bwarn';
function vulnBadge(name,company){const p=vulnOf(name,company);return p?`<div class="badge bbad wrap" style="margin-top:6px"><i class="i i-heart"></i> 취약근로자 · ${vulnTags(p).join(' · ')||'관리대상'}</div>`:''}
function bpJudge(sy,di){if(!sy||!di)return '';if(sy>=S.bp.stop[0]||di>=S.bp.stop[1])return '위험';if(sy>=S.bp.warn[0]||di>=S.bp.warn[1])return '주의';return '정상'}
const bpCls=j=>({'정상':'bok','주의':'bwarn','위험':'bbad'}[j]||'bgray');
const isGenExam=i=>!i.exam||/^일반|혈압|당뇨|혈액|간기능/.test(i.exam);
const FIT=['가 (현재 조건에서 작업 가능)','나 (일정 조건하 작업 가능)','다 (한시적 작업 불가)','라 (영구적 작업 불가)'];
const CVD=['저위험','중등도위험','고위험','최고위험'];

async function importVuln(files,replace){
  let added=0,updated=0;const msgs=[];const cur=replace?[]:[...VU];const idx=new Map(cur.map(p=>[vKey(p),p]));const seen=new Set();
  for(const f of files){
    let wb;try{wb=await readFile(f)}catch(e){msgs.push(`${f.name}: 읽기 실패`);continue}let found=0;
    for(const sn of wb.SheetNames){
      const ws=wb.Sheets[sn];trimRef(ws);const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:'',blankrows:true});
      let hr=-1,map=null;for(let r=0;r<Math.min(rows.length,15);r++){const m=buildMap(rows[r],null,VULN_FIELDS);if(m.name!=null&&(m.exam!=null||m.finding!=null)){hr=r;map=m;break}}
      if(hr<0)continue;found++;let curP=null,skip=false,n=0;
      const g=(row,k)=>map[k]==null?'':String(row[map[k]]??'').replace(/\s*\n\s*/g,'').trim();
      for(let r=hr+1;r<rows.length;r++){const row=rows[r];const name=g(row,'name'),no=g(row,'no');
        if(name){
          if(/예시/.test(no)||/예시/.test(name)){skip=true;curP=null;continue}skip=false;
          const o={name,company:g(row,'company'),job:g(row,'job'),age:g(row,'age').replace(/\D/g,'')};const k=vKey(o);const ex=idx.get(k);
          if(ex){if(!seen.has(ex.id)){ex.items=[];updated++}Object.assign(ex,{company:o.company||ex.company,age:o.age||ex.age,src:f.name,updated:nowLocal()});curP=ex}
          else{curP={id:uid(),...o,items:[],consults:[],bp:[],src:f.name,created:nowLocal()};cur.push(curP);idx.set(k,curP);added++}
          seen.add(curP.id);n++;
        }else if(skip||!curP)continue;
        const it={exam:g(row,'exam'),grade:g(row,'grade'),finding:g(row,'finding'),follow1:g(row,'follow1'),follow2:g(row,'follow2'),note:g(row,'note')};
        if(Object.values(it).some(Boolean))curP.items.push(it);
      }
      msgs.push(`${f.name} [${sn}] ${n}명 인식`);
    }
    if(!found)msgs.push(`${f.name}: 머리글(성명/검진명) 행을 찾지 못함`);
  }
  cur.forEach(p=>{p.retired=!!p.retiredManual||(p.items||[]).some(i=>/퇴사/.test(i.note))});
  if(SERVER)await pushImport('vuln',replace?cur:cur.filter(p=>seen.has(p.id)),replace);
  else{await DB.putMany('vuln',cur,replace);VU=cur}
  return {added,updated,skipped:0,msgs};
}
function tplVuln(){
  const wb=XLSX.utils.book_new();const hd=['순번','성명','업체명','공종명','연령','검진명','건강구분1','검진소견1','사후관리소견1','사후관리소견2','비고'];
  const aoa=[['취약근로자 명단'],hd,['예시','김성수','태경','굴삭기','51','소음','A','정상','필요없음','특검','퇴사'],['','','','굴삭기','','광물성분진','A','정상','필요없음']];for(let i=1;i<=100;i++)aoa.push([i]);
  XLSX.utils.book_append_sheet(wb,sheet(aoa,[6,10,16,14,6,14,10,18,36,14,30],['A1:K1']),'목록');
  XLSX.utils.book_append_sheet(wb,sheet([['작성 안내'],['· 2행 머리글은 지우거나 바꾸지 마세요.'],['· 한 사람의 검진 항목이 여러 개면 아랫줄에 성명 없이 검진명부터 이어 적으면 같은 사람으로 묶입니다.'],['· 비고에 "퇴사"라고 적으면 퇴사자로 분류됩니다.'],['· 업체별로 시트를 나눠도 모두 읽습니다.']],[90]),'작성안내');
  download(wb,'취약근로자 명단 양식.xlsx');
}
function exportVuln(list){
  const hd=['순번','성명','업체명','공종명','연령','검진명','건강구분1','검진소견1','사후관리소견1','사후관리소견2','비고','분류','최근 사후상담','최근 혈압','상태'];const aoa=[['취약근로자 명단'],hd];const mg=['A1:O1'];
  list.forEach((p,i)=>{const its=p.items&&p.items.length?p.items:[{}];const c=(p.consults||[]).slice(-1)[0],b=(p.bp||[]).slice(-1)[0];
    its.forEach((it,j)=>aoa.push(j?['','','',p.job,'',it.exam,it.grade,it.finding,it.follow1,it.follow2,it.note]:[i+1,p.name,p.company,p.job,p.age,it.exam,it.grade,it.finding,it.follow1,it.follow2,it.note,vulnTags(p).join(', '),c?c.date:'미실시',b?`${b.sys}/${b.dia} ${b.judge}`:'',p.retired?'퇴사':'']))});
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,sheet(aoa,[6,10,16,14,6,14,10,18,36,14,30,24,12,14,6],mg),'취약근로자');download(wb,`취약근로자 명단_${today()}.xlsx`);
}
function vulnItem(p,tags){tags=tags||vulnTags(p);const c=(p.consults||[]).slice(-1)[0],b=(p.bp||[]).slice(-1)[0];
  return `<div class="it" data-uid="${p.id}"><span class="dot d0"><i class="i i-heart"></i></span><div class="m"><b>${h(p.name)}</b> <span class="muted">${h(p.company)} · ${h(p.job)}${p.age?' · '+h(p.age)+'세':''}</span>${p.retired?' <span class="badge bgray">퇴사</span>':''}
   <div class="chips" style="gap:4px;margin:4px 0">${tags.map(t=>`<span class="badge ${tagCls(t)}">${t}</span>`).join('')}</div>
   <div class="small muted ell">${c?`사후상담 ${c.date}`:'<b style="color:var(--bad)">사후상담 미실시</b>'}${b?` · 혈압 ${b.sys}/${b.dia} <span class="badge ${bpCls(b.judge)}">${b.judge}</span> ${fmtDT(b.at).slice(5)}`:''}</div></div></div>`}
R.vuln=()=>{
  if(!vulnVisible()){V$().innerHTML='<h1>취약근로자</h1><div class="card empty">취약근로자(건강검진·혈압) 정보는 개인 건강정보 보호를 위해 <b>운영자·관리자만</b> 열람할 수 있습니다.</div>';return}
  const q=R.vuln.q||'',tag=R.vuln.tag||'',ret=!!R.vuln.ret;
  const base=VU.filter(p=>ret||!p.retired);const T=new Map(base.map(p=>[p.id,vulnTags(p)]));
  const tags=['고혈압','소음성난청','고령','유소견(D)','특검대상','상담·진료필요','당뇨','분진'].filter(t=>base.some(p=>T.get(p.id).includes(t)));
  const noC=base.filter(p=>!(p.consults||[]).length);
  const list=(tag==='미상담'?noC:base.filter(p=>!tag||T.get(p.id).includes(tag))).filter(p=>!q||norm([p.name,p.company,p.job,...(p.items||[]).map(i=>i.exam+i.finding+i.follow1)].join(' ')).includes(norm(q)))
    .sort((a,b)=>(a.company||'').localeCompare(b.company||'')||a.name.localeCompare(b.name));
  V$().innerHTML=`<h1>취약근로자 <span class="badge">${base.length}명</span></h1>
  <div class="card"><div class="row">${isAdmin()?'<label class="btn"><i class="i i-import"></i> 엑셀 불러오기<input type="file" accept=".xls,.xlsx" multiple hidden id="uf"></label>':''}<button class="btn ghost" id="ut">양식 다운로드</button><button class="btn ghost" id="ua"><i class="i i-plus"></i> 직접 추가</button><button class="btn line" id="ux">엑셀 저장</button></div>
  <div class="small muted" style="margin-top:8px">"유소견자 사후관리 명단" 엑셀을 그대로 올리면 됩니다. 업체별 시트가 여러 개여도 모두 읽고, 성명 없는 아랫줄은 같은 사람의 검진 항목으로 묶습니다.</div></div>
  <input class="inp big" id="uq" type="search" placeholder="성명 · 업체 · 공종 · 소견" value="${h(q)}" style="margin-bottom:10px">
  <div class="chips scroll" style="margin-bottom:12px"><button class="chip ${!tag?'on':''}" data-t="">전체 ${base.length}</button><button class="chip ${tag==='미상담'?'on':''}" data-t="미상담">사후상담 미실시 ${noC.length}</button>${tags.map(t=>`<button class="chip ${t===tag?'on':''}" data-t="${t}">${t} ${base.filter(p=>T.get(p.id).includes(t)).length}</button>`).join('')}<button class="chip ${ret?'on':''}" id="uret">퇴사자 포함</button></div>
  <div class="card list">${list.length?list.map(p=>vulnItem(p,T.get(p.id))).join(''):'<div class="empty">해당 없음. 명단 엑셀을 불러오세요.</div>'}</div>`;
  $('#uq').oninput=e=>{R.vuln.q=e.target.value;clearTimeout(R.vuln.t);R.vuln.t=setTimeout(()=>{R.vuln();const i=$('#uq');i.focus();i.setSelectionRange(i.value.length,i.value.length)},250)};
  $$('[data-t]').forEach(b=>b.onclick=()=>{R.vuln.tag=b.dataset.t;R.vuln()});$('#uret').onclick=()=>{R.vuln.ret=!ret;R.vuln()};
  $('#ut').onclick=tplVuln;$('#ux').onclick=()=>exportVuln(list);$('#ua').onclick=()=>editVuln();
  if($('#uf'))$('#uf').onchange=e=>importDialog('vuln',[...e.target.files]);bindItems();
};
function showVuln(id){
  const p=VU.find(x=>x.id===id);if(!p)return;const w=W.find(x=>norm(x.name)===norm(p.name)&&compNorm(x.company)===compNorm(p.company));const cs=(p.consults||[]).slice().reverse(),bs=(p.bp||[]).slice().reverse();
  openModal(`${p.name} · ${p.company}`,`<div class="chips" style="gap:6px;margin-bottom:10px">${vulnTags(p).map(t=>`<span class="badge ${tagCls(t)}">${t}</span>`).join('')}${p.retired?'<span class="badge bgray">퇴사</span>':''}</div>
   <dl class="kv"><dt>공종</dt><dd>${h(p.job)}</dd><dt>연령</dt><dd>${h(p.age)}${p.age?'세':''}</dd>${w&&w.phone?`<dt>연락처</dt><dd><a href="tel:${h(w.phone)}">${h(w.phone)}</a></dd>`:''}${p.note?`<dt>메모</dt><dd>${nl(p.note)}</dd>`:''}</dl>
   <div class="row" style="margin:12px 0"><button class="btn" id="vc"><i class="i i-note"></i> 사후상담일지 작성</button><button class="btn" id="vb"><i class="i i-bp"></i> 혈압 측정</button>${cs.length?'<button class="btn line" id="vp"><i class="i i-print"></i> 최근 일지 출력</button>':''}<button class="btn line" id="ve">수정</button><button class="btn line" id="vr">${p.retired?'재직 처리':'퇴사 처리'}</button></div>
   <h2>검진 결과</h2><div class="card list ph-only">${(p.items||[]).length?p.items.map(i=>`<div class="it" style="cursor:default">${i.grade?`<span class="badge ${/^D/i.test(i.grade)?'bbad':'bwarn'}">${h(i.grade)}</span>`:''}<div class="m"><b>${h(i.exam||'-')}</b> · ${h(i.finding||'')}<div class="small muted">${h([i.follow1,i.follow2,i.note].filter(Boolean).join(' / '))}</div></div></div>`).join(''):'<div class="empty">검진 항목 없음</div>'}</div><div class="tbl-wrap pc-only"><table class="t"><tr><th>검진명</th><th>건강구분</th><th>검진소견</th><th>사후관리소견</th><th>사후관리2</th><th>비고</th></tr>
   ${(p.items||[]).length?p.items.map(i=>`<tr><td>${h(i.exam)}</td><td>${h(i.grade)}</td><td>${h(i.finding)}</td><td style="white-space:normal;min-width:180px">${h(i.follow1)}</td><td>${h(i.follow2)}</td><td style="white-space:normal">${h(i.note)}</td></tr>`).join(''):'<tr><td colspan="6" class="empty">검진 항목 없음</td></tr>'}</table></div>
   <h2>혈압 기록 (${bs.length})</h2><div class="card list">${bs.length?bs.slice(0,10).map(b=>`<div class="it" style="cursor:default"><span class="badge ${bpCls(b.judge)}">${b.judge}</span><div class="m"><b>${b.sys}/${b.dia}</b> mmHg${b.pulse?' · 맥박 '+h(b.pulse):''}<div class="small muted">${fmtDT(b.at)} · ${h(b.by||'')}${b.note?' · '+h(b.note):''}</div></div></div>`).join(''):'<div class="empty">없음</div>'}</div>
   <h2>사후상담 (${cs.length})</h2><div class="card list">${cs.length?cs.map(c=>`<div class="it" data-cid="${c.id}"><span class="dot d0"><i class="i i-note"></i></span><div class="m"><b>${c.date}</b> <span class="muted">상담 ${h(c.counselor||'')}</span><div class="small muted ell">${c.sys?`혈압 ${c.sys}/${c.dia} · `:''}${h(c.comment||'')}</div></div><i class="i i-print muted"></i></div>`).join(''):'<div class="empty">사후상담 미실시</div>'}</div>`,b=>{
    $('#vc',b).onclick=()=>vulnConsult(p.id);$('#vb',b).onclick=()=>vulnBP(p.id);$('#ve',b).onclick=()=>editVuln(p.id);
    const vp=$('#vp',b);if(vp)vp.onclick=()=>printPages([docVulnConsult(p,cs[0])]);
    $('#vr',b).onclick=async()=>{p.retiredManual=!p.retired;p.retired=!p.retired;await save('vuln',p);showVuln(p.id);R[cur]()};
    $$('[data-cid]',b).forEach(el=>el.onclick=()=>printPages([docVulnConsult(p,p.consults.find(c=>c.id===el.dataset.cid))]));
  });
}
function editVuln(id){
  const p=id?VU.find(x=>x.id===id):{items:[{}]};const its=(p.items&&p.items.length?p.items:[{}]).map(i=>({...i}));
  const row=(i,n)=>`<div class="card" style="padding:10px;margin-bottom:8px" data-row="${n}"><div class="grid g2">${[['exam','검진명'],['grade','건강구분'],['finding','검진소견'],['follow1','사후관리소견'],['follow2','사후관리소견2'],['note','비고']].map(([k,l])=>`<div><label class="f">${l}</label><input class="inp" data-ik="${k}" value="${h(i[k]||'')}"></div>`).join('')}</div></div>`;
  openModal(id?'취약근로자 수정':'취약근로자 추가',`<div class="grid g2">${[['name','성명 *'],['company','업체명 *'],['job','공종'],['age','연령']].map(([k,l])=>`<div><label class="f">${l}</label><input class="inp" data-k="${k}" value="${h(p[k]||'')}" ${k==='company'?'list="companyList"':''}${k==='age'?' inputmode="numeric"':''}></div>`).join('')}</div>${companyDatalist()}
   <label class="f">메모</label><textarea class="inp" data-k="note">${h(p.note||'')}</textarea>
   <h2>검진 항목</h2><div id="irows">${its.map(row).join('')}</div><button class="btn ghost sm" id="iadd"><i class="i i-plus"></i> 항목 추가</button>
   <div class="row" style="margin-top:14px"><button class="btn" id="us" style="flex:1">저장</button>${id&&isAdmin()?'<button class="btn bad" id="ud">삭제</button>':''}</div>`,b=>{
    $('#iadd',b).onclick=()=>$('#irows',b).insertAdjacentHTML('beforeend',row({},$$('[data-row]',b).length));
    $('#us',b).onclick=async()=>{const o={...p,id:p.id||uid(),consults:p.consults||[],bp:p.bp||[]};$$('[data-k]',b).forEach(i=>o[i.dataset.k]=i.value.trim());
      if(!o.name||!o.company)return toast('성명과 업체명은 필수');o.age=String(o.age).replace(/\D/g,'');
      o.items=$$('[data-row]',b).map(r=>{const it={};$$('[data-ik]',r).forEach(i=>it[i.dataset.ik]=i.value.trim());return it}).filter(it=>Object.values(it).some(Boolean));
      if(!id){o.created=nowLocal();o.src='직접입력'}else o.updated=nowLocal();o.retired=!!o.retiredManual||o.items.some(i=>/퇴사/.test(i.note));
      await save('vuln',o);closeModal();R[cur]();showVuln(o.id)};
    const ud=$('#ud',b);if(ud)ud.onclick=async()=>{if(!confirm(`${p.name} 취약근로자 기록(상담·혈압 포함)을 삭제할까요?`))return;await remove('vuln',id);closeModal();R[cur]()};
  });
}
function bpFields(){return `<div class="grid g2"><div><label class="f">수축기 (mmHg)</label><input class="inp big" id="bS" inputmode="numeric" placeholder="120" style="text-align:center"></div><div><label class="f">이완기 (mmHg)</label><input class="inp big" id="bD" inputmode="numeric" placeholder="80" style="text-align:center"></div></div><div class="judge" id="bJ" style="margin-top:10px;background:var(--chip)">—</div>`}
function bindBP(b){const f=()=>{const j=bpJudge(+$('#bS',b).value,+$('#bD',b).value);$('#bJ',b).textContent=j?`${j} (주의 ${S.bp.warn.join('/')} · 위험 ${S.bp.stop.join('/')} 이상)`:'—';$('#bJ',b).className='judge '+(j?'badge '+bpCls(j):'')};$('#bS',b).oninput=f;$('#bD',b).oninput=f}
function vulnBP(id){
  const p=VU.find(x=>x.id===id);
  openModal(`혈압 측정 · ${p.name}`,`${bpFields()}<div class="grid g2"><div><label class="f">맥박</label><input class="inp" id="bP" inputmode="numeric"></div><div><label class="f">측정자</label><input class="inp" id="bBy" value="${h(S.inspector)}"></div></div>
   <label class="f">메모</label><input class="inp" id="bN" placeholder="예) 10분 휴식 후 재측정"><button class="btn xl" id="bSv" style="margin-top:12px">저장</button>`,b=>{
    bindBP(b);setTimeout(()=>$('#bS',b).focus(),50);
    $('#bSv',b).onclick=async()=>{const sy=+$('#bS').value,di=+$('#bD').value;if(!(sy>50&&sy<300&&di>30&&di<200))return toast('혈압 값을 확인하세요');
      (p.bp=p.bp||[]).push({at:nowLocal(),sys:sy,dia:di,pulse:$('#bP').value.trim(),judge:bpJudge(sy,di),by:$('#bBy').value.trim(),note:$('#bN').value.trim()});
      await save('vuln',p);toast(`혈압 ${sy}/${di} · ${bpJudge(sy,di)}`);R[cur]();showVuln(p.id)};
  });
}
function vulnConsult(id){
  const p=VU.find(x=>x.id===id);const sel=(id,opts)=>`<select class="inp" id="${id}"><option value=""></option>${opts.map(o=>`<option>${o}</option>`).join('')}</select>`;
  openModal(`사후상담일지 · ${p.name}`,`<div class="card"><div class="grid g2"><div><label class="f">상담일</label><input class="inp" type="date" id="cDt" value="${today()}"></div><div><label class="f">상담 실시자</label><input class="inp" id="cBy" value="${h(S.inspector)}"></div>
    <div><label class="f">일반건강검진 업무수행적합</label>${sel('cFg',FIT)}</div><div><label class="f">특수건강검진 업무수행적합</label>${sel('cFs',FIT)}</div>
    <div><label class="f">흉부방사선 판독 결과</label><input class="inp" id="cX" placeholder="예) 정상"></div><div><label class="f">뇌심혈관질환 발병위험도 (KOSHA)</label>${sel('cCv',CVD)}</div></div></div>
   <div class="card"><label class="f">혈압 측정 (선택)</label>${bpFields()}</div>
   <div class="card"><label class="f">보호구 수령 확인</label><label class="row"><input type="checkbox" id="cM" style="width:22px;height:22px"> 마스크</label><label class="row"><input type="checkbox" id="cE" style="width:22px;height:22px"> 귀마개</label>
    <label class="f">검사결과에 대해 물어보고 싶은 내용</label><textarea class="inp" id="cQ"></textarea>
    <label class="f">보건관리자 코멘트</label><textarea class="inp" id="cC" placeholder="예) 혈압약 복용 지속, 혹서기 고열작업 시 휴식 준수">${h((p.items||[]).map(i=>i.follow1).filter(Boolean).join(' / '))}</textarea></div>
   <div class="hint" style="margin-bottom:10px">서약: 위의 건강검진 결과에 대해 안내 받았으며, 결과에 따른 현장 조치사항에 성실히 임할 것을 서약합니다.</div>
   <div class="grid g2"><div id="cSw"></div><div id="cSc"></div></div>
   <button class="btn xl" id="cSv" style="margin-top:12px">저장 후 출력</button>`,b=>{
    bindBP(b);const sw=sigPad($('#cSw',b),'서약자(근로자) 서명'),sc=sigPad($('#cSc',b),'상담 실시자 서명',S.mySig);{const _i=$('#cBy');if(_i)_i.addEventListener('change',()=>{_i.value.trim()===S.inspector?sc.useMine():sc.clear()})};
    $('#cSv',b).onclick=async()=>{if(sw.isEmpty())return toast('근로자 서명이 필요합니다');if(sc.isEmpty())return toast('상담 실시자 서명이 필요합니다');
      const sy=+$('#bS').value||0,di=+$('#bD').value||0;if((sy||di)&&!(sy>50&&di>30))return toast('혈압 값을 확인하세요');
      const c={id:uid(),date:$('#cDt').value||today(),counselor:$('#cBy').value.trim(),fitGen:$('#cFg').value,fitSpe:$('#cFs').value,xray:$('#cX').value.trim(),cvd:$('#cCv').value,
        sys:sy||'',dia:di||'',bpJudge:sy?bpJudge(sy,di):'',mask:$('#cM').checked,ear:$('#cE').checked,question:$('#cQ').value.trim(),comment:$('#cC').value.trim(),sigW:sw.data(),sigC:sc.data(),created:nowLocal()};
      (p.consults=p.consults||[]).push(c);if(sy)(p.bp=p.bp||[]).push({at:nowLocal(),sys:sy,dia:di,judge:bpJudge(sy,di),by:c.counselor,note:'사후상담 시 측정'});
      await save('vuln',p);toast('사후상담일지 저장됨');closeModal();R[cur]();printPages([docVulnConsult(p,c)])};
  });
}
function docVulnConsult(p,c){
  const w=W.find(x=>norm(x.name)===norm(p.name)&&compNorm(x.company)===compNorm(p.company));const y=c.date.slice(0,4);const ck=v=>v?'[ ✔ ]':'[&nbsp;&nbsp;&nbsp;&nbsp;]';
  const tbl=(list,first)=>`<table><tr><th style="width:30mm">${first}</th><th style="width:16mm">건강구분</th><th>검진소견</th><th>사후관리소견</th></tr>${list.length?list.map(i=>`<tr><td>${h(i.exam)}</td><td style="text-align:center">${h(i.grade)}</td><td>${h(i.finding)}</td><td>${h([i.follow1,i.follow2].filter(Boolean).join(' / '))}</td></tr>`).join(''):'<tr><td colspan="4" style="text-align:center">해당 없음</td></tr>'}</table>`;
  const its=p.items||[];
  return `<div class="doc"><div class="site">[ ${h(S.site||'현장명')} ]</div><h1>${y}년 ${FT('cTitle')}</h1>
  <table><tr><th>성명</th><td>${h(p.name)}</td><th>업체명</th><td>${h(p.company)}</td></tr>
  <tr><th>공종</th><td>${h(p.job)}</td><th>연령 / 연락처</th><td>${h(p.age)}${p.age?'세':''} / ${h(w&&w.phone||'')}</td></tr></table>
  <div class="sec">♥ 일반건강검진 결과 귀하의 업무수행적합결과는 [ ${h(c.fitGen)||'&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'} ] 입니다.</div>${tbl(its.filter(isGenExam),'검진명')}
  <table><tr><th style="width:45mm">흉부방사선 판독 결과</th><td>${h(c.xray)}</td><th style="width:40mm">뇌심혈관질환 발병위험도</th><td>${h(c.cvd)}</td></tr></table>
  <div class="sec">♥ 특수건강검진 결과 귀하의 업무수행적합결과는 [ ${h(c.fitSpe)||'&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'} ] 입니다.</div>${tbl(its.filter(i=>!isGenExam(i)),'유해인자')}
  <div class="sec">♥ 서약</div>
  <div class="note">${FN('cPledge')}<br>* 보호구 수령 확인 : ${ck(c.mask)} 마스크 &nbsp;&nbsp; ${ck(c.ear)} 귀마개</div>
  <table><tr><th>서약자</th><td>${h(p.company)} &nbsp; ${h(p.name)}</td><td style="width:65mm;text-align:center">${c.sigW?`<img class="sigimg" src="${c.sigW}">`:'(서명)'}</td></tr></table>
  <div class="sec">♥ 검사결과에 대해 의료인 혹은 보건관리자에게 물어보고 싶은 내용</div><div class="note" style="min-height:12mm">${nl(c.question)}</div>
  <div class="sec">♥ 혈압측정 결과</div><div class="note">${c.sys?`${c.sys} / ${c.dia} mmHg (${h(c.bpJudge)})`:'해당없음'}</div>
  <div class="sec">♥ 보건관리자 코멘트</div><div class="note" style="min-height:14mm">${nl(c.comment)}</div>
  <table><tr><th>상담 실시자</th><td>${h(S.inspectorOrg||'')} &nbsp; ${h(c.counselor)} &nbsp;·&nbsp; ${c.date}</td><td style="width:65mm;text-align:center">${c.sigC?`<img class="sigimg" src="${c.sigC}">`:'(서명)'}</td></tr></table></div>`;
}
