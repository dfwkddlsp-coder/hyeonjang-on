// 현장ON — 설정 → 권한: 역할(관리자·사용자·장비운전원·임시 운전원)마다 세부 권한을 켜고 끔.
// 운영자는 언제나 전부. 실제로 막는 곳은 서버(worker/lib/perms.js, policy.js) — 여기서는 공유 설정 perms만 고침
'use strict';
const PERM_ROLE_N={manager:'관리자',user:'사용자',driver:'운전원',guest:'임시'};
async function loadPerms(){const box=$('#pmBox');if(!box)return;
  let r;try{r=await api('perms')}catch(x){box.innerHTML=`<div class="empty small">${h(navigator.onLine?x.message:'인터넷 연결이 필요합니다')}</div>`;return}
  let T=JSON.parse(JSON.stringify(r.table));
  const head=`<div class="pm-row pm-h"><span></span>${r.roles.map(k=>`<span>${PERM_ROLE_N[k]||k}</span>`).join('')}</div>`;
  const draw=()=>{const groups=[...new Set(r.defs.map(d=>d.group))];
    box.innerHTML=groups.map(g=>`<div class="card"><b>${h(g)}</b>${head}${r.defs.filter(d=>d.group===g).map(d=>`<div class="pm-row"><div class="pm-l">${h(d.label)}${d.note?`<div class="small muted">${h(d.note)}</div>`:''}</div>${r.roles.map(k=>`<label class="pm-c" title="${PERM_ROLE_N[k]||k}">${swHtml(`data-pk="${d.k}" data-pr="${k}" aria-label="${h(d.label)} — ${PERM_ROLE_N[k]||k}"`,T[d.k][k],'sm')}</label>`).join('')}</div>`).join('')}</div>`).join('');
    $$('[data-pk]',box).forEach(c=>c.onchange=()=>{
      if(c.checked&&c.dataset.pk==='set.perms'&&!confirm(`${PERM_ROLE_N[c.dataset.pr]} 모두에게 '권한 설정'을 줄까요?\n\n이 권한이 있으면 그 사람이 스스로 다른 권한을 늘릴 수 있습니다. (운영자 계정은 건드릴 수 없습니다)`)){c.checked=false;return}
      T[c.dataset.pk][c.dataset.pr]=c.checked;$('#pmSave').disabled=false})};
  draw();$('#pmSave').disabled=true;
  $('#pmSave').onclick=async()=>{S.perms=Object.assign({},T,{_users:(S.perms||{})._users||{}});await saveSettings();await queueShared();$('#pmSave').disabled=true;toast('권한 저장됨 — 각 사람의 앱에 곧 적용됩니다')};
  $('#pmReset').onclick=()=>{if(!confirm('모든 권한을 처음 값으로 되돌릴까요? (저장을 눌러야 적용)'))return;
    T=Object.fromEntries(r.defs.map(d=>[d.k,Object.fromEntries(r.roles.map(k=>[k,d.def.includes(k)]))]));draw();$('#pmSave').disabled=false};
}
{const f=R.settings;R.settings=(...a)=>{f(...a);if(!SERVER||!can('set.perms')||R.settings.tab!=='perms')return;
  V$().insertAdjacentHTML('beforeend',`<section class="st" data-st="perms">
    <div class="card"><div class="small muted">역할마다 할 수 있는 일을 켜고 끕니다. <b>운영자는 언제나 모든 권한</b>을 가지며, 운영자 계정은 운영자만 만들고 바꿀 수 있습니다. 바꾼 권한은 각 사람의 앱이 다음 동기화(30초 안팎) 때 적용됩니다.</div>
      <div class="row" style="margin-top:10px;gap:8px"><button class="btn" id="pmSave" disabled>권한 저장</button><button class="btn line" id="pmReset">처음 값으로</button></div></div>
    <div id="pmBox"><div class="empty small">불러오는 중…</div></div></section>`);
  loadPerms()}}

/* 사람별 예외 (사용자 관리 → 사람 누르기): 권한마다 역할대로 / 켜기 / 끄기. 저장은 perms._users[사용자id] */
function userPermsUI(u,box,roleNow){
  let r=null;const mine=Object.assign({},((S.perms||{})._users||{})[u.id]);
  const self=ME&&u.id===ME.id&&!isAdmin();
  const draw=()=>{if(!r)return;const role=roleNow(),n=Object.keys(mine).length;
    const groups=[...new Set(r.defs.map(d=>d.group))];
    box.innerHTML=`<details class="pm-u" ${n?'open':''}><summary><b>이 사람만 다르게</b> <span class="small muted">${n?n+'개 바꿈':'역할대로'}</span></summary>
      <div class="small muted" style="margin:6px 0">${self?'자기 권한은 바꿀 수 없습니다.':`비워 두면 ${PERM_ROLE_N[role]||role} 역할의 권한(설정 → 권한)을 따릅니다.`}</div>
      ${groups.map(g=>`<div class="pm-g">${h(g)}</div>${r.defs.filter(d=>d.group===g).map(d=>{const base=r.table[d.k][role],v=mine[d.k];
        return `<div class="pm-urow"><span class="pm-l">${h(d.label)}</span><select class="inp" data-uk="${d.k}" ${self?'disabled':''}><option value="">역할대로 (${base?'켜짐':'꺼짐'})</option><option value="1" ${v===true?'selected':''}>켜기</option><option value="0" ${v===false?'selected':''}>끄기</option></select></div>`}).join('')}`).join('')}</details>`;
    $$('[data-uk]',box).forEach(sel=>sel.onchange=()=>{const k=sel.dataset.uk;
      if(sel.value==='1'&&k==='set.perms'&&!confirm(`${u.name}님에게 '권한 설정'을 줄까요?\n\n이 권한이 있으면 다른 사람의 권한을 늘릴 수 있습니다. (운영자 계정과 자기 권한은 못 바꿉니다)`)){sel.value=mine[k]===undefined?'':mine[k]?'1':'0';return}
      if(sel.value==='')delete mine[k];else mine[k]=sel.value==='1';$('summary .muted',box).textContent=Object.keys(mine).length?Object.keys(mine).length+'개 바꿈':'역할대로'})};
  box.innerHTML='<div class="small muted" style="margin-top:10px">개별 권한 불러오는 중…</div>';
  api('perms').then(x=>{r=x;draw()}).catch(x=>{box.innerHTML=`<div class="small muted">${h(navigator.onLine?x.message:'개별 권한은 인터넷 연결이 필요합니다')}</div>`});
  const rs=$('#euR');if(rs)rs.addEventListener('change',draw);
  return {save:async()=>{if(!r||self)return;
    const before=JSON.stringify(((S.perms||{})._users||{})[u.id]||{});if(before===JSON.stringify(mine))return;
    const P=Object.assign({},S.perms||{}),U=Object.assign({},P._users||{});
    if(Object.keys(mine).length)U[u.id]=mine;else delete U[u.id];
    P._users=U;S.perms=P;await saveSettings();await queueShared()}};
}
