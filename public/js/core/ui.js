// 현장ON — modal, history(back button), signature pad, photo, pickers
'use strict';
/* ---------- UI primitives ---------- */
/* 화면·창을 브라우저 기록에 남겨서 뒤로가기가 앱 안에서 동작하게 함 */
const NAV={modal:false,stale:false,skip:false};
/* 열린 창이 닫혀도 되는지 정함(저장 안 한 사진·점검 등). false를 돌려주면 X·바깥 누르기·뒤로가기로 안 닫힘. 새 창을 열면 지워짐 */
let MODAL_GUARD=null;
function openModal(title,html,onMount){MODAL_GUARD=null;if(!NAV.modal){if(!NAV.stale)history.pushState({hj:'m',v:cur},'');NAV.stale=false;NAV.modal=true}document.documentElement.classList.add('no-scroll');$('#mTitle').textContent=title;$('#mBody').innerHTML=html;$('#modal').classList.remove('hidden');onMount&&onMount($('#mBody'))}
/* 검색창이 있는 화면을 검색창은 그대로 둔 채 다시 그림: 새 화면을 보이지 않는 #view에 그린 뒤(이벤트도 그쪽에 연결됨),
   입력 중인 검색창과 그 바깥 상자들은 남기고 나머지만 새 내용으로 갈아 끼움. 검색창이 한 번도 빠지지 않아
   키보드가 닫혔다 열리거나 한글 조합이 끊기거나(ㅇㅣㅇㅗㅏㅇ) 화면이 깜빡이지 않음. 구조가 다르면 통째로 바꿈 */
function softRender(render,sel){const L=V$(),oi=L&&$(sel,L);if(!oi)return render();
  const N=document.createElement('div');N.id='view';N.className=L.className;N.style.display='none';L.id='';L.parentNode.insertBefore(N,L);
  try{render()}finally{L.id='view'}
  const ni=$(sel,N),pa=[],pb=[];for(let x=oi;x&&x!==L;x=x.parentNode)pa.unshift(x);for(let x=ni;x&&x!==N;x=x.parentNode)pb.unshift(x);
  if(!ni||pa.length!==pb.length||pa.some((x,k)=>x.tagName!==pb[k].tagName)){L.replaceChildren(...N.childNodes);N.remove();return}
  let A=L,B=N;
  pa.forEach((a,k)=>{const b=pb[k],kids=[...B.childNodes],j=kids.indexOf(b);
    if(a!==oi){[...a.attributes].forEach(at=>{if(!b.hasAttribute(at.name))a.removeAttribute(at.name)});[...b.attributes].forEach(at=>a.setAttribute(at.name,at.value))}
    [...A.childNodes].forEach(c=>{if(c!==a)c.remove()});
    kids.slice(0,j).forEach(c=>A.insertBefore(c,a));kids.slice(j+1).forEach(c=>A.appendChild(c));
    A=a;B=b});
  L.className=N.className;N.remove()}
/* 화면을 다시 그리는 검색창: 칠 때마다(0.2초 모아서) 결과를 새로 그리되 검색창 자체는 건드리지 않음(softRender) */
function bindSearch(sel,set,render){const i=$(sel);if(!i)return;let t;
  const go=()=>{clearTimeout(t);t=setTimeout(()=>{if(i.isConnected)softRender(render,sel)},200)};
  i.addEventListener('input',()=>{set(i.value);go()});i.addEventListener('compositionend',()=>{set(i.value);go()})}
function closeModal(fromPop){if(MODAL_GUARD&&!$('#modal').classList.contains('hidden')&&!MODAL_GUARD()){if(fromPop===true)history.pushState({hj:'m',v:cur},'');return}MODAL_GUARD=null;if(fromPop===true){NAV.modal=false;NAV.stale=false}else if(NAV.modal){NAV.modal=false;NAV.stale=true}document.documentElement.classList.remove('no-scroll');$('#modal').classList.add('hidden');$('#mBody').innerHTML=''}
$('#mClose').onclick=()=>closeModal();
addEventListener('popstate',e=>{
  if(!$('#modal').classList.contains('hidden')){closeModal(true);return}
  if(NAV.stale){NAV.stale=false;history.back();return} // 이미 닫힌 창 자리 건너뛰기
  const st=e.state||{};const v=st.v&&R[st.v]?st.v:'home';go(v,undefined,true);
});
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});
try{history.replaceState({hj:'v',v:'home'},'')}catch(e){}

