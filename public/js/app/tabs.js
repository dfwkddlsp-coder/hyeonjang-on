// 현장ON — sub tabs for 관리대장 / 설정
'use strict';
/* ---------- 하위 탭 (관리대장 / 설정) ---------- */
/* ---------- 설정: 왼쪽 ☰ 카테고리 목록 → 고르면 그 카테고리의 세부 설정 ----------
   k = 카테고리 (섹션 data-st, 현장 기준 묶음의 카드는 data-sc), show = 누구에게 보이나 (2단계에서 권한 설정으로 바뀜) */
const SET_CATS=[
  {k:'me',t:'내 정보',ic:'workers',show:()=>true},
  {k:'noti',t:'알림',ic:'alert',show:()=>SERVER&&isStaff()},
  {k:'site',t:'현장·기준',ic:'settings',show:()=>isAdmin()},
  {k:'forms',t:'카테고리·양식',ic:'sheet',show:()=>isAdmin()},
  {k:'eqform',t:'장비 양식',ic:'equip',show:()=>isAdmin()},
  {k:'excel',t:'엑셀 칸 이름',ic:'import',show:()=>isAdmin()},
  {k:'users',t:'사용자·초대',ic:'workers',show:()=>SERVER&&isAdmin()},
  {k:'guide',t:'안내 봇·의견',ic:'note',show:()=>SERVER&&isAdmin()},
  {k:'records',t:'기록·보고',ic:'records',view:'records',show:()=>isAdmin()},
  {k:'data',t:'데이터·백업',ic:'save',show:()=>isAdmin()},
];
const setCats=()=>SET_CATS.filter(c=>c.show());
/* 넓은 화면은 목록을 왼쪽에 띄워 두고 ☰로 접기 (기기에 기억), 폰은 ☰를 누를 때만 펼침 */
const SET_WIDE=matchMedia('(min-width:1000px)');
let setNavOpen=false;
const setDocked=()=>{try{return localStorage.getItem('hjSetNav')!=='0'}catch(e){return true}};
function setChrome(active){
  const cats=setCats(),cur=cats.find(c=>c.k===active)||cats[0],v=V$();
  const h1=$('h1',v);if(h1)h1.remove();
  const main=document.createElement('div');main.className='set-main';while(v.firstChild)main.appendChild(v.firstChild);
  v.innerHTML=`<div class="set-head"><button type="button" class="set-burger" id="setBurger" aria-label="설정 메뉴" aria-expanded="false"><span></span><span></span><span></span></button><h1>${h(cur.t)}</h1></div>
    <div class="set-wrap"><nav class="set-nav" id="setNav" aria-label="설정 카테고리">${cats.map(c=>`<button type="button" data-cat="${c.k}" class="${c.k===cur.k?'on':''}"><i class="i i-${c.ic}"></i>${h(c.t)}</button>`).join('')}</nav></div><div class="set-dim" id="setDim"></div>`;
  $('.set-wrap',v).appendChild(main);
  const wrap=$('.set-wrap',v),burger=$('#setBurger',v);
  const paint=()=>{const wide=SET_WIDE.matches,open=wide?setDocked():setNavOpen;wrap.classList.toggle('nav-open',open);wrap.classList.toggle('wide',wide);$('#setDim',v).classList.toggle('on',!wide&&open);burger.setAttribute('aria-expanded',String(open))};
  burger.onclick=()=>{if(SET_WIDE.matches){try{localStorage.setItem('hjSetNav',setDocked()?'0':'1')}catch(e){}}else setNavOpen=!setNavOpen;paint()};
  $('#setDim',v).onclick=()=>{setNavOpen=false;paint()};
  $$('[data-cat]',v).forEach(b=>b.onclick=()=>{setNavOpen=false;const c=SET_CATS.find(x=>x.k===b.dataset.cat);if(c.view)go(c.view);else go('settings',c.k)});
  SET_WIDE.onchange=()=>{if($('#setBurger'))paint()};
  paint();
}
function segBar(items,active){
  const h1=$('h1',V$());const html=`<div class="seg">${items.map(([k,l])=>`<button type="button" data-seg="${k}" class="${k===active?'on':''}">${l}</button>`).join('')}</div>`;
  if(h1)h1.insertAdjacentHTML('afterend',html);else V$().insertAdjacentHTML('afterbegin',html);
  $$('[data-seg]',V$()).forEach(b=>b.onclick=()=>{const [v,t]=b.dataset.seg.split(':');go(v,t)});
}
for(const k of ['workers','equip','eqcheck','vuln']){const f=R[k];R[k]=(...a)=>{f(...a);if(!isDriver())segBar(REG_TABS.filter(t=>t[0]!=='vuln'||vulnVisible()),k)}}
{const f=R.records;R.records=(...a)=>{f(...a);if(setCats().some(c=>c.k==='records'))setChrome('records')}}
{const f=R.settings;R.settings=(tab)=>{
  const keys=setCats().map(c=>c.k);if(typeof tab==='string')R.settings.tab=tab;
  let t=R.settings.tab||'me';if(!keys.includes(t)||t==='records')t='me';R.settings.tab=t;
  f();const v=V$();
  $$('section.st',v).forEach(sec=>sec.hidden=!sec.dataset.st.split(' ').includes(t));
  $$('[data-sc]',v).forEach(c=>c.hidden=c.dataset.sc!==t); // 현장 기준 묶음: 고른 세부 카테고리의 카드만
  setChrome(t);if(t==='users'&&typeof loadUsers==='function')loadUsers()}}
