// 현장ON — 폰 알림 (운영자·관리자): 설정 → 알림. 이 기기 알림 켜기/끄기, 알림 종류별·누가 했을 때 켜기/끄기(슬라이드)
'use strict';
const PUSH_FROM={staff:'운영자·관리자가 했을 때',user:'사용자가 했을 때',driver:'장비운전원이 했을 때',guest:'임시 운전원이 했을 때'};
const pushOk=()=>'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
const isIOS=()=>/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const keyBytes=k=>Uint8Array.from(atob(k.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((k.length+3)%4)),c=>c.charCodeAt(0));
async function pushSub(){if(!pushOk())return null;const reg=await navigator.serviceWorker.ready;return reg.pushManager.getSubscription()}
const devName=()=>{const u=navigator.userAgent;return (/iPhone|iPad/.test(u)?'아이폰/아이패드':/Android/.test(u)?'안드로이드':/Windows/.test(u)?'윈도우 PC':/Mac/.test(u)?'맥':'기기')+(standalone()?' (앱)':'')};
async function pushOn(){
  const perm=await Notification.requestPermission();if(perm!=='granted')throw new Error(perm==='denied'?'알림이 차단되었습니다. 폰 설정에서 현장ON 알림을 허용해 주세요':'알림 허용을 눌러야 받을 수 있습니다');
  const reg=await navigator.serviceWorker.ready;const {publicKey}=await api('push/key');
  const sub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(publicKey)});
  await api('push/subscribe',{...sub.toJSON(),device:devName()})}
async function pushOff(){const sub=await pushSub();if(!sub)return;try{await api('push/unsubscribe',{endpoint:sub.endpoint})}catch(e){}await sub.unsubscribe()}
/* 앱을 열 때: 알림을 켜 둔 기기면 서버에 다시 알려 둠 (만료·다른 기기 정리 대비) */
async function pushResync(){try{if(!SERVER||!can('push')||!pushOk()||Notification.permission!=='granted')return;const sub=await pushSub();if(sub)await api('push/subscribe',{...sub.toJSON(),device:devName()})}catch(e){}}

/* 설정 → 알림 */
{const f=R.settings;R.settings=(...a)=>{f(...a);if(!SERVER||!can('push'))return;
  V$().insertAdjacentHTML('beforeend',`<section class="st" data-st="noti">
   <div class="card"><b>이 기기에서 알림 받기</b><div id="nDev" style="margin-top:8px"><div class="small muted">확인 중…</div></div></div>
   <div class="card"><b>알림 방식</b> <span class="small muted">— 나에게만 적용</span><div id="nMode" style="margin-top:6px"></div></div>
   <div class="card"><b>받을 알림</b> <span class="small muted">— 나에게만 적용 · 내가 한 일은 알리지 않음</span><div id="nPref" style="margin-top:6px"><div class="small muted">불러오는 중…</div></div></div>
   <details class="card"><summary><b>폰에서 알림 모양·소리 바꾸기</b></summary><div class="small" style="margin-top:8px;line-height:1.7">
    배너·팝업 모양, 잠금화면 표시, 알림음은 폰이 정합니다.<br>
    <b>안드로이드</b> — 설정 → 애플리케이션 → 현장ON(또는 크롬) → 알림 → "팝업으로 표시", 소리·진동, 잠금화면을 고릅니다.<br>
    <b>아이폰</b> — 설정 → 알림 → 현장ON → 알림 스타일(배너: 일시적/지속적), 소리, 잠금화면을 고릅니다. 아이폰은 아래 "조용히 받기"·"누를 때까지 남기기" 대신 이 설정을 따릅니다.<br>
    알림이 안 오면: 폰의 방해 금지·절전 모드, 현장ON 알림 허용 여부를 확인하고 "시험 알림"을 눌러 보세요.</div></details>
  </section>`);
  if(R.settings.tab==='noti'){drawPushDevice();drawPushPrefs()}}}

