// 현장ON — 사용자 관리 (operator)
'use strict';
async function loadUsers(){const box=$('#usersBox');if(!box)return;
  try{const r=await api('users');LAST_USERS=r.users;const row=u=>`<div class="it" data-u="${u.id}"><span class="dot d0">${h(u.name.slice(0,1))}</span><div class="m"><b>${h(u.name)}</b> <span class="muted small">${h(u.loginId)}</span> ${u.role!=='user'?roleBadge(u.role):''}${!u.active?' <span class="badge bgray">사용 정지</span>':''}${u.mustChange?' <span class="badge bwarn">첫 로그인 전</span>':''}<div class="small muted ell">${h([u.org,u.title].filter(Boolean).join(' · ')||'-')}</div></div></div>`;
    /* 분류: 운영자·관리자 / 사용자 / 장비운전원 / 사용 정지 — 접기·펼치기는 기기에 기억 */
    const G=[['staff','운영자 · 관리자',u=>u.active&&(u.role==='admin'||u.role==='manager')],['user','사용자',u=>u.active&&u.role==='user'],['driver','장비운전원',u=>u.active&&u.role==='driver'],['off','사용 정지',u=>!u.active]];
    let fold={};try{fold=JSON.parse(localStorage.getItem('hjUserFold')||'{}')}catch(e){}
    const isOpen=k=>fold[k]!==undefined?fold[k]:(k==='staff'||k==='user');
    box.innerHTML=G.map(([k,t,f])=>{const us=r.users.filter(f);if(!us.length)return '';const wait=us.filter(u=>u.mustChange).length;
      return `<details class="ugrp" data-g="${k}" ${isOpen(k)?'open':''}><summary>${t} <span class="muted small">${us.length}명${wait?` · 첫 로그인 전 ${wait}`:''}</span></summary>${us.map(row).join('')}</details>`}).join('')||'<div class="empty">없음</div>';
    $$('details.ugrp',box).forEach(d=>d.ontoggle=()=>{fold[d.dataset.g]=d.open;try{localStorage.setItem('hjUserFold',JSON.stringify(fold))}catch(e){}});
    $$('[data-u]',box).forEach(el=>el.onclick=()=>editUser(r.users.find(u=>u.id===el.dataset.u)))}
  catch(x){box.innerHTML=`<div class="empty">${h(x.status?x.message:'인터넷 연결이 필요합니다')}</div>`}}
let LAST_USERS=[];
/* 여러 명 한 번에 등록: 엑셀·조직도에서 복사해 붙여넣기, 또는 장비 대장의 운전원 불러오기 */
function bulkUsers(){
  openModal('여러 명 등록',`<div class="small muted">한 줄에 한 명 — <b>이름, 휴대폰번호, 소속, 직책</b> (쉼표나 엑셀에서 복사한 칸 그대로). 아이디는 휴대폰 번호 숫자만으로 만들어집니다. 이미 있는 아이디는 건너뜁니다.</div>
    <textarea class="inp" id="buT" rows="9" style="margin-top:8px;font-size:15px" placeholder="홍길동, 010-1234-5678, OO건설, 관리감독자"></textarea>
    <button class="btn sm line" id="buEq" style="margin-top:8px"><i class="i i-equip"></i> 장비 대장 운전원 불러오기</button>
    <div class="grid g2" style="margin-top:10px"><div><label class="f">권한</label><select class="inp" id="buR"><option value="user">사용자</option><option value="manager">관리자</option><option value="driver">장비운전원</option></select></div>
    <div><label class="f">초기 비밀번호 * (6자 이상, 모두 같게)</label><input class="inp" id="buP" type="text" autocomplete="off" autocapitalize="off"></div></div>
    <div class="small muted" style="margin-top:4px">모든 사람이 첫 로그인 때 비밀번호를 바꾸게 됩니다.</div>
    <div id="buMsg" class="small" style="margin-top:8px"></div>
    <button class="btn xl" id="buGo" style="margin-top:10px">등록</button>`,b=>{
    const dg=x=>String(x||'').replace(/\D/g,'');const have=new Set(LAST_USERS.map(u=>dg(u.loginId)||u.loginId));
    $('#buEq',b).onclick=()=>{const by={};for(const e of E){if(e.outDate||!e.operator||!dg(e.phone))continue;const p=dg(e.phone);(by[p]=by[p]||[]).push(e)}
      const lines=[],skip=[];for(const [p,es] of Object.entries(by)){const names=[...new Set(es.map(e=>e.operator.trim()))];
        if(have.has(p))continue;if(names.length>1){skip.push(`${names.join('·')} (같은 번호 ${p})`);continue}lines.push([names[0],p,es[0].company||'','장비운전원'].join(', '))}
      $('#buT',b).value=lines.join('\n');$('#buR',b).value='driver';
      $('#buMsg',b).innerHTML=`아직 계정이 없는 운전원 <b>${lines.length}</b>명을 불러왔습니다.${skip.length?`<br>번호가 겹쳐 뺀 사람: ${h(skip.join(', '))} — 장비 대장 연락처를 고친 뒤 다시 불러오세요.`:''}`};
    $('#buGo',b).onclick=async()=>{const pw=$('#buP',b).value.trim(),role=$('#buR',b).value,msg=$('#buMsg',b),go=$('#buGo',b);
      if(pw.length<6)return toast('초기 비밀번호를 6자 이상 입력하세요');
      const rows=$('#buT',b).value.split('\n').map(l=>l.split(/[,\t]/).map(x=>x.trim())).filter(c=>c[0]||c[1]);
      const bad=rows.filter(c=>!c[0]||!/^\d{10,11}$/.test(dg(c[1])));if(!rows.length)return toast('등록할 사람을 입력하세요');
      if(bad.length)return msg.innerHTML=`<span style="color:var(--bad)">이름이나 휴대폰 번호가 잘못된 줄: ${h(bad.map(c=>c.join(' ')).join(' / '))}</span>`;
      go.disabled=true;let ok=0;const dup=[],err=[];
      for(const [i,c] of rows.entries()){go.textContent=`등록 중… ${i+1}/${rows.length}`;
        try{await api('users',{loginId:dg(c[1]),name:c[0],org:c[2]||'',title:c[3]||'',role,password:pw});ok++}
        catch(x){(x.status===409?dup:err).push(c[0]+(x.status===409?'':` (${x.message})`))}}
      go.disabled=false;go.textContent='등록';
      msg.innerHTML=`등록 <b>${ok}</b>명${dup.length?` · 이미 있어 건너뜀 ${dup.length}명 (${h(dup.join(', '))})`:''}${err.length?`<br><span style="color:var(--bad)">실패: ${h(err.join(', '))}</span>`:''}`;
      if(ok){$('#buT',b).value='';loadUsers();toast(`${ok}명 등록했습니다`)}};
  })}
