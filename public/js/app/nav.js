// 현장ON — app version, bottom nav, view router (go), view registry R
'use strict';
/* ---------- views ---------- */
const APP_VER='2026.10.10-11';
/* 하위 화면 → 하단 탭 묶음 */
const NAVOF={plans:'home',workers:'reg',equip:'reg',eqcheck:'reg',vuln:'reg',records:'settings'};
const REG_TABS=[['workers','근로자'],['equip','장비'],['eqcheck','장비점검'],['vuln','취약근로자']];
let lastReg='workers';
let cur='home';
const DRIVER_VIEWS=['eqcheck','settings'];
function go(v,arg,fromPop){if(isDriver()&&!DRIVER_VIEWS.includes(v))v='eqcheck';if(v==='reg')v=lastReg;if(NAVOF[v]==='reg')lastReg=v;if(!fromPop&&(v!==cur||arg!==undefined)){history.pushState({hj:'v',v},'');NAV.stale=false}cur=v;document.body.classList.toggle('is-home',v==='home');markNav(v,arg);window.scrollTo(0,0);R[v](arg);try{sessionStorage.setItem('v',v)}catch(e){}}
/* 하단(폰)·왼쪽(PC) 메뉴: 홈 + 홈 화면 타일 전부(홈 화면 배치의 순서·이름·숨기기 그대로) + 설정. 폰에서는 옆으로 밀어서 넘김 */
function navItems(){
  if(isDriver())return [{v:'eqcheck',t:'장비점검'},{v:'settings',t:'내 정보'}];
  const N=hlNames(),out=[{v:'home',t:'홈'}];
  for(const it of homeLayout()){if(it.hide)continue;
    if(it.k.startsWith('d_')){const c=docCats().find(x=>'d_'+x.k===it.k);if(c&&catVisible(c))out.push({v:'plans',arg:c.k,t:it.name||c.name,icon:'plans'});continue}
    if(it.k==='vuln'&&!vulnVisible())continue;
    out.push({v:it.k,t:it.name||N[it.k]})}
  out.push({v:'settings',t:isAdmin()?'설정':'내 정보'});return out}
function renderNav(){const nav=$('#nav');if(!nav)return;
  nav.innerHTML=navItems().map(n=>`<button type="button" data-v="${n.v}"${n.arg?` data-arg="${h(n.arg)}"`:''}><span class="ni"><i class="i i-${n.icon||n.v}"></i></span><span class="nt">${h(n.t)}</span></button>`).join('');
  $$('button',nav).forEach(b=>b.onclick=()=>go(b.dataset.v,b.dataset.arg));
  nav.onscroll=navMore;markNav(cur);requestAnimationFrame(navMore)}
/* 폰: 오른쪽에 메뉴가 더 있으면 끝을 흐리게 */
function navMore(){const n=$('#nav');if(n)n.classList.toggle('more',n.scrollWidth-n.clientWidth-n.scrollLeft>4)}
addEventListener('resize',navMore);
function markNav(v,arg){const key=v==='records'?'settings':v;const cat=v==='plans'?(arg||R.plans.cat||(docCats()[0]||{}).k):null;let on=null;
  $$('#nav button').forEach(b=>{const m=b.dataset.v===key&&(!cat||b.dataset.arg===cat);b.classList.toggle('on',m);if(m)on=b});
  if(on&&on.scrollIntoView)on.scrollIntoView({block:'nearest',inline:'nearest'});navMore()}
const R={};
const V$=()=>$('#view');