function sigPad(host,label,preset){
  host.innerHTML=`<div class="sig"><div class="sig-h"><span>${h(label)}<small class="muted sig-auto" style="font-weight:500"></small></span><button type="button" class="btn sm ghost">지우기</button></div><canvas></canvas></div>`;
  const cv=$('canvas',host),ctx=cv.getContext('2d');let empty=true,drawing=false,last=null;
  const tag=t=>{$('.sig-auto',host).textContent=t?' · '+t:''};
  const drawImg=src=>{const im=new Image();im.onload=()=>{const r=cv.getBoundingClientRect();const sc=Math.min(r.width/im.width,r.height/im.height)*.9;const w=im.width*sc,hh=im.height*sc;ctx.drawImage(im,(r.width-w)/2,(r.height-hh)/2,w,hh);empty=false;tag('내 서명 자동 입력')};im.src=src};
  const setup=()=>{const r=cv.getBoundingClientRect();if(!r.width)return;const d=window.devicePixelRatio||1;cv.width=r.width*d;cv.height=r.height*d;ctx.setTransform(d,0,0,d,0,0);ctx.lineWidth=2.6;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#111';empty=true;if(preset)drawImg(preset)};
  requestAnimationFrame(setup);
  const pos=e=>{const r=cv.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top]};
  cv.addEventListener('pointerdown',e=>{if(!cv.width)setup();drawing=true;try{cv.setPointerCapture(e.pointerId)}catch(x){}last=pos(e);ctx.beginPath();ctx.arc(last[0],last[1],1.2,0,7);ctx.fillStyle='#111';ctx.fill();empty=false;e.preventDefault()});
  cv.addEventListener('pointermove',e=>{if(!drawing)return;const p=pos(e);ctx.beginPath();ctx.moveTo(last[0],last[1]);ctx.lineTo(p[0],p[1]);ctx.stroke();last=p;e.preventDefault()});
  ['pointerup','pointercancel','pointerleave'].forEach(t=>cv.addEventListener(t,()=>drawing=false));
  const clear=()=>{ctx.clearRect(0,0,cv.width,cv.height);empty=true;tag('')};
  $('button',host).onclick=clear;
  cv.addEventListener('pointerdown',()=>tag(''),{capture:true});
  /* iOS: 손가락이 서명칸 위에 있는 동안은 페이지·창이 절대 스크롤되지 않게 */
  ['touchstart','touchmove','touchend'].forEach(t=>cv.addEventListener(t,e=>{if(e.cancelable)e.preventDefault()},{passive:false}));
  cv.addEventListener('pointerdown',()=>document.documentElement.classList.add('no-scroll'));
  ['pointerup','pointercancel'].forEach(t=>cv.addEventListener(t,()=>{if($('#modal').classList.contains('hidden'))document.documentElement.classList.remove('no-scroll')}));
  return {isEmpty:()=>empty,data:()=>empty?'':cv.toDataURL('image/png'),clear,useMine:()=>{clear();if(S.mySig)drawImg(S.mySig)}};
}
function compressImg(file,max=1024,q=.65){return new Promise((res,rej)=>{const img=new Image(),url=URL.createObjectURL(file);
  img.onload=()=>{const s=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);res(c.toDataURL('image/jpeg',q))};
  img.onerror=rej;img.src=url})}

