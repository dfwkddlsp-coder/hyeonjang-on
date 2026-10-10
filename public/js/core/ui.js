// 현장ON — modal, history(back button), signature pad, photo, pickers
'use strict';
/* ---------- UI primitives ---------- */
/* 화면·창을 브라우저 기록에 남겨서 뒤로가기가 앱 안에서 동작하게 함 */
const NAV={modal:false,stale:false,skip:false};
function openModal(title,html,onMount){if(!NAV.modal){if(!NAV.stale)history.pushState({hj:'m',v:cur},'');NAV.stale=false;NAV.modal=true}document.documentElement.classList.add('no-scroll');$('#mTitle').textContent=title;$('#mBody').innerHTML=html;$('#modal').classList.remove('hidden');onMount&&onMount($('#mBody'))}
function closeModal(fromPop){if(fromPop===true){NAV.modal=false;NAV.stale=false}else if(NAV.modal){NAV.modal=false;NAV.stale=true}document.documentElement.classList.remove('no-scroll');$('#modal').classList.add('hidden');$('#mBody').innerHTML=''}
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
