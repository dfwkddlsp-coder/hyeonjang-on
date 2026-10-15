// 현장ON — app version, bottom nav, view router (go), view registry R
'use strict';
/* ---------- views ---------- */
const APP_VER='2026.10.16-2';
/* 하위 화면 → 하단 탭 묶음 */
const NAVOF={plans:'home',workers:'reg',equip:'reg',eqcheck:'reg',vuln:'reg',records:'settings'};
const REG_TABS=[['workers','근로자'],['equip','장비'],['eqcheck','장비점검'],['vuln','취약근로자']];
let lastReg='workers';
let cur='home';
/* 화면마다 보려면 필요한 권한 (설정 → 권한). 홈은 장비점검 말고 볼 것이 하나라도 있을 때 */
const VIEW_OK={strike:()=>can('strike.view'),alcohol:()=>can('alc.view'),workers:()=>can('workers.view'),equip:()=>can('equip.view'),
  eqcheck:()=>can('eq.mgr')||can('eq.drv')||can('eq.other'),vuln:()=>can('vuln.view'),plans:()=>can('records.view'),recs:()=>can('records.view'),records:()=>can('set.records'),settings:()=>true};
const viewOk=v=>v==='home'?['strike','alcohol','workers','equip','vuln','plans'].some(x=>VIEW_OK[x]()):(VIEW_OK[v]?VIEW_OK[v]():true);
function go(v,arg,fromPop){if(v!=='reg'&&!viewOk(v)){v=viewOk('home')?'home':viewOk('eqcheck')?'eqcheck':'settings';arg=undefined}if(v==='reg')v=lastReg;if(NAVOF[v]==='reg')lastReg=v;if(!fromPop&&(v!==cur||arg!==undefined)){history.pushState({hj:'v',v},'');NAV.stale=false}cur=v;document.body.classList.toggle('is-home',v==='home');markNav(v,arg);window.scrollTo(0,0);R[v](arg);try{sessionStorage.setItem('v',v)}catch(e){}}
/* 하단(폰)·왼쪽(PC) 메뉴: 홈 + 홈 화면 타일 전부(홈 화면 배치의 순서·이름·숨기기 그대로) + 설정. 폰에서는 옆으로 밀어서 넘김 */
function navItems(){
  const setT=typeof setCats==='function'&&setCats().length>1?'설정':'내 정보';
  if(!viewOk('home'))return [...(viewOk('eqcheck')?[{v:'eqcheck',t:'장비점검'}]:[]),{v:'settings',t:setT}];
  const N=hlNames(),out=[{v:'home',t:'홈'}];
  for(const it of homeLayout()){if(it.hide)continue;
    if(it.k.startsWith('d_')){const c=docCats().find(x=>'d_'+x.k===it.k);if(c&&catVisible(c))out.push({v:'plans',arg:c.k,t:it.name||c.name,icon:'plans'});continue}
    if(!viewOk(it.k))continue;
    out.push({v:it.k,t:it.name||N[it.k]})}
  out.push({v:'settings',t:setT});return out}
function renderNav(){const nav=$('#nav');if(!nav)return;
  nav.innerHTML=navItems().map(n=>`<button type="button" data-v="${n.v}"${n.arg?` data-arg="${h(n.arg)}"`:''}><span class="ni"><i class="i i-${n.icon||n.v}"></i></span><span class="nt">${h(n.t)}</span></button>`).join('');
  $$('button',nav).forEach(b=>b.onclick=()=>go(b.dataset.v,b.dataset.arg));
  nav.onscroll=()=>{navMore();navDial()};if(!nav.dataset.dial){nav.dataset.dial='1';navDialBind(nav)}
  markNav(cur);requestAnimationFrame(()=>{navMore();navDialLook()})}
/* 폰: 오른쪽에 메뉴가 더 있으면 끝을 흐리게 */
function navMore(){const n=$('#nav');if(n)n.classList.toggle('more',n.scrollWidth-n.clientWidth-n.scrollLeft>4)}
addEventListener('resize',navMore);
function markNav(v,arg){const key=v==='records'?'settings':v;const cat=v==='plans'?(arg||R.plans.cat||(docCats()[0]||{}).k):null;let on=null;
  $$('#nav button').forEach(b=>{const m=b.dataset.v===key&&(!cat||b.dataset.arg===cat);b.classList.toggle('on',m);if(m)on=b});
  if(on&&on.scrollIntoView)on.scrollIntoView({block:'nearest',inline:'nearest'});navMore();navDialLook()}
const R={};
const V$=()=>$('#view');