function personPicker(host,onPick,opts={}){
  host.innerHTML=`<input class="inp big" type="search" name="q_${Date.now()}" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" placeholder="${opts.ph||'이름·업체·직종·차량번호'}" autocomplete="off"><div class="pick-res"></div>`;
  const inp=$('input',host),res=$('.pick-res',host);
  const draw=()=>{const q=norm(inp.value);if(!q){res.innerHTML='';return}
    const ws=W.filter(w=>norm([w.name,w.company,w.job,w.helmet,w.phone].join(' ')).includes(q)).slice(0,8)
      .map(w=>({name:w.name,company:w.company,job:w.job,birth:w.birth,helmet:w.helmet,workerId:w.id}));
    const es=E.filter(e=>e.operator&&norm([e.operator,e.company,e.plate,e.type].join(' ')).includes(q)).slice(0,6)
      .map(e=>{const w=W.find(x=>pkey(x.name,x.company)===pkey(e.operator,e.company));return {name:e.operator,company:e.company,job:(w&&w.job)||'장비운전원',helmet:w&&w.helmet,workerId:w&&w.id,equip:e.type,plate:e.plate}});
    const all=[...ws,...es];
    res.innerHTML=all.map((p,i)=>{const k=pkey(p.name,p.company);const n=strikesOf(k).length;const ban=isBanned(k);
      return `<button type="button" data-i="${i}"><span class="dot ${ban?'d3':n?'d'+Math.min(n,3):'d0'}">${ban?'퇴출':n?n+'회':'—'}</span><span class="m" style="flex:1;min-width:0"><b>${h(p.name)}</b> <span class="muted">${h(p.company||'')}</span><div class="small muted ell">${h(p.job||'')}${p.equip?' · 장비 '+h(p.equip)+' '+h(p.plate||''):''}${vulnOf(p.name,p.company)?' · <b style="color:var(--bad)">취약근로자</b>':''}</div></span></button>`}).join('')
      +`<button type="button" data-new="1"><span class="dot d0"><i class="i i-plus"></i></span><span><b>직접 입력</b> <span class="muted">"${h(inp.value)}" 대장에 없는 사람</span></span></button>`;
    $$('button',res).forEach(b=>b.onclick=()=>{res.innerHTML='';if(b.dataset.new){manualPerson(inp.value,onPick)}else onPick(all[+b.dataset.i]);inp.value=''});
  };
  inp.oninput=draw;if(opts.focus)setTimeout(()=>inp.focus(),50);
  return inp;
}
function manualPerson(name,onPick){
  openModal('대상자 직접 입력',`<label class="f">성명 *</label><input class="inp" id="mpN" value="${h(name)}"><label class="f">소속업체 *</label>${comboHtml('mpC','company','','업체명 직접 입력')}<label class="f">직종</label>${comboHtml('mpJ','job','','직종 직접 입력')}
  <label class="row" style="margin-top:12px"><input type="checkbox" id="mpAdd" checked style="width:22px;height:22px"> 근로자 관리대장에도 추가</label><div style="margin-top:14px"><button class="btn" id="mpOk" style="width:100%">확인</button></div>${companyDatalist()}`,b=>{
    bindCombos(b);
    $('#mpOk',b).onclick=async()=>{const p={name:$('#mpN').value.trim(),company:$('#mpC').value.trim(),job:$('#mpJ').value.trim()};
      if(!p.name||!p.company)return toast('성명과 소속업체를 입력하세요');
      if($('#mpAdd').checked){const w={id:uid(),...p,created:nowLocal(),src:'직접입력'};await save('workers',w);p.workerId=w.id}
      closeModal();onPick(p)}});
}
/* 업체·직종 선택칸: 근로자 대장(+장비·취약근로자·기존 기록)에 있는 값에서 고르고, 없으면 직접 입력 */
function choices(kind){const set=new Set();const add=v=>{v=String(v||'').trim();if(v)set.add(v)};
  if(kind==='company'){W.forEach(w=>add(w.company));E.forEach(e=>add(e.company));VU.forEach(p=>add(p.company))}
  else{W.forEach(w=>add(w.job));V.forEach(v=>add(v.job));A.forEach(a=>add(a.job))}
  return [...set].sort((a,b)=>a.localeCompare(b,'ko'))}
