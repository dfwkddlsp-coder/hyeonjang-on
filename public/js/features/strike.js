// 현장ON — 삼진아웃
'use strict';
R.strike=(arg)=>{
  if(arg==='new'||(arg&&arg.person))return strikeForm(arg&&arg.person);
  const act=V.filter(v=>!v.void);const q=R.strike.q||'';
  const list=V.filter(v=>!q||norm([v.name,v.company,v.type,v.place].join(' ')).includes(norm(q))).sort((a,b)=>b.at.localeCompare(a.at));
  V$().innerHTML=`<h1>삼진아웃제</h1>
  <button class="btn xl" id="nv" style="margin-bottom:12px"><i class="i i-alert"></i> 적발 등록</button>
  <div class="grid g4" style="margin-bottom:12px">${[1,2,3].map(l=>`<div class="stat" style="border-left:6px solid var(--l${l})"><div class="t">${h(S.levels[l-1].name)}</div><div class="n">${act.filter(v=>v.level===l).length}</div><div class="small muted ell">${h(S.levels[l-1].act.split('\n').join(' · '))}</div></div>`).join('')}</div>
  <div class="row" style="margin-bottom:10px"><input class="inp grow" id="sq" type="search" placeholder="성명 · 업체 · 위반내용 검색" value="${h(q)}"><button class="btn line" id="sx">엑셀 저장</button></div>
  <div class="card list">${list.length?list.slice(0,300).map(vItem).join(''):'<div class="empty">적발 기록 없음</div>'}</div>`;
  $('#nv').onclick=()=>go('strike','new');
  $('#sq').oninput=e=>{R.strike.q=e.target.value;clearTimeout(R.strike.t);R.strike.t=setTimeout(()=>{R.strike();const i=$('#sq');i.focus();i.setSelectionRange(i.value.length,i.value.length)},250)};
  $('#sx').onclick=()=>exportViolations(list);bindItems();
};
function strikeForm(preset){
  const st={person:null,type:'',photos:[],level:1,autoLevel:1,levelManual:false};
  V$().innerHTML=`<div class="row" style="justify-content:space-between"><h1>삼진아웃 적발 등록</h1><button class="btn ghost sm" id="back">← 목록</button></div>
  <div class="card"><label class="f">1. 위반자</label><div id="pp"></div><div id="who"></div></div>
  <div class="card" id="lvCard" style="display:none"></div>
  <div class="card"><label class="f">2. 위반 내용</label><div class="chips" id="vt">${S.vtypes.map(t=>`<button type="button" class="chip" data-t="${h(t)}">${h(t)}</button>`).join('')}</div>
   <label class="f">상세 내용</label><textarea class="inp" id="detail" placeholder="예) 3층 슬래브 단부 작업 중 안전대 미체결"></textarea>
   <div class="grid g2"><div><label class="f">적발 장소</label><input class="inp" id="place" placeholder="예) 101동 5층"></div><div><label class="f">적발 일시</label><input class="inp" type="datetime-local" id="at" value="${nowLocal()}"></div></div>
   <label class="f">현장 사진</label><div class="photos" id="phs"></div><div class="row" style="margin-top:8px"><label class="btn ghost"><i class="i i-camera"></i> 사진 촬영<input type="file" accept="image/*" capture="environment" hidden id="phIn"></label><button type="button" class="btn ghost" id="phGal"><i class="i i-folder"></i> 갤러리에서 선택</button><input type="file" accept="image/*" multiple hidden id="phInG"></div></div>
  <div class="card"><label class="f">3. 조치사항</label><textarea class="inp" id="action" style="min-height:100px"></textarea></div>
  <div class="card"><label class="f">4. 확인 서명</label>
   <div class="grid g2"><div><label class="f">점검자 소속</label><input class="inp" id="iOrg" value="${h(S.inspectorOrg)}"></div><div><label class="f">점검자 성명 *</label><input class="inp" id="iName" value="${h(S.inspector)}"></div></div>
   <div class="grid g2" style="margin-top:12px"><div id="sigV"></div><div id="sigI"></div></div>
   <label class="row" style="margin-top:10px"><input type="checkbox" id="refuse" style="width:22px;height:22px"> 위반자 서명 거부</label>
   <div id="witBox" style="display:none"><label class="f">입회자 (소속/성명)</label><input class="inp" id="witness"></div></div>
  <button class="btn xl" id="saveV">저장</button>`;
  $('#back').onclick=()=>go('strike');
  const sv=sigPad($('#sigV'),'위반자 확인 서명'),si=sigPad($('#sigI'),'점검자 서명',S.mySig);{const _i=$('#iName');if(_i)_i.addEventListener('change',()=>{_i.value.trim()===S.inspector?si.useMine():si.clear()})};
  $('#refuse').onchange=e=>$('#witBox').style.display=e.target.checked?'block':'none';
  const setLevel=()=>{const L=st.level;$('#lvCard').style.display='block';const lv=S.levels[L-1];
    $('#lvCard').innerHTML=`<div class="level-box">${stickerHtml(L,($('#at').value||nowLocal()).slice(0,10))}<div style="flex:1;min-width:200px"><div style="font-size:22px;font-weight:800">${h(lv.name)} <span class="badge b${L}">${h(lv.sticker)} 스티커</span></div>
    <div class="small muted">누적 기준 자동 판정: ${st.autoLevel}차${S.periodMonths?` (최근 ${S.periodMonths}개월)`:''}</div>
    <div class="chips" style="margin-top:8px">${[1,2,3].map(l=>`<button type="button" class="chip ${l===L?'on':''}" data-l="${l}">${l}차</button>`).join('')}</div></div></div>`;
    $$('#lvCard [data-l]').forEach(b=>b.onclick=()=>{st.level=+b.dataset.l;st.levelManual=st.level!==st.autoLevel;$('#action').value=S.levels[st.level-1].act;setLevel()});
  };
  const pick=p=>{st.person=p;const k=pkey(p.name,p.company);const prev=strikesOf(k);st.autoLevel=Math.min(prev.length+1,3);st.level=st.autoLevel;
    $('#pp').style.display='none';
    $('#who').innerHTML=`<div class="who"><div style="flex:1"><div class="nm">${h(p.name)}</div><div class="muted">${h(p.company)} · ${h(p.job||'')}</div>
     ${isBanned(k)?'<div class="badge b3" style="margin-top:6px">이미 퇴출 처리된 근로자</div>':''}${vulnBadge(p.name,p.company)}
     ${prev.length?`<div class="small" style="margin-top:6px">이전 적발: ${prev.map(v=>`${v.date} ${h(v.type)} (${v.level}차)`).join('<br>')}</div>`:'<div class="small muted" style="margin-top:6px">이전 적발 없음</div>'}</div>
     <button class="btn ghost sm" id="chg">변경</button></div>
     <div class="grid g2"><div><label class="f">소속업체</label>${comboHtml('pCo','company',p.company,'업체명 직접 입력')}</div><div><label class="f">직종</label>${comboHtml('pJob','job',p.job,'직종 직접 입력')}</div></div>`;
    bindCombos($('#who'));
    $('#chg').onclick=()=>{$('#who').innerHTML='';$('#pp').style.display='block';$('#lvCard').style.display='none';st.person=null};
    $('#action').value=S.levels[st.level-1].act;setLevel();
  };
  personPicker($('#pp'),pick,{focus:!preset});if(preset)pick(preset);
  $$('#vt .chip').forEach(b=>b.onclick=()=>{$$('#vt .chip').forEach(x=>x.classList.remove('on'));b.classList.add('on');st.type=b.dataset.t});
  const drawPh=()=>{$('#phs').innerHTML=st.photos.map((p,i)=>`<div class="ph"><img src="${p}"><button data-i="${i}"><i class="i i-x"></i></button></div>`).join('');$$('#phs button').forEach(b=>b.onclick=()=>{st.photos.splice(+b.dataset.i,1);drawPh()})};
  const addPh=async e=>{for(const f of e.target.files){try{st.photos.push(await compressImg(f))}catch(x){toast('사진 처리 실패')}}e.target.value='';drawPh()};
  $('#phIn').onchange=addPh;$('#phInG').onchange=addPh;
  $('#phGal').onclick=()=>withGalleryConsent(()=>$('#phInG').click());
  $('#at').onchange=()=>st.person&&setLevel();
  $('#saveV').onclick=async()=>{
    if(!st.person)return toast('위반자를 선택하세요');if(!st.type)return toast('위반 내용을 선택하세요');
    if(!$('#iName').value.trim())return toast('점검자 성명을 입력하세요');
    if(si.isEmpty())return toast('점검자 서명이 필요합니다');
    const refused=$('#refuse').checked;if(!refused&&sv.isEmpty())return toast('위반자 서명 또는 "서명 거부"를 선택하세요');
    if(refused&&!$('#witness').value.trim())return toast('서명 거부 시 입회자를 입력하세요');
    const p=st.person,at=$('#at').value||nowLocal();
    const v={id:uid(),at,date:at.slice(0,10),name:p.name,company:$('#pCo').value.trim()||p.company,job:$('#pJob').value.trim(),workerId:p.workerId||'',pkey:pkey(p.name,$('#pCo').value.trim()||p.company),
      type:st.type,detail:$('#detail').value.trim(),place:$('#place').value.trim(),photos:st.photos,level:st.level,autoLevel:st.autoLevel,action:$('#action').value.trim(),
      inspectorOrg:$('#iOrg').value.trim(),inspector:$('#iName').value.trim(),sigInspector:si.data(),sigViolator:refused?'':sv.data(),violatorRefused:refused,witness:refused?$('#witness').value.trim():'',
      edu:st.level===2?{done:false}:null,created:nowLocal(),linkedAlcohol:preset&&preset.alcId||''};
    await save('violations',v);
    if(v.level===3){const w=workerByKey(v.pkey);if(w){w.banned=true;w.bannedAt=v.at;await save('workers',w)}}
    if(v.linkedAlcohol){const a=A.find(x=>x.id===v.linkedAlcohol);if(a){a.linkedViolation=v.id;await save('alcohol',a)}}
    toast(`${v.level}차 적발 저장됨`);
    if(!S.inspector){S.inspector=v.inspector;S.inspectorOrg=v.inspectorOrg;saveSettings()}
    go('strike');showViolation(v.id);
  };
}
function showViolation(id){
  const v=V.find(x=>x.id===id);if(!v)return;const lv=S.levels[v.level-1];
  openModal(`${lv.name} · ${v.name}`,`<div class="level-box" style="margin-bottom:12px">${stickerHtml(v.level,v.date)}<dl class="kv" style="flex:1">
   <dt>소속</dt><dd>${h(v.company)}</dd><dt>직종</dt><dd>${h(v.job)}</dd><dt>적발일시</dt><dd>${fmtDT(v.at)}</dd><dt>장소</dt><dd>${h(v.place||'-')}</dd><dt>위반내용</dt><dd>${h(v.type)}${v.detail?'<br>'+nl(v.detail):''}</dd>
   <dt>조치사항</dt><dd>${nl(v.action)}</dd><dt>점검자</dt><dd>${h(v.inspectorOrg)} ${h(v.inspector)}</dd><dt>위반자 확인</dt><dd>${v.violatorRefused?'서명 거부 (입회: '+h(v.witness)+')':'서명 완료'}</dd>
   ${v.void?`<dt>무효</dt><dd style="color:var(--bad)">${h(v.void.reason)} (${fmtDT(v.void.at)})</dd>`:''}</dl></div>
   ${v.photos&&v.photos.length?`<div class="photos" style="margin-bottom:12px">${v.photos.map(p=>`<div class="ph"><img src="${p}"></div>`).join('')}</div>`:''}
   <div class="grid g2" style="margin-bottom:12px">${v.sigViolator?`<div class="card"><div class="small muted">위반자 서명</div><img src="${v.sigViolator}" style="max-width:100%;height:90px"></div>`:''}<div class="card"><div class="small muted">점검자 서명</div><img src="${v.sigInspector}" style="max-width:100%;height:90px"></div></div>
   ${v.level===2&&!v.void?`<div class="card">${v.edu&&v.edu.done?`<b style="color:var(--ok)"><i class="i i-check"></i> 교육 이수</b> ${fmtDT(v.edu.at)} · 교육자 ${h(v.edu.by)}`:`<b style="color:var(--warn)">교육 미이수</b><div class="row" style="margin-top:8px"><input class="inp grow" id="eduBy" placeholder="교육 실시자" value="${h(S.inspector)}"><button class="btn ok" id="eduOk">교육 이수 처리</button></div>`}</div>`:''}
   <div class="row"><button class="btn" id="pv"><i class="i i-print"></i> 확인서 출력 / PDF</button>${!v.void&&isAdmin()?'<button class="btn line" id="vd">무효 처리</button>':''}<button class="btn line" id="wh">근로자 이력</button></div>`,b=>{
    $('#pv',b).onclick=()=>printPages([docViolation(v)]);
    const wh=$('#wh',b);wh.onclick=()=>{closeModal();showPersonHistory(v.pkey,v.name,v.company)};
    const eo=$('#eduOk',b);if(eo)eo.onclick=async()=>{v.edu={done:true,at:nowLocal(),by:$('#eduBy').value.trim()};await save('violations',v);toast('교육 이수 처리됨');showViolation(v.id);R[cur]()};
    const vd=$('#vd',b);if(vd)vd.onclick=async()=>{const r=prompt('무효 사유를 입력하세요 (기록은 삭제되지 않고 무효로 표시됩니다)');if(!r)return;v.void={reason:r,at:nowLocal()};await save('violations',v);toast('무효 처리됨');closeModal();R[cur]()};
  });
}

/* --- 음주측정 --- */
