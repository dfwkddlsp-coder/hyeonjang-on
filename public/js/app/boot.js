// 현장ON — startup
'use strict';
/* ---------- boot ---------- */
async function loadAll(){[W,E,V,A,VU,EC,PL,RC]=await Promise.all(STORE_NAMES.map(s=>DB.all(s)))}
function lockScreen(){return new Promise(res=>{if(!S.pin)return res();const d=document.createElement('div');d.className='lock';d.innerHTML=`<img src="icon.svg" alt="" style="width:84px;height:84px;border-radius:20px;box-shadow:0 0 0 3px rgba(255,255,255,.25)"><div style="font-size:28px;font-weight:900">현장ON</div><div style="opacity:.8;font-size:14px;margin-top:-6px">습관이 된 노력을 실력이라 한다.</div><div style="margin-top:10px">PIN 입력</div><input class="inp" type="password" inputmode="numeric" maxlength="6" autofocus>`;document.body.appendChild(d);const i=$('input',d);i.focus();i.oninput=()=>{if(i.value===S.pin){d.remove();res()}else if(i.value.length>=S.pin.length){i.value='';i.style.outline='3px solid #f66'}}})}

(async()=>{
  try{await DB.open()}catch(e){V$().innerHTML='<div class="card">이 브라우저에서 저장소를 열 수 없습니다. 시크릿 모드가 아닌 일반 창에서 열어주세요.</div>';return}
  await loadSettings();await loadAll();
  if(location.protocol.startsWith('http')&&await authGate())await loadAll();
  if(SERVER){const sv=Object.keys(STORE).join(',');if(await kvGet('storeSet')!==sv){await kvSet('lastSync',0);await kvSet('storeSet',sv)}}
  await lockScreen();
  $('#siteName').textContent=S.site;renderNav();badge();
  {const g=$('#gearBtn');g.hidden=!isAdmin();g.onclick=()=>go('settings','site')}
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
