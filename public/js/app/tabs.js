// 현장ON — sub tabs for 관리대장 / 설정
'use strict';
/* ---------- 하위 탭 (관리대장 / 설정) ---------- */
/* 설정 탭: 모두 내 정보, 관리자는 + 알림, 운영자는 전부 */
function setTabs(){const adm=isAdmin(),noti=SERVER&&isStaff()?[['settings:noti','알림']]:[];if(!adm)return [['settings:me','내 정보'],...noti];return [['settings:me','내 정보'],...(adm?[['settings:site','현장 기준']]:[]),...(SERVER&&adm?[['settings:users','사용자 관리'],['settings:guide','안내·의견']]:[]),...noti,['records','기록·보고'],['settings:data','데이터·앱']]}
function segBar(items,active){
  const h1=$('h1',V$());const html=`<div class="seg">${items.map(([k,l])=>`<button type="button" data-seg="${k}" class="${k===active?'on':''}">${l}</button>`).join('')}</div>`;
  if(h1)h1.insertAdjacentHTML('afterend',html);else V$().insertAdjacentHTML('afterbegin',html);
  $$('[data-seg]',V$()).forEach(b=>b.onclick=()=>{const [v,t]=b.dataset.seg.split(':');go(v,t)});
}
for(const k of ['workers','equip','eqcheck','vuln']){const f=R[k];R[k]=(...a)=>{f(...a);if(!isDriver())segBar(REG_TABS.filter(t=>t[0]!=='vuln'||vulnVisible()),k)}}
{const f=R.records;R.records=(...a)=>{f(...a);segBar(setTabs(),'records')}}
{const f=R.settings;R.settings=(tab)=>{
  const tabs=setTabs().map(x=>x[0]);if(typeof tab==='string')R.settings.tab=tab;
  let t=R.settings.tab||'me';if(!tabs.includes('settings:'+t))t='me';R.settings.tab=t;
  f();$$('section.st',V$()).forEach(sec=>sec.hidden=!sec.dataset.st.split(' ').includes(t));
  segBar(setTabs(),'settings:'+t);if(t==='users'&&typeof loadUsers==='function')loadUsers()}}
