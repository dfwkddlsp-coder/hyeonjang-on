// 현장ON — startup
'use strict';
/* ---------- boot ---------- */
async function loadAll(){[W,E,V,A,VU,EC,PL,RC,SC]=await Promise.all(STORE_NAMES.map(s=>DB.all(s)))}

(async()=>{
  try{await DB.open()}catch(e){V$().innerHTML='<div class="card">이 브라우저에서 저장소를 열 수 없습니다. 시크릿 모드가 아닌 일반 창에서 열어주세요.</div>';return}
  await loadSettings();if('pin' in S){delete S.pin;saveSettings()} // 기기 잠금 PIN 기능을 뺌 (2026-11-16): 예전에 켜 둔 기기도 값을 지움
  await loadAll();
  if(location.protocol.startsWith('http')&&await authGate())await loadAll();
  if(SERVER){const sv=Object.keys(STORE).join(',');if(await kvGet('storeSet')!==sv){await kvSet('lastSync',0);await kvSet('storeSet',sv)}}
  $('#siteName').textContent=S.site;renderNav();badge();gbFab();pushResync();
  {const g=$('#gearBtn');g.hidden=false;g.onclick=()=>go('settings',can('set.site')?'site':'me')} // 설정은 누구나(최소 내 정보). 홈에서는 아래 메뉴가 숨겨져 이 버튼이 유일한 길
  $('#brandHome').onclick=e=>{e.preventDefault();if($('#modal').classList.contains('hidden'))go('home');else{closeModal();go('home')}};
  addEventListener('online',()=>{badge();Sync.run()});addEventListener('offline',badge);
  if(SERVER){purgeVulnIfHidden();Sync.run();setInterval(()=>{if(document.visibilityState==='visible')Sync.run()},30000);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')Sync.run()})}
  let v='home';try{v=sessionStorage.getItem('v')||'home'}catch(e){}go(R[v]?v:'home');
  if('serviceWorker' in navigator&&location.protocol.startsWith('http')){
    /* 새 버전 자동 적용: 열 때·다시 볼 때 확인. 입력 중이면 끊지 않고 상단에 '업데이트' 버튼만 띄움 */
    const hadCtl=!!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(reg=>{
      const chk=()=>reg.update().catch(()=>{});chk();
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')chk()});
    }).catch(()=>{});
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(!hadCtl)return;
      const busy=!$('#modal').classList.contains('hidden')||(cur!=='home'&&$('canvas',V$()));
      if(!busy)return location.reload();
      if($('#updBtn'))return;const b=document.createElement('button');b.id='updBtn';b.className='btn sm';b.textContent='새 버전 적용';b.onclick=()=>location.reload();$('.top .sp').after(b);
    });
  }
  if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});
})();