function comboHtml(id,kind,value,ph,attrs=''){
  value=String(value||'').trim();const opts=choices(kind);
  if(!opts.length)return `<input class="inp" id="${id}" value="${h(value)}" placeholder="${h(ph)}" ${attrs}>`;
  const custom=!!value&&!opts.includes(value);
  return `<div class="combo"><select class="inp" data-combo-for="${id}"><option value="">선택하세요</option>${opts.map(o=>`<option value="${h(o)}" ${o===value?'selected':''}>${h(o)}</option>`).join('')}<option value="__custom" ${custom?'selected':''}>직접 입력…</option></select>
    <input class="inp" id="${id}" value="${h(value)}" placeholder="${h(ph)}" ${attrs} style="margin-top:6px${custom?'':';display:none'}"></div>`}
function bindCombos(root=document){$$('[data-combo-for]',root).forEach(sel=>{const inp=$('#'+sel.dataset.comboFor,root)||document.getElementById(sel.dataset.comboFor);if(!inp)return;
  sel.onchange=()=>{if(sel.value==='__custom'){inp.style.display='';inp.value='';inp.focus()}else{inp.style.display='none';inp.value=sel.value}}})}
function companyDatalist(){const set=new Set([...W.map(w=>w.company),...E.map(e=>e.company)].filter(Boolean));return `<datalist id="companyList">${[...set].map(c=>`<option value="${h(c)}">`).join('')}</datalist>`}
const lvDot=l=>`<span class="dot d${l}">${l}차</span>`;
const stickerHtml=(l,date)=>{const c=['','var(--l1)','var(--l2)','var(--l3)'][l];return `<div class="sticker" style="background:${c};color:${l===1?'#4a3900':'#fff'}"><div class="a">${l}차 위반</div><div class="b">${date.slice(2).replace(/-/g,'.')}</div></div>`};

/* 갤러리 사진 사용 동의 (기기당 1회, 설정에서 철회 가능) */
function withGalleryConsent(go){
  if(S.galleryConsent)return go();
  /* 별도 레이어: 열려 있는 작성 창(통지서·사진 등)을 닫지 않음 */
  const ov=document.createElement('div');ov.className='modal';ov.style.zIndex=80;ov.innerHTML=`<div class="sheet" style="max-width:520px"><div class="sheet-h"><b>갤러리 사진 사용 동의</b></div><div class="card"><p style="margin-top:0">현장 사진을 휴대폰·태블릿 <b>갤러리(사진첩)</b>에서 불러오려면 동의가 필요합니다.</p>
   <ul class="small" style="padding-left:18px;line-height:1.7;margin:0"><li>직접 고른 사진만 불러오며, 다른 사진에는 접근하지 않습니다.</li><li>불러온 사진은 적발 기록에 첨부되어 <b>이 기기 안에만</b> 저장되고 외부로 전송되지 않습니다.</li><li>처음 한 번은 기기에서 사진 접근 허용을 물어볼 수 있습니다.</li><li>동의는 설정 화면에서 언제든 철회할 수 있습니다.</li></ul></div>
   <div class="grid g2"><button class="btn xl" id="gcOk">동의하고 사진 선택</button><button class="btn xl line" id="gcNo">동의 안 함</button></div></div>`;
  document.body.appendChild(ov);
  $('#gcNo',ov).onclick=()=>ov.remove();
  $('#gcOk',ov).onclick=()=>{S.galleryConsent={at:nowLocal()};saveSettings();ov.remove();go()};
}
/* 두 번 탭 방지: 큰 버튼(저장·등록 등)을 0.7초 안에 다시 누르면 무시 → 같은 기록이 두 번 저장되지 않게.
   입력 칸·라벨은 제외: 라벨(.btn) 안의 파일 칸은 라벨을 누르면 브라우저가 안쪽 칸을 한 번 더 눌러서, 막으면 파일 창이 안 열림 */
{let lastBtn=null,lastAt=0;document.addEventListener('click',e=>{if(!e.isTrusted||!e.target.closest||e.target.closest('input,select,textarea,label'))return;const b=e.target.closest('.btn:not(.sm)');if(!b)return;
  const t=Date.now();if(b===lastBtn&&t-lastAt<700){e.stopImmediatePropagation();e.preventDefault();return}lastBtn=b;lastAt=t},true)}