function editUser(u){const nu=!u;u=u||{};
  openModal(nu?'사용자 등록':'사용자 정보',`<div class="grid g2">
   <div><label class="f">아이디 ${nu?'*':''}</label><input class="inp" id="euL" value="${h(u.loginId||'')}" ${nu?'':'disabled'} autocapitalize="off" autocorrect="off" placeholder="예) 01012345678"></div>
   <div><label class="f">이름 *</label><input class="inp" id="euN" value="${h(u.name||'')}"></div>
   <div><label class="f">소속</label><input class="inp" id="euO" value="${h(u.org||'')}" list="companyList"></div>
   <div><label class="f">직책</label><input class="inp" id="euT" value="${h(u.title||'')}" placeholder="예) 관리감독자"></div>
   <div><label class="f">권한</label><select class="inp" id="euR"><option value="user" ${u.role==='user'?'selected':''}>사용자 (등록·열람, 취약근로자 제외)</option><option value="manager" ${u.role==='manager'?'selected':''}>관리자 (등록·전체 열람, 삭제·설정 불가)</option><option value="driver" ${u.role==='driver'?'selected':''}>장비운전원 (본인 장비 점검만)</option><option value="admin" ${u.role==='admin'?'selected':''}>운영자 (삭제·대장·설정·사용자 관리)</option></select><div class="small muted" style="margin-top:4px">장비운전원은 장비 대장의 <b>운전원 연락처</b>가 아이디(휴대폰 번호)와 같은 장비만 보입니다.</div></div>
   <div><label class="f">${nu?'초기 비밀번호 * (6자 이상)':'비밀번호 초기화 (입력할 때만)'}</label><input class="inp" id="euP" type="text" autocomplete="off" autocapitalize="off"></div></div>
   ${nu?'':`<label class="row" style="margin-top:12px"><input type="checkbox" id="euA" ${u.active?'checked':''} style="width:22px;height:22px"> 사용 가능 (해제하면 바로 로그아웃·로그인 불가)</label>`}
   <div class="small muted" style="margin-top:8px">초기 비밀번호는 본인에게 직접 전달하세요. 첫 로그인 때 새 비밀번호로 바꾸게 됩니다.</div>
   ${companyDatalist()}<button class="btn xl" id="euS" style="margin-top:12px">${nu?'등록':'저장'}</button>`,b=>{
    $('#euS',b).onclick=async()=>{const body={name:$('#euN').value.trim(),org:$('#euO').value.trim(),title:$('#euT').value.trim(),role:$('#euR').value};const pw=$('#euP').value.trim();if(pw)body.password=pw;
      try{if(nu){body.loginId=$('#euL').value.trim();await api('users',body)}else{body.active=$('#euA').checked;await api('users/'+u.id,body)}
        closeModal();toast(nu?'사용자 등록됨':'저장됨');loadUsers()}catch(x){toast(x.status?x.message:'인터넷 연결이 필요합니다')}};
  })}
