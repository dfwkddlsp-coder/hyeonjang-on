// 현장ON — 장비 점검: 주간 점검표 · 주간 사진 입력
'use strict';
function eqWeekForm(eid,mon,fresh,tr){
  tr=tr||myTrack();const ro=tr!==myTrack()||!eqCanCheck(),drvT=tr==='drv'; // ro: 관리자가 운전원 점검을 볼 때 (고칠 수 없음)
  const e=E.find(x=>x.id===eid);if(!e)return;const prev=eqWeekRec(eid,mon,tr);const items=prev&&!fresh?eqWeekItems(e,prev):eqItemsFor(e),days=weekDays(mon),t=today();
  const st={marks:{},notes:{...(prev&&prev.notes||{})}};
  for(const it of items)st.marks[it.t]=[...((prev&&prev.marks&&prev.marks[it.t])||['','','','','',''])];
  /* 예전 방식 하루 기록이 있으면 빈칸에 채워 넣음 */
  if(!drvT)days.forEach((d,i)=>{const c=eqLegacyDay(eid,d);if(c)c.items.forEach(x=>{if(st.marks[x.t]&&!st.marks[x.t][i])st.marks[x.t][i]=x.v;if(x.note&&!st.notes[x.t])st.notes[x.t]=x.note})});
  const SYM=MARK_SYM,NEXT={'':'O',O:'X',X:'N',N:'E',E:''};
  openModal(`${drvT?'운전원 점검':'주간 점검표'}${ro?' (보기)':''} · ${eqName(e)}`,`<div class="card"><dl class="kv"><dt>소속협력사</dt><dd>${h(e.company||'-')}</dd><dt>장비</dt><dd>${h(eqName(e))}</dd><dt>전담관리자</dt><dd>${h(e.manager||'미지정')}</dd><dt>점검표 양식</dt><dd>${!can('equip.add')||ro?h(eqFormName(e)):`<select class="inp" id="wkF" style="padding:4px 6px;width:auto">${eqForms().map(f=>`<option value="${h(f.k)}" ${eqFormOf(e)===f?'selected':''}>${h(f.name)}</option>`).join('')}<option value="base" ${eqFormOf(e)?'':'selected'}>기본 (굴착기 등)</option></select>`}</dd></dl>
     <div style="margin-top:8px"><b>${weekLabel(mon)}</b> <span class="muted small">(${md(days[0])}~${md(days[5])})</span> <span id="wkStamp"></span></div></div>
   ${items.some(it=>it.d)?'':'<!--'}<details class="card small"><summary><b>점검 방법 보기</b> (${h(eqFormName(e))})</summary>${items.map((it,i)=>`<div style="margin-top:8px"><b>${i+1}. ${h(it.t)}</b><div class="muted">${h(it.d)}</div></div>`).join('')}</details>${items.some(it=>it.d)?'':'-->'}
   <div class="row" style="margin-bottom:8px"><span class="grow small muted">칸을 누르면 ○적합 ×부적합 -해당없음 △기타 순으로 바뀜</span>${ro?'':'<button class="btn sm ghost" id="wkAll">오늘까지 모두 ○</button>'}</div>
   <div class="wkwrap"><table class="wkt"><tr><th class="it">점검 항목</th>${days.map((d,i)=>`<th><button type="button" class="wkh" data-col="${i}" ${d>t?'disabled':''}>${WD6[i]}<br><small>${md(d)}</small></button></th>`).join('')}</tr>
     ${items.map((it,r)=>`<tr><td class="it">${r+1}. ${h(it.t)}</td>${days.map((d,c)=>`<td><button type="button" class="wkc" data-r="${r}" data-c="${c}" ${d>t?'disabled':''}></button></td>`).join('')}</tr>`).join('')}</table></div>
   <div id="wkNotes"></div>
   <div class="card"><label class="f">비고</label><textarea class="inp" id="wkR" placeholder="특이사항">${h(prev&&prev.remark||'')}</textarea>
     <div class="grid g2"><div><label class="f">점검자 (${drvT?'운전원':'전담관리자'})</label><input class="inp" id="wkBy" ${ro?'readonly':''} value="${h(prev&&prev.inspector||(ro?'':S.inspector)||'')}"></div></div><div id="wkSig" style="margin-top:10px"></div></div>
   ${ro?'':`<div class="grid g2"><button class="btn xl" id="wkSave">저장</button>${prev&&canDel(prev)?'<button class="btn xl line" id="wkDel">이 주 점검표 삭제</button>':''}</div>`}`,b=>{
    const paint=()=>{
      $$('.wkc',b).forEach(x=>{const v=st.marks[items[+x.dataset.r].t][+x.dataset.c];x.textContent=SYM[v];x.className='wkc'+(v?' v'+v:'')});
      const bad=items.filter(it=>st.marks[it.t].some(v=>v==='X'||v==='E'));
      $('#wkStamp',b).innerHTML=items.every(it=>st.marks[it.t].every(Boolean))?stampHtml('sm'):'';
      const box=$('#wkNotes',b);const keep={};$$('[data-note]',box).forEach(i=>keep[i.dataset.note]=i.value);Object.assign(st.notes,keep);
      box.innerHTML=bad.length?`<div class="card"><b style="color:var(--bad)">비고 (부적합 조치사항 · 기타의견) — 필수</b>${bad.map(it=>`<label class="f">${items.indexOf(it)+1}. ${h(it.t)} (${st.marks[it.t].map((v,i)=>v==='X'||v==='E'?WD6[i]+' '+MARK_TXT[v]:'').filter(Boolean).join(', ')})</label><input class="inp" data-note="${h(it.t)}" value="${h(st.notes[it.t]||'')}" placeholder="${st.marks[it.t].includes('X')?'부적합 내용·조치사항':'의견 내용'}">`).join('')}</div>`:'';
      $$('[data-note]',box).forEach(i=>i.oninput=()=>st.notes[i.dataset.note]=i.value)};
    let dirty=false;
    $$('.wkc',b).forEach(x=>x.onclick=()=>{const a=st.marks[items[+x.dataset.r].t],c=+x.dataset.c;a[c]=NEXT[a[c]];dirty=true;paint()});
    $$('.wkh',b).forEach(x=>x.onclick=()=>{const c=+x.dataset.col;items.forEach(it=>{if(!st.marks[it.t][c])st.marks[it.t][c]='O'});dirty=true;paint()});
    if(ro){$$('.wkc,.wkh',b).forEach(x=>x.disabled=true)}else $('#wkAll',b).onclick=()=>{days.forEach((d,c)=>{if(d<=t)items.forEach(it=>{if(!st.marks[it.t][c])st.marks[it.t][c]='O'})});dirty=true;paint()};
    if(!ro)MODAL_GUARD=()=>!dirty||confirm('저장하지 않은 점검 내용이 있어요. 닫으면 사라집니다. 닫을까요?');
    paint();if(ro){$('#wkSig',b).innerHTML=prev&&prev.sig?`<div class="small muted">서명</div><img src="${prev.sig}" style="max-width:100%;height:90px">`:'';return}
    const wf=$('#wkF',b);if(wf)wf.onchange=async()=>{if(prev&&!confirm('양식을 바꾸면 이번 주 체크 중 같은 이름의 항목만 남습니다. 바꿀까요?')){wf.value=eqFormOf(e)?eqFormOf(e).k:'base';return}
      await save('equipment',{...e,formK:wf.value});closeModal();toast('점검표 양식을 바꿨습니다');eqWeekForm(eid,mon,true)};
    const sig=sigPad($('#wkSig',b),drvT?'운전원 서명':'전담관리자 서명',prev&&prev.sig?prev.sig:(($('#wkBy',b).value.trim()===S.inspector)?S.mySig:''));
    $('#wkBy',b).addEventListener('change',()=>{$('#wkBy').value.trim()===S.inspector?sig.useMine():sig.clear()});
    const del=$('#wkDel',b);if(del)del.onclick=async()=>{if(!confirm('이 주 점검표를 삭제할까요?'))return;try{await remove('eqchecks',prev.id);closeModal();R[cur]()}catch(x){toast(x.message)}};
    $('#wkSave',b).onclick=async()=>{
      $$('[data-note]',b).forEach(i=>st.notes[i.dataset.note]=i.value);
      if(!items.some(it=>st.marks[it.t].some(Boolean)))return toast('체크한 칸이 없습니다');
      const bad=items.find(it=>st.marks[it.t].some(v=>v==='X'||v==='E')&&!String(st.notes[it.t]||'').trim());if(bad){toast(`비고를 꼭 적어주세요: ${bad.t}`);const i=$(`[data-note="${CSS.escape(bad.t)}"]`,b);if(i)i.focus();return}
      const by=$('#wkBy').value.trim();if(!by)return toast('점검자 이름을 입력하세요');if(sig.isEmpty())return toast('서명이 필요합니다');
      const notes={};items.forEach(it=>{if(st.marks[it.t].some(v=>v==='X'||v==='E'))notes[it.t]=String(st.notes[it.t]||'').trim()});
      const sv=$('#wkSave',b);let ok;sv.disabled=true;sv.textContent='서버에 저장 중…';
      try{ok=await saveConfirm('eqchecks',{id:weekRecId(eid,mon,tr),kind:'week',track:tr,week:mon,equipId:e.id,type:e.type||'',plate:e.plate||'',company:e.company||'',manager:e.manager||'',
        marks:Object.fromEntries(items.map(it=>[it.t,st.marks[it.t]])),itemList:items.map(it=>it.t),form:eqFormName(e),notes,remark:$('#wkR').value.trim(),inspector:by,sig:sig.data(),created:prev?prev.created:nowLocal(),updated:nowLocal()})}
      catch(x){sv.disabled=false;sv.textContent='다시 저장';return saveRejectedAlert(x)}
      MODAL_GUARD=null;closeModal();if(!ok)toast('기기에 저장됨 · 인터넷이 연결되면 서버로 보냅니다');else toast(items.every(it=>st.marks[it.t].every(Boolean))?'주간 점검 완료':items.some(it=>st.marks[it.t].includes('X'))?'저장됨 — 부적합 항목 조치를 확인하세요':'주간 점검표 저장됨');R[cur]();
    };
  });
}