async function drawPushDevice(){const box=$('#nDev');if(!box)return;
  if(!pushOk()){box.innerHTML=`<div class="hint small">${isIOS()&&!standalone()?'아이폰은 <b>Safari → 공유 → 홈 화면에 추가</b>로 설치한 현장ON 앱에서만 알림을 받을 수 있습니다 (iOS 16.4 이상). 설치한 앱을 열어 여기서 다시 켜 주세요.':'이 브라우저는 폰 알림을 지원하지 않습니다. 크롬이나 설치한 앱에서 열어 주세요.'}</div>`;return}
  const sub=await pushSub(),perm=Notification.permission;
  box.innerHTML=perm==='denied'?'<div class="hint small" style="color:var(--bad)">이 기기에서 현장ON 알림이 차단되어 있습니다. 폰(또는 브라우저) 설정 → 알림에서 현장ON을 허용한 뒤 다시 열어 주세요.</div>'
    :sub?`<div class="row" style="gap:8px"><span class="grow"><span class="badge bok">켜짐</span> ${h(devName())}</span><button class="btn sm line" id="nTest">시험 알림</button><button class="btn sm line" id="nOff">끄기</button></div>`
    :`<button class="btn" id="nOn" style="width:100%"><i class="i i-alert"></i> 이 기기에서 알림 받기</button><div class="small muted" style="margin-top:6px">누르면 "알림 허용"을 묻습니다. 폰마다 한 번씩 켜 주세요.</div>`;
  const on=$('#nOn');if(on)on.onclick=async()=>{on.disabled=true;try{await pushOn();toast('이 기기에서 알림을 받습니다');setTimeout(()=>api('push/test',{}).catch(()=>{}),300)}catch(x){toast(x.message)}drawPushDevice()};
  const off=$('#nOff');if(off)off.onclick=async()=>{await pushOff();toast('이 기기 알림을 껐습니다');drawPushDevice()};
  const t=$('#nTest');if(t)t.onclick=async()=>{try{const r=await api('push/test',{});toast(`시험 알림을 보냈습니다 (기기 ${r.total}대)`)}catch(x){toast(x.message)}};
}
async function drawPushPrefs(){const box=$('#nPref');if(!box)return;
  let r;try{r=await api('push/prefs')}catch(x){box.innerHTML=`<div class="small muted">${h(navigator.onLine?x.message:'알림 설정은 인터넷 연결이 필요합니다')}</div>`;return}
  const P=r.prefs;
  const mode=$('#nMode');if(mode){mode.innerHTML=[['quiet','조용히 받기','소리·진동 없이 알림만 쌓임 (안드로이드·PC)'],['sticky','누를 때까지 화면에 남기기','저절로 사라지지 않음 (PC·일부 안드로이드)']].map(([k,t,d])=>`<label class="row n-main"><span class="grow"><b>${t}</b><div class="small muted">${d}</div></span>${swHtml(`data-mode="${k}"`,P[k])}</label>`).join('');
    $$('[data-mode]',mode).forEach(c=>c.onchange=()=>{P[c.dataset.mode]=c.checked;save()})}
  box.innerHTML=Object.entries(r.events).map(([k,e])=>{const p=P.events[k];return `<div class="n-ev" data-ev="${k}">
    <label class="row n-main"><span class="grow"><b>${h(e.label)}</b></span>${swHtml(`data-on="${k}"`,p.on)}</label>
    ${e.from.length?`<div class="n-from${p.on?'':' off'}">${e.from.map(s=>`<label class="row"><span class="grow small">${h(PUSH_FROM[s])}</span>${swHtml(`data-src="${k}:${s}"`,p.from[s],'sm')}</label>`).join('')}</div>`:''}</div>`}).join('')
    +`<div class="small muted" style="margin-top:8px">알림을 받는 기기: ${r.devices}대</div>`;
  /* save는 아래에서 정의 — 위 스위치도 같은 저장을 씀 */
  let t=null;var save=()=>{clearTimeout(t);t=setTimeout(async()=>{try{await api('push/prefs',{prefs:P});toast('알림 설정 저장됨')}catch(x){toast(x.message)}},400)};
  $$('[data-on]',box).forEach(c=>c.onchange=()=>{P.events[c.dataset.on].on=c.checked;const fr=c.closest('.n-ev').querySelector('.n-from');if(fr)fr.classList.toggle('off',!c.checked);save()});
  $$('[data-src]',box).forEach(c=>c.onchange=()=>{const [k,s]=c.dataset.src.split(':');P.events[k].from[s]=c.checked;save()});
}
/* 좌우로 미는 켜기/끄기 스위치 */
const swHtml=(attr,on,cls='')=>`<span class="sw ${cls}"><input type="checkbox" role="switch" ${attr} ${on?'checked':''}><i></i></span>`;