/* 파일 끌어다 놓기(PC): 탐색기에서 파일을 화면에 끌어다 놓으면, 놓은 자리에서 가장 가까운 "형식이 맞는" 파일 버튼에 넣고
   그 버튼을 눌러 고른 것과 똑같이 처리함(엑셀 불러오기·PDF·사진 등). 파일 버튼이 보이는 화면에서만 동작하므로 권한도 그대로 따름.
   카메라 전용 칸(capture)은 제외. 맞는 칸이 여러 개라 고를 수 없으면 버튼 위에 놓아 달라고 안내함 */
{
  const hasFiles=e=>[...(e.dataTransfer&&e.dataTransfer.types||[])].includes('Files');
  const root=()=>$('#modal').classList.contains('hidden')?$('#view'):$('#mBody');
  const fileOk=(inp,f)=>{const acc=(inp.accept||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);if(!acc.length)return true;
    const name=(f.name||'').toLowerCase(),type=(f.type||'').toLowerCase();
    return acc.some(a=>a.startsWith('.')?name.endsWith(a):a.endsWith('/*')?type.startsWith(a.slice(0,-1)):type===a)};
  const inputs=el=>[...el.querySelectorAll('input[type=file]:not([capture]):not([disabled])')];
  /* 놓은 자리에서 위로 올라가며, 맞는 파일 칸이 딱 하나 들어 있는 가장 가까운 상자를 찾음 */
  const pick=(target,files)=>{const top=root();if(!top)return {};let el=target instanceof Element&&top.contains(target)?target:top;
    for(;el;el=el===top?null:el.parentElement){const c=inputs(el).filter(i=>files.some(f=>fileOk(i,f)));if(c.length===1)return {inp:c[0],box:el};if(c.length>1)return {many:true}}
    return {}};
  const mark=box=>{$$('.drop-on').forEach(x=>x!==box&&x.classList.remove('drop-on'));if(box)box.classList.add('drop-on')};
  /* 끄는 중에는 파일 이름을 알 수 없어서(브라우저 보안) 형식 대신 "파일 칸이 하나뿐인 상자"로 표시만 함 */
  document.addEventListener('dragover',e=>{if(!hasFiles(e))return;e.preventDefault();
    const top=root();let el=e.target instanceof Element&&top&&top.contains(e.target)?e.target:top,box=null;
    for(;el;el=el===top?null:el.parentElement){const n=inputs(el).length;if(n===1){const i=inputs(el)[0];box=i.closest('label')||el;break}if(n>1)break}
    e.dataTransfer.dropEffect=box?'copy':'none';mark(box)});
  document.addEventListener('dragleave',e=>{if(!e.relatedTarget)mark(null)});
  document.addEventListener('drop',e=>{if(!hasFiles(e))return;e.preventDefault();mark(null);
    const files=[...e.dataTransfer.files];if(!files.length)return;
    const r=pick(e.target,files);
    if(r.many){toast('넣을 버튼 위에 끌어다 놓아 주세요');return}
    if(!r.inp){toast(inputs(root()||document.body).length?'이 형식의 파일은 여기에 넣을 수 없어요':'이 화면에는 파일을 넣을 곳이 없어요');return}
    const ok=files.filter(f=>fileOk(r.inp,f)),use=r.inp.multiple?ok:ok.slice(0,1);
    const dt=new DataTransfer();use.forEach(f=>dt.items.add(f));r.inp.files=dt.files;
    r.inp.dispatchEvent(new Event('change',{bubbles:true}));
    if(use.length<files.length)toast(`${files.length-use.length}개 파일은 형식이 맞지 않거나 한 개만 넣을 수 있어 빠졌어요`)});
}
