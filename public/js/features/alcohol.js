// 현장ON — 음주측정
'use strict';
R.alcohol=()=>{
  const ds=R.alcohol.d||today();const rows=alcRowsOfDay(ds);const base=rows.filter(a=>!a.retestOf);
  const pend=A.filter(a=>!a.void&&a.judge==='재측정'&&!retestChild(a));
  V$().innerHTML=`<h1>음주측정</h1>
  <div class="card"><label class="f">측정 대상자</label><div id="ap"></div><div id="aform"></div></div>
  ${pend.length?`<h2>재측정 대기 (10분 후)</h2><div class="card list" id="pendL">${pend.map(alcItem).join('')}</div>`:''}
  ${alcBadSection()}
  <div class="row" style="margin:16px 0 10px"><h2 style="margin:0;flex:1">측정 기록</h2><input type="date" class="inp" id="ad" value="${ds}" style="width:auto"></div>
  <div class="grid g4" style="margin-bottom:10px"><div class="stat"><div class="t">측정인원</div><div class="n">${base.length}</div></div><div class="stat"><div class="t">양호</div><div class="n" style="color:var(--ok)">${base.filter(a=>!isAlcBad(alcFinal(a))&&alcFinal(a).judge!=='재측정').length}</div></div><div class="stat"><div class="t">적발</div><div class="n" style="color:var(--bad)">${base.filter(a=>isAlcBad(alcFinal(a))).length}</div></div></div>
  <div class="card list ph-only">${rows.length?rows.map(a=>`<div class="it" data-aid="${a.id}"><span class="badge ${judgeCls(a.judge)}">${a.judge}</span><div class="m"><b>${h(a.name)}</b>${a.retestOf?' <span class="small muted">(재측정)</span>':''} <span class="muted small">${h(a.company)}</span>
    <div class="small muted ell">${hm(a.at)} · <b style="color:var(--ink)">${a.refused?'거부':a.value.toFixed(3)+'%'}</b>${a.job?' · '+h(a.job):''} · 측정 ${h(a.measurer)}${a.follow?' · '+h(a.follow):''}</div></div>
    ${isAlcBad(a)&&!a.void?(a.notice?`<button class="btn sm line" data-np="${a.id}"><i class="i i-print"></i></button>`:`<button class="btn sm bad" data-nw="${a.id}"><i class="i i-pen"></i> 통지서</button>`):''}</div>`).join(''):'<div class="empty">기록 없음</div>'}</div>
  <div class="tbl-wrap pc-only"><table class="t"><tr><th>NO</th><th>시간</th><th>소속/업체명</th><th>직종</th><th>성명</th><th>측정결과(%)</th><th>판정</th><th>조치사항</th><th>측정인</th><th>사후조치</th><th>통지서</th></tr>
  ${rows.length?rows.map((a,i)=>`<tr class="click" data-aid="${a.id}"><td>${i+1}</td><td>${hm(a.at)}</td><td>${h(a.company)}</td><td>${h(a.job)}</td><td><b>${h(a.name)}</b>${a.retestOf?' <span class="small muted">(재측정)</span>':''}</td><td>${a.refused?'거부':a.value.toFixed(3)}</td><td><span class="badge ${judgeCls(a.judge)}">${a.judge}</span></td><td>${h(a.action)}</td><td>${h(a.measurer)}</td><td>${h(a.follow||'')}</td><td>${isAlcBad(a)&&!a.void?(a.notice?`<button class="btn sm line" data-np="${a.id}"><i class="i i-print"></i> 출력</button>`:`<button class="btn sm bad" data-nw="${a.id}"><i class="i i-pen"></i> 작성</button>`):''}</td></tr>`).join(''):'<tr><td colspan="11" class="empty">기록 없음</td></tr>'}</table></div>
  <div class="row" style="margin-top:12px"><button class="btn line" id="pl"><i class="i i-print"></i> 이 날짜 기록표 출력</button><button class="btn line" id="xw"><i class="i i-sheet"></i> 주간 엑셀 (기록표+일지)</button></div>`;
  $('#ad').onchange=e=>{R.alcohol.d=e.target.value;R.alcohol()};
  $('#pl').onclick=()=>printPages([docAlcoholList(ds)]);
  $('#xw').onclick=()=>{const d=new Date(ds+'T00:00');const mon=addDays(ds,-((d.getDay()+6)%7));exportAlcohol(mon,addDays(mon,6))};
  personPicker($('#ap'),p=>alcForm(p),{focus:true});
  $$('[data-nw]').forEach(b=>b.onclick=e=>{e.stopPropagation();alcNotice(b.dataset.nw)});
  $$('[data-np]').forEach(b=>b.onclick=e=>{e.stopPropagation();printPages([docAlcohol(A.find(x=>x.id===b.dataset.np))])});
  bindItems();$$('[data-aid]',$('#pendL')||document.createElement('div')).forEach(el=>el.onclick=()=>{const a=A.find(x=>x.id===el.dataset.aid);alcForm({name:a.name,company:a.company,job:a.job,workerId:a.workerId,equip:a.equip,plate:a.plate},a)});
};
function alcForm(p,parent){
  const k=pkey(p.name,p.company);const prevBadN=alcBadCount(k,parent&&parent.id);
  $('#ap').style.display='none';
  $('#aform').innerHTML=`<div class="who"><div style="flex:1"><div class="nm">${h(p.name)} ${parent?'<span class="badge bwarn">재측정</span>':''}</div><div class="muted">${h(p.company)} · ${h(p.job||'')}${p.equip?' · 장비 '+h(p.equip)+' '+h(p.plate||''):''}</div>
   ${isBanned(k)?'<div class="badge b3" style="margin-top:6px">삼진아웃 퇴출자</div>':''}${vulnBadge(p.name,p.company)}${prevBadN?`<div class="badge bbad" style="margin-top:6px">이전 음주 적발 ${prevBadN}회 — 이번 적발 시 ${prevBadN+1>=S.alc.outCount?'영구퇴출':(prevBadN+1)+'회'}</div>`:''}
   ${parent?`<div class="small" style="margin-top:6px">1차 측정 ${hm(parent.at)} · ${parent.refused?'거부':f3(parent.value)+'%'}</div>`:''}</div><button class="btn ghost sm" id="ac">취소</button></div>
   <div class="grid g2" style="margin-top:12px"><div><label class="f">측정결과 (%)</label><input class="inp big" id="av" inputmode="decimal" placeholder="0.000" style="font-size:32px;text-align:center"></div>
   <div><label class="f">판정</label><div class="judge" id="aj" style="background:var(--chip)">—</div></div></div>
   <div class="row" style="margin-top:10px"><button class="btn ok" id="a0" style="flex:1">0.000 (정상) 바로 저장</button><button class="btn bad" id="ar">측정 거부</button></div>
   <div class="grid g2"><div><label class="f">소속업체</label>${comboHtml('aCo','company',p.company,'업체명 직접 입력')}</div><div><label class="f">직종</label>${comboHtml('aJob','job',p.job,'직종 직접 입력')}</div><div><label class="f">측정인</label><input class="inp" id="am" value="${h(S.inspector)}"></div></div>
   <button class="btn xl" id="as" style="margin-top:12px">저장</button>`;
  bindCombos($('#aform'));
  const cancel=()=>{$('#aform').innerHTML='';$('#ap').style.display='block';$('#ap input').focus()};
  $('#ac').onclick=cancel;
  const show=()=>{const v=parseFloat($('#av').value);if(isNaN(v)){$('#aj').textContent='—';$('#aj').className='judge';return}
    const j=judge(v,false,!!parent);const out=j!=='정상'&&j!=='재측정'&&prevBadN+1>=S.alc.outCount;$('#aj').textContent=j+(out?' · 영구퇴출':'')+' · '+JUDGE_ACT[j];$('#aj').className='judge badge '+judgeCls(j)};
  $('#av').oninput=show;setTimeout(()=>$('#av').focus(),50);
  const doSave=async(val,refused)=>{
    if(!$('#am').value.trim())return toast('측정인 성명을 입력하세요');
    if(!refused&&(isNaN(val)||val<0||val>1))return toast('측정값을 확인하세요 (예: 0.012)');
    const at=nowLocal();const j=judge(val,refused,!!parent);
    const a={id:uid(),at,date:at.slice(0,10),name:p.name,company:$('#aCo').value.trim()||p.company,job:$('#aJob').value.trim(),equip:p.equip||'',plate:p.plate||'',workerId:p.workerId||'',pkey:k,
      value:refused?null:val,refused,judge:j,action:JUDGE_ACT[j],measurer:$('#am').value.trim(),follow:'',retestOf:parent?parent.id:'',created:at};
    if(isAlcBad(a)){a.badNo=prevBadN+1;if(a.badNo>=S.alc.outCount){a.out=true;a.action+=` / ${a.badNo}회 적발 – 영구퇴출`}}
    await save('alcohol',a);
    if(a.out){const w=workerByKey(k);if(w){w.banned=true;w.bannedAt=at;w.bannedReason='음주 '+a.badNo+'회 적발';await save('workers',w)}}
    if(parent){parent.follow=`재측정 ${hm(at)} ${refused?'거부':val.toFixed(3)} → ${j}`;await save('alcohol',parent)}
    if(!S.inspector){S.inspector=a.measurer;saveSettings()}
    toast(`${p.name} · ${j}`);
    R.alcohol();
    if(isAlcBad(a))alcNotice(a.id);
  };
  $('#a0').onclick=()=>doSave(0,false);
  $('#ar').onclick=()=>{if(confirm('측정 거부로 기록합니다.'))doSave(null,true)};
  $('#as').onclick=()=>doSave(parseFloat($('#av').value),false);
  $('#av').onkeydown=e=>{if(e.key==='Enter')$('#as').click()};
}
const NOTICE_ITEMS=[['am','오전 작업 중지 (간단한 숙취)'],['stop','당일 작업 즉시 중단 및 현장 퇴장 조치'],['review','위험성평가 회의 시 심의'],['out','영구 퇴출'],['edu','안전 교육 재이수 명령'],['ban','향후 현장 출입 제한'],['etc','기타']];
function defaultNoticeItems(a){const it=a.judge==='오전 작업중지'?['am']:a.judge==='당일 작업중지'?['stop','review']:['stop'];if(a.out)it.push('out');return it}
function alcNotice(id){
  const a=A.find(x=>x.id===id);const n=a.notice||{items:defaultNoticeItems(a),place:'',days:'',etc:''};
  const box=([k,t])=>`<label class="row" style="margin:6px 0"><input type="checkbox" value="${k}" ${n.items.includes(k)?'checked':''} style="width:22px;height:22px"> ${t}${k==='ban'?` <input class="inp" id="nD" value="${h(n.days)}" style="width:80px;min-height:36px;padding:4px 8px" inputmode="numeric"> 일`:k==='etc'?` <input class="inp grow" id="nE" value="${h(n.etc)}" style="min-height:36px;padding:4px 8px">`:''}</label>`;
  openModal('음주측정 결과 통지서',`<div class="judge badge ${judgeCls(a.judge)}" style="display:block;margin-bottom:12px">${h(a.name)} · ${a.refused?'측정 거부':f3(a.value)+'%'} · ${a.judge}${a.badNo?` · ${a.badNo}회 적발`:''}${a.out?' · 영구퇴출':''}</div>
   <div class="card"><label class="f">측정 장소</label><input class="inp" id="nP" value="${h(n.place)}" placeholder="예) 정문 게이트 / 안전교육장">
   <label class="f">조치 내용</label>${NOTICE_ITEMS.map(box).join('')}</div>
   <div class="hint" style="margin-bottom:12px"><b>현장 기준</b><br>${alcCriteria().map((c,i)=>`${i+1}. ${h(c)}`).join('<br>')}</div>
   <div class="grid g2"><div id="sW"></div><div id="sM"></div></div>
   <label class="row" style="margin-top:10px"><input type="checkbox" id="nR" style="width:22px;height:22px"> 근로자 서명 거부</label><div id="nWb" style="display:none"><label class="f">입회자</label><input class="inp" id="nWi"></div>
   <label class="row" style="margin-top:10px"><input type="checkbox" id="nV" ${a.linkedViolation?'disabled':''} style="width:22px;height:22px"> 삼진아웃 위반으로도 등록 ${a.linkedViolation?'(등록됨)':''}</label>
   <div class="grid g2" style="margin-top:12px"><button class="btn xl" id="nS">저장 후 출력</button><button class="btn xl line" id="nMsg"><i class="i i-share"></i> 적발 알림 문구 공유</button></div>`,b=>{
    const sw=sigPad($('#sW',b),'근로자 서명'),sm=sigPad($('#sM',b),`측정자 서명 (${a.measurer})`,a.measurer===S.inspector?S.mySig:'');
    $('#nR',b).onchange=e=>$('#nWb').style.display=e.target.checked?'block':'none';
    $('#nMsg',b).onclick=()=>shareAlcMessage(a);
    $('#nS',b).onclick=async()=>{
      const refusedSign=$('#nR').checked;if(!refusedSign&&sw.isEmpty())return toast('근로자 서명 또는 서명 거부를 선택하세요');if(sm.isEmpty())return toast('측정자 서명이 필요합니다');
      if(refusedSign&&!$('#nWi').value.trim())return toast('서명 거부 시 입회자를 입력하세요');
      a.notice={place:$('#nP').value.trim(),items:$$('input[type=checkbox][value]',b).filter(x=>x.checked).map(x=>x.value),days:$('#nD').value.trim(),etc:$('#nE').value.trim(),sigW:refusedSign?'':sw.data(),sigM:sm.data(),refusedSign,witness:refusedSign?$('#nWi').value.trim():'',at:nowLocal()};
      if(!/통지서/.test(a.follow||''))a.follow=[a.follow,'통지서 작성'].filter(Boolean).join(' / ');
      await save('alcohol',a);toast('통지서 저장됨');
      const toV=$('#nV').checked;closeModal();
      if(toV){go('strike',{person:{name:a.name,company:a.company,job:a.job,workerId:a.workerId,alcId:a.id}});setTimeout(()=>{const c=$$('#vt .chip').find(x=>x.dataset.t.includes('음주'));c&&c.click();$('#detail').value=`음주측정 ${a.refused?'거부':f3(a.value)+'%'} (${fmtDT(a.at)})`},50)}
      else{R[cur]();printPages([docAlcohol(a)])}
    };
  });
}
/* 적발자 · 측정결과 통지서: 최근 30일 적발 + 날짜와 상관없이 통지서 미작성 */
function alcBadSection(){
  const bad=A.filter(a=>!a.void&&isAlcBad(a)&&(!a.notice||a.date>=addDays(today(),-30))).sort((x,y)=>y.at.localeCompare(x.at)).slice(0,50);
  const no=bad.filter(a=>!a.notice).length;
  return `<div class="row" style="margin:16px 0 8px"><h2 style="margin:0;flex:1">적발자 · 측정결과 통지서</h2>${no?`<span class="badge bbad">미작성 ${no}</span>`:''}</div>
  <div class="hint small" style="margin-bottom:8px">측정값이 기준 이상이면 저장할 때 통지서 화면이 자동으로 열립니다. 그때 못 했으면 아래 <b>[통지서 작성]</b>을 누르세요. 근로자·측정자 서명까지 받으면 기록으로 남고 출력할 수 있습니다.</div>
  <div class="card list">${bad.length?bad.map(a=>`<div class="it" data-aid="${a.id}"><span class="badge ${judgeCls(a.judge)}">${a.judge}</span><div class="m"><b>${h(a.name)}</b> <span class="muted small">${h(a.company)}</span><div class="small muted ell">${fmtDT(a.at)} · ${a.refused?'측정 거부':f3(a.value)+'%'}${a.badNo?' · '+a.badNo+'회 적발':''}${a.out?' · 영구퇴출':''}${a.notice?' · 통지서 완료':''}</div></div>${a.notice?`<button class="btn sm line" data-np="${a.id}"><i class="i i-print"></i> 출력</button>`:`<button class="btn sm bad" data-nw="${a.id}"><i class="i i-pen"></i> 통지서 작성</button>`}</div>`).join(''):'<div class="empty">최근 30일 적발자 없음</div>'}</div>`;
}
function showAlcohol(id){
  const a=A.find(x=>x.id===id);if(!a)return;const ch=retestChild(a);const par=a.retestOf&&A.find(x=>x.id===a.retestOf);
  openModal(`음주측정 · ${a.name}`,`<div class="judge badge ${judgeCls(a.judge)}" style="display:block;margin-bottom:12px">${a.refused?'측정 거부':f3(a.value)+'%'} · ${a.judge}${a.badNo?` · ${a.badNo}회 적발`:''}${a.out?' · 영구퇴출':''}</div>
   <dl class="kv"><dt>소속</dt><dd>${h(a.company)}</dd><dt>직종</dt><dd>${h(a.job)}</dd>${a.equip?`<dt>장비</dt><dd>${h(a.equip)} ${h(a.plate)}</dd>`:''}<dt>측정일시</dt><dd>${fmtDT(a.at)}</dd><dt>조치</dt><dd>${h(a.action)}</dd><dt>측정인</dt><dd>${h(a.measurer)}</dd><dt>사후조치</dt><dd>${h(a.follow||'-')}</dd>
   ${par?`<dt>1차 측정</dt><dd>${hm(par.at)} ${par.value.toFixed(3)}%</dd>`:''}${ch?`<dt>재측정</dt><dd>${hm(ch.at)} ${ch.refused?'거부':ch.value.toFixed(3)+'%'} → ${ch.judge}</dd>`:''}${a.void?`<dt>무효</dt><dd>${h(a.void.reason)}</dd>`:''}</dl>
   <div class="row" style="margin-top:14px">
   ${isAlcBad(a)&&!a.void?`<button class="btn bad" id="nt"><i class="i i-pen"></i> ${a.notice?'통지서 다시 작성':'측정결과 통지서 작성'}</button>${a.notice?'<button class="btn" id="np"><i class="i i-print"></i> 통지서 출력</button>':''}<button class="btn line" id="ms"><i class="i i-share"></i> 알림 문구</button>`:''}
   ${a.judge!=='정상'&&!ch&&!a.void?'<button class="btn line" id="rt">재측정 입력</button>':''}
   <button class="btn line" id="fm">사후조치 메모</button>
   ${!a.void&&isAdmin()?'<button class="btn line" id="vd">무효 처리</button>':''}</div>`,b=>{
    const rt=$('#rt',b);if(rt)rt.onclick=()=>{closeModal();go('alcohol');alcForm({name:a.name,company:a.company,job:a.job,workerId:a.workerId,equip:a.equip,plate:a.plate},a)};
    const nt=$('#nt',b);if(nt)nt.onclick=()=>alcNotice(a.id);
    const np=$('#np',b);if(np)np.onclick=()=>printPages([docAlcohol(a)]);
    const ms=$('#ms',b);if(ms)ms.onclick=()=>shareAlcMessage(a);
    $('#fm',b).onclick=async()=>{const r=prompt('사후조치 내용',a.follow||'');if(r===null)return;a.follow=r;await save('alcohol',a);showAlcohol(a.id);R[cur]()};
    const vd=$('#vd',b);if(vd)vd.onclick=async()=>{const r=prompt('무효 사유 (기록은 삭제되지 않음)');if(!r)return;a.void={reason:r,at:nowLocal()};await save('alcohol',a);closeModal();R[cur]()};
  });
}

/* --- 근로자 --- */
