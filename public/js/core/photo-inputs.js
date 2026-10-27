// 현장ON — 사진 여러 장 입력 칸 (공통 부품: 카테고리 기록·음주측정·의견)
'use strict';
/* 사진 여러 장 입력: 갤러리에서 여러 장을 고르면 빈 칸에 차례로 들어감 (카메라는 한 장씩).
   list = [{src,cap}], max = 최대 장수. opt.cap = 설명칸 안내문, opt.area = 설명을 여러 줄로. 반환: 현재 사진 목록을 돌려주는 함수 */
function photoInputs(host,list,max,opt={}){
  list=list.filter(Boolean);
  const draw=()=>{
    host.className='grid g2';host.style.gap='8px';
    host.innerHTML=list.map((p,i)=>`<div class="card" style="padding:8px;margin:0">
        <div style="position:relative"><img src="${p.src}" style="width:100%;height:150px;object-fit:cover;border-radius:8px;display:block"><span class="badge" style="position:absolute;left:6px;top:6px">${i+1}</span></div>
        ${opt.area?`<textarea class="inp" data-pc="${i}" rows="2" placeholder="${h(opt.cap||'사진 설명')}" style="margin-top:6px">${h(p.cap||'')}</textarea>`:`<input class="inp" data-pc="${i}" value="${h(p.cap||'')}" placeholder="${h(opt.cap||'사진 설명 (선택)')}" style="margin-top:6px">`}
        <div class="row" style="margin-top:6px;gap:6px">${max>1?`<button type="button" class="btn sm line" data-pu="${i}" ${i?'':'disabled'} aria-label="앞으로">◀</button><button type="button" class="btn sm line" data-pd="${i}" ${i<list.length-1?'':'disabled'} aria-label="뒤로">▶</button>`:''}<button type="button" class="btn sm line grow" data-pr="${i}">빼기</button></div></div>`).join('')
      +(list.length<max?`<div class="card" style="padding:8px;margin:0;display:flex;flex-direction:column;justify-content:center;gap:6px;min-height:120px">
        <label class="btn sm"><i class="i i-camera"></i> 촬영<input type="file" accept="image/*" capture="environment" data-pf hidden></label>
        <label class="btn sm line">${max>1?'갤러리 (여러 장 선택)':'갤러리'}<input type="file" accept="image/*" ${max>1?'multiple':''} data-pg hidden></label>
        <div class="small muted" style="text-align:center">${max>1?`${list.length}/${max}장`:'사진 1장'}</div></div>`:'');
    const keep=()=>$$('[data-pc]',host).forEach(x=>{list[+x.dataset.pc].cap=x.value});
    const add=async files=>{keep();const room=max-list.length;const fs=[...files].slice(0,room);
      if(files.length>room)toast(`${max}장까지 넣을 수 있어 ${files.length-room}장은 빠졌습니다`);
      for(const f of fs){try{list.push({src:await compressImg(f),cap:''})}catch(e){toast('읽을 수 없는 사진이 있습니다')}}draw()};
    const pf=$('[data-pf]',host);if(pf)pf.onchange=()=>{add(pf.files);pf.value=''};
    const pg=$('[data-pg]',host);if(pg){const lab=pg.parentElement;lab.onclick=e=>{if(e.target===pg)return;e.preventDefault();withGalleryConsent(()=>pg.click())};pg.onchange=()=>{add(pg.files);pg.value=''}}
    $$('[data-pc]',host).forEach(x=>x.oninput=()=>{list[+x.dataset.pc].cap=x.value});
    $$('[data-pr]',host).forEach(x=>x.onclick=()=>{keep();list.splice(+x.dataset.pr,1);draw()});
    $$('[data-pu]',host).forEach(x=>x.onclick=()=>{keep();const i=+x.dataset.pu;[list[i-1],list[i]]=[list[i],list[i-1]];draw()});
    $$('[data-pd]',host).forEach(x=>x.onclick=()=>{keep();const i=+x.dataset.pd;[list[i+1],list[i]]=[list[i],list[i+1]];draw()})};
  draw();return ()=>{$$('[data-pc]',host).forEach(x=>{if(list[+x.dataset.pc])list[+x.dataset.pc].cap=x.value});return list.slice()}}