/* 주간 사진: 점검사진 + 항목별 1장 (장비당 주 1회 — 같은 주에 다시 열면 같은 기록을 수정) */
function eqWeekPhotoForm(eid,mon,tr){
  tr=tr||myTrack();
  const e=E.find(x=>x.id===eid);if(!e)return;const prev=eqWeekPhoto(eid,mon,tr);const slots=eqSlots(e);
  if(tr!==myTrack()||!eqCanCheck()){ // 관리자가 운전원 사진을 볼 때, 점검 권한이 없을 때: 보기만
    const ph=((prev&&prev.photos)||[]);
    return openModal(`${tr==='drv'?'운전원':'주간'} 사진 (보기) · ${eqName(e)}`,`<div class="small muted" style="margin-bottom:8px">${weekLabel(mon)} · ${h(prev&&prev.by||'')} ${prev?fmtDT(prev.updated||prev.created):''}</div><div class="photos">${ph.map(p=>`<div class="ph"><a href="${h(p.src)}" target="_blank" rel="noopener"><img src="${h(p.src)}"></a><div class="small muted">${h(p.slot||'')}</div></div>`).join('')||'<div class="empty">사진이 없습니다</div>'}</div>`)}
  const st={};for(const p of (prev&&prev.photos)||[])if(p.slot)st[p.slot]=p.src;
  let target=null;
  openModal(`주간 사진 · ${eqName(e)}`,`<div class="card"><b>${weekLabel(mon)}</b> <span class="muted small">(${md(mon)}~${md(addDays(mon,5))})</span>
     <div class="small muted" style="margin-top:4px">장비당 <b>한 주에 한 번</b>, 항목마다 사진 1장. 먼저 <b>점검사진</b>(점검자와 장비가 함께 나온 사진)을 올려주세요.${matchMedia('(hover:hover) and (pointer:fine)').matches?' PC에서는 사진 파일을 항목 칸에 <b>끌어다 놓아도</b> 됩니다.':''}${prev?` · 마지막 저장 ${h(prev.by||'')} ${fmtDT(prev.updated||prev.created)}`:''}</div>
     <div class="small" style="margin-top:6px" id="wpProg"></div></div>
   <div id="wpSlots"></div>
   <input type="file" accept="image/*" capture="environment" hidden id="wpCam"><input type="file" accept="image/*" hidden id="wpGalIn">
   <div class="grid g2"><button class="btn xl" id="wpSave">${prev?'수정 저장':'저장'}</button>${prev&&canDel(prev)?'<button class="btn xl line" id="wpDel">이 주 사진 삭제</button>':''}</div>`,b=>{
    const draw=()=>{
      $('#wpProg',b).innerHTML=`등록 <b>${slots.filter(s=>st[s.t]).length}</b> / ${slots.length}`;
      $('#wpSlots',b).innerHTML=slots.map((s,i)=>`<div class="card wpslot${st[s.t]?' done':''}"><div class="row" style="gap:10px;align-items:flex-start">
        <div class="wpthumb">${st[s.t]?`<img src="${st[s.t]}">`:'<i class="i i-camera"></i>'}</div>
        <div class="grow" style="min-width:0"><b>${h(s.t)}</b>${s.d?`<div class="small muted">${h(s.d)}</div>`:''}
          <div class="row" style="margin-top:8px;gap:6px"><button type="button" class="btn sm${st[s.t]?' line':''}" data-cam="${i}"><i class="i i-camera"></i> ${st[s.t]?'다시 촬영':'촬영'}</button><button type="button" class="btn sm ghost" data-gal="${i}">갤러리</button>${st[s.t]?`<button type="button" class="btn sm line" data-rm="${i}">삭제</button>`:''}</div></div></div></div>`).join('');
      $$('[data-cam]',b).forEach(x=>x.onclick=()=>{target=slots[+x.dataset.cam].t;$('#wpCam',b).click()});
      $$('[data-gal]',b).forEach(x=>x.onclick=()=>{target=slots[+x.dataset.gal].t;withGalleryConsent(()=>$('#wpGalIn').click())});
      $$('[data-rm]',b).forEach(x=>x.onclick=()=>{delete st[slots[+x.dataset.rm].t];draw()});
      /* PC: 사진 파일을 항목 칸에 끌어다 놓기. 칸마다 1장(여러 장이면 첫 장). 화면 전체 끌어다 놓기(ui.js)보다 먼저 받아서 멈춤 */
      const hasF=ev=>[...((ev.dataTransfer&&ev.dataTransfer.types)||[])].includes('Files');
      $$('.wpslot',b).forEach((card,i)=>{
        card.addEventListener('dragover',ev=>{if(!hasF(ev))return;ev.preventDefault();ev.stopPropagation();ev.dataTransfer.dropEffect='copy';$$('.drop-on').forEach(x=>x!==card&&x.classList.remove('drop-on'));card.classList.add('drop-on')});
        card.addEventListener('dragleave',ev=>{if(!card.contains(ev.relatedTarget))card.classList.remove('drop-on')});
        card.addEventListener('drop',async ev=>{if(!hasF(ev))return;ev.preventDefault();ev.stopPropagation();card.classList.remove('drop-on');
          const fs=[...ev.dataTransfer.files].filter(f=>/^image\//.test(f.type));if(!fs.length)return toast('사진 파일만 넣을 수 있어요');
          if(fs.length>1)toast('항목마다 사진 1장이라 첫 번째 사진만 넣었어요');
          try{st[slots[i].t]=await compressImg(fs[0]);dirty=true;draw()}catch(x){toast('사진 처리 실패')}})});
    };draw();
    let dirty=false;MODAL_GUARD=()=>!dirty||confirm('저장하지 않은 사진이 있어요. 닫으면 사라집니다. 닫을까요?');
    $('#wpSlots',b).addEventListener('click',ev=>{if(ev.target.closest('[data-rm]'))dirty=true});
    const take=async ev=>{const fl=ev.target.files[0];ev.target.value='';if(!fl||!target)return;try{st[target]=await compressImg(fl);dirty=true;draw()}catch(x){toast('사진 처리 실패')}};
    $('#wpCam',b).onchange=take;$('#wpGalIn',b).onchange=take;
    const del=$('#wpDel',b);if(del)del.onclick=async()=>{if(!confirm('이 주의 사진을 모두 삭제할까요?'))return;try{await remove('eqchecks',prev.id);closeModal();R[cur]()}catch(x){toast(x.message)}};
    $('#wpSave',b).onclick=async()=>{const photos=slots.filter(s=>st[s.t]).map(s=>({slot:s.t,cap:s.t,src:st[s.t]}));if(!photos.length)return toast('사진을 1장 이상 올려주세요');
      const sv=$('#wpSave',b);let ok;sv.disabled=true;sv.textContent='서버에 저장 중…';
      try{ok=await saveConfirm('eqchecks',{id:weekPhotoId(eid,mon,tr),kind:'weekPhoto',track:tr,week:mon,equipId:e.id,type:e.type||'',plate:e.plate||'',company:e.company||'',manager:e.manager||'',
        photos,by:S.inspector||'',created:prev?prev.created:nowLocal(),updated:nowLocal()})}
      catch(x){sv.disabled=false;sv.textContent='다시 저장';return saveRejectedAlert(x)}
      MODAL_GUARD=null;closeModal();toast(ok?`${weekLabel(mon)} 사진 ${photos.length}/${slots.length} 서버에 저장됨`:`사진 ${photos.length}장 기기에 저장됨 · 인터넷이 연결되면 서버로 보냅니다`);R[cur]()};
  });
}

/* 주간 일일점검표 출력 — A4 가로 1장 / 장비 1대 (현장 엑셀 양식과 같은 배치) */
