// 현장ON — 기록·보고 and 설정 screens
'use strict';
R.records=()=>{
  const from=R.records.from||addDays(today(),-30),to=R.records.to||today(),ty=R.records.ty||'';
  const vs=V.filter(v=>v.date>=from&&v.date<=to);const as=A.filter(a=>a.date>=from&&a.date<=to);
  const items=[...(ty!=='a'?vs.map(v=>({at:v.at,html:vItem(v)})):[]),...(ty!=='v'?as.filter(a=>ty==='a'||a.judge!=='정상').map(a=>({at:a.at,html:alcItem(a)})):[])].sort((a,b)=>b.at.localeCompare(a.at));
  V$().innerHTML=`<h1>기록 · 보고</h1>
  <div class="card"><div class="grid g2"><div><label class="f">시작일</label><input type="date" class="inp" id="rf" value="${from}"></div><div><label class="f">종료일</label><input type="date" class="inp" id="rt" value="${to}"></div></div>
  <div class="chips" style="margin-top:10px">${[['','전체 (음주는 이상자만)'],['v','삼진아웃'],['a','음주측정 전체']].map(([v,t])=>`<button class="chip ${ty===v?'on':''}" data-ty="${v}">${t}</button>`).join('')}</div>
  <div class="row" style="margin-top:12px"><button class="btn" id="rx"><i class="i i-sheet"></i> 기간 엑셀 저장</button><button class="btn line" id="rp"><i class="i i-print"></i> 확인서 일괄 출력</button></div></div>
  <div class="card list">${items.length?items.map(i=>i.html).join(''):'<div class="empty">기간 내 기록 없음</div>'}</div>
  <h2>백업</h2><div class="card"><div class="small muted" style="margin-bottom:10px">기록은 이 기기 브라우저에만 저장됩니다. 주기적으로 백업 파일을 저장해 두세요. (지침: 관련 기록 3년 보관)</div>
  <div class="row">${isAdmin()?'<button class="btn ghost" id="bk"><i class="i i-save"></i> 전체 백업 저장</button><label class="btn line"><i class="i i-folder"></i> 백업 복원<input type="file" accept=".json" hidden id="rs"></label>':'<span class="small muted">백업·복원은 운영자만 할 수 있습니다.</span>'}</div></div>`;
  $('#rf').onchange=e=>{R.records.from=e.target.value;R.records()};$('#rt').onchange=e=>{R.records.to=e.target.value;R.records()};
  $$('[data-ty]').forEach(b=>b.onclick=()=>{R.records.ty=b.dataset.ty;R.records()});
  $('#rx').onclick=()=>{
    const wb=XLSX.utils.book_new();const hd=['NO','적발일시','소속업체','성명','직종','위반내용','상세','장소','차수','조치사항','교육이수','점검자','위반자확인','비고'];
    XLSX.utils.book_append_sheet(wb,sheet([[`삼진아웃제 적발 관리대장 (${from} ~ ${to})`],['현장명 :',S.site],hd,...violationRows(vs.sort((a,b)=>a.at.localeCompare(b.at)))],[5,16,16,9,10,22,20,14,6,40,16,16,16,16],['A1:N1']),'삼진아웃');
    const ah=['NO','측정일시','소속/업체명','직종','성명','장비','차량번호','측정결과(%)','판정','조치사항','측정인','사후조치','확인서','비고'];
    XLSX.utils.book_append_sheet(wb,sheet([[`음주측정 기록 (${from} ~ ${to})`],['현장명 :',S.site],ah,...as.sort((a,b)=>a.at.localeCompare(b.at)).map((a,i)=>[i+1,fmtDT(a.at),a.company,a.job,a.name+(a.retestOf?' (재측정)':''),a.equip,a.plate,a.refused?'거부':a.value.toFixed(3),a.judge,a.action,a.measurer,a.follow||'',a.notice?'작성':'',a.void?'무효: '+a.void.reason:''])],[5,16,16,10,12,14,12,10,9,22,10,24,7,14],['A1:N1']),'음주측정');
    download(wb,`안전관리기록_${from}_${to}.xlsx`)};
  $('#rp').onclick=()=>{const pages=[...vs.filter(v=>!v.void).map(docViolation),...as.filter(a=>a.notice&&!a.void).map(docAlcohol)];if(!pages.length)return toast('출력할 확인서 없음');printPages(pages)};
  if($('#bk'))$('#bk').onclick=()=>{const blob=new Blob([JSON.stringify({app:'fieldsafety',v:1,at:nowLocal(),settings:S,...Object.fromEntries(STORE_NAMES.map(s=>[s,STORE[s]()]))})],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`현장ON_백업_${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
  if($('#rs'))$('#rs').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(d.app!=='fieldsafety')throw 0;
    if(!confirm(`백업(${d.at})을 복원합니다.\n같은 ID 기록은 덮어쓰고, 없는 기록은 추가합니다. 계속할까요?`))return;
    if(SERVER){for(const s of STORE_NAMES)if((d[s]||[]).length)await pushImport(s,d[s],false);if(d.settings){applyShared(d.settings);await saveSettings();await queueShared()}}
    else{for(const s of STORE_NAMES)await DB.putMany(s,d[s]||[]);if(d.settings){S=Object.assign(S,d.settings);await saveSettings()}await loadAll()}
    toast('복원 완료');R.records()}catch(x){toast(x.message&&x.message!=='0'?x.message:'백업 파일이 아닙니다')}};
  bindItems();
};

/* --- 설정 --- */
R.settings=()=>{
  const adm=isAdmin();
  V$().innerHTML=`<h1>설정</h1>
  <section class="st" data-st="me">
  ${SERVER?`<div class="card"><div class="row"><div class="grow"><b>${h(ME.name)}</b> <span class="muted small">${h(ME.loginId)}</span> ${roleBadge(ME.role)}</div><button class="btn sm line" id="pwBtn">비밀번호 변경</button><button class="btn sm line" id="outBtn">로그아웃</button></div></div>`:''}
  </section><section class="st" data-st="users">
  ${SERVER&&adm?`<div class="card"><div class="row"><b class="grow">사용자 관리</b><button class="btn sm line" id="uBulk"><i class="i i-plus"></i> 여러 명 등록</button><button class="btn sm" id="uAdd"><i class="i i-plus"></i> 사용자 등록</button></div><div class="small muted" style="margin-top:4px">등록한 사람만 로그인할 수 있습니다. 첫 로그인 때 비밀번호를 직접 바꾸게 됩니다.</div><div class="list" id="usersBox" style="margin-top:6px"><div class="empty">불러오는 중…</div></div></div>`:''}
  </section><section class="st" data-st="me">
  <div class="card" id="myCard"><b>내 정보</b> <span class="small muted">— 등록하면 점검자·측정인·상담자 이름과 서명이 자동으로 들어갑니다</span>
   <div class="grid g2"><div><label class="f">소속</label><input class="inp" id="sO" value="${h(S.inspectorOrg)}" placeholder="예) OO건설 안전팀"></div><div><label class="f">성명</label><input class="inp" id="sI" value="${h(S.inspector)}" placeholder="이름"></div>
   <div><label class="f">직책</label><input class="inp" id="sRole" value="${h(S.myRole||'')}" placeholder="예) 안전관리자"></div><div></div></div>
   <label class="f">내 서명</label><div id="mySigBox"></div>
   <button class="btn" id="mySave" style="width:100%;margin-top:12px">내 정보 저장</button></div>
  </section><section class="st" data-st="site">
  ${adm?'':'<div class="hint" style="margin-bottom:12px">현장명·삼진아웃·음주 기준은 운영자가 관리합니다.</div><div hidden>'}
  <div class="card"><label class="f">현장명</label><input class="inp" id="sS" value="${h(S.site)}" placeholder="현장명을 직접 입력하세요"></div>
  ${adm?'<div class="card"><b>카테고리</b> <span class="small muted">— 카테고리마다 홈 타일이 생깁니다. 유형: PDF 문서함 · 사진대지 · 점검표 · 작성 양식</span><div id="dcBox" style="margin-top:6px"></div></div>':''}
  ${adm?'<div class="card"><b>양식 문구</b> <span class="small muted">— 인쇄되는 확인서·통지서의 제목과 문구. 비우면 기본 문구</span><div id="fmBox" style="margin-top:6px"></div></div>':''}
  ${adm?'<div class="card"><b>홈 화면 배치</b> <span class="small muted">— 바꾸는 즉시 저장되고 모든 사용자 홈에 같게 적용됩니다</span><div id="hlBox" style="margin-top:6px"></div></div>':''}
  <div class="card"><b>삼진아웃 기준</b>
   <label class="f">누적 기간</label><select class="inp" id="sP">${[[0,'공사 기간 전체 누적'],[3,'최근 3개월'],[6,'최근 6개월'],[12,'최근 12개월']].map(([v,t])=>`<option value="${v}" ${S.periodMonths==v?'selected':''}>${t}</option>`).join('')}</select>
   ${S.levels.map((l,i)=>`<div style="border-left:6px solid var(--l${i+1});padding-left:10px;margin-top:12px"><div class="grid g2"><div><label class="f">${i+1}차 명칭</label><input class="inp" data-ln="${i}" value="${h(l.name)}"></div><div><label class="f">스티커 색</label><input class="inp" data-ls="${i}" value="${h(l.sticker)}"></div></div><label class="f">조치사항 (줄바꿈 구분)</label><textarea class="inp" data-la="${i}">${h(l.act)}</textarea></div>`).join('')}
   <label class="f">위반 유형 (한 줄에 하나)</label><textarea class="inp" id="sV" style="min-height:180px">${h(S.vtypes.join('\n'))}</textarea></div>
  <div class="card"><b>음주측정 판정 기준</b>
   <label class="f">적용 기준</label><select class="inp" id="sAm"><option value="site" ${S.alcMode==='site'?'selected':''}>현장 기준 (오전 중지 / 당일 중지·심의 / 2회 영구퇴출)</option><option value="policy" ${S.alcMode==='policy'?'selected':''}>회사 음주관리 지침 5.3 (재측정 / 작업금지)</option></select>
   <div class="grid g2"><div><label class="f">[현장] 적발 기준 (% 이상)</label><input class="inp" id="sDt" inputmode="decimal" value="${f3(S.alc.detect)}"></div><div><label class="f">[현장] 당일 작업중지 기준 (% 이상)</label><input class="inp" id="sDy" inputmode="decimal" value="${f3(S.alc.day)}"></div><div><label class="f">[현장] 영구퇴출 적발 횟수</label><input class="inp" id="sOc" inputmode="numeric" value="${S.alc.outCount}"></div></div>
   <div class="grid g2"><div><label class="f">[지침] 재측정 기준 (% 이상)</label><input class="inp" id="sR" inputmode="decimal" value="${S.alc.retest.toFixed(3)}"></div><div><label class="f">[지침] 작업금지·귀가 기준 (% 이상)</label><input class="inp" id="sT" inputmode="decimal" value="${S.alc.stop.toFixed(3)}"></div></div>
   <div class="small muted" style="margin-top:6px">[지침] 재측정에서 다시 재측정 기준 이상이면 음주상태로 판정(작업금지). 측정거부는 출입통제·작업배제.</div>
   <label class="f">적발 알림 문구 — {업체} {일시} {성명} {직종} {수치} {조치} {기준} 자동 치환</label><textarea class="inp" id="sMsg" style="min-height:220px">${h(S.alcMsg)}</textarea></div>
  ${adm?'<div class="card"><b>장비 종류별 점검표 양식</b> <span class="small muted">— 장비명에 키워드가 들어 있으면 그 양식을 씁니다. 어디에도 안 맞으면 아래 기본 양식</span><div id="efBox"></div></div>':''}
  <div class="card"><b>기본 주간 점검표 항목 (굴착기 등)</b> <span class="small muted">— 한 줄에 하나</span>
   <textarea class="inp" id="sEqC" style="min-height:240px;font-size:14px">${h(S.eqCheckItems||DEF.eqCheckItems)}</textarea>
   <div class="small muted" style="margin-top:6px">기본값: 「장비 전담 관리자 점검표」 일일점검표 13개 항목.</div>
   <label class="f" style="margin-top:14px">장비 주간 사진 항목 — "항목|설명" (맨 앞 '점검사진'은 자동)</label>
   <textarea class="inp" id="sEq" style="min-height:180px;font-size:14px">${h(S.eqItems||DEF.eqItems)}</textarea>
   <div class="small muted" style="margin-top:6px">기본값: 장비전담제 장비점검방법 10~16쪽.</div></div>
  <div class="card"><b>취약근로자 열람 범위</b>
   <select class="inp" id="sVs" style="margin-top:8px"><option value="admin" ${S.vulnScope!=='all'?'selected':''}>운영자·관리자만 (권장 — 건강정보 보호)</option><option value="all" ${S.vulnScope==='all'?'selected':''}>모든 사용자</option></select>
   <div class="small muted" style="margin-top:6px">검진 결과·혈압은 개인정보보호법상 민감정보입니다. '운영자·관리자만'이면 서버가 일반 사용자에게 아예 보내지 않고, 이미 받은 기기에서도 지워집니다.</div></div>
  <div class="card"><b>취약근로자 기준</b>
   <div class="grid g2"><div><label class="f">고령 분류 연령 (세 이상)</label><input class="inp" id="sVa" inputmode="numeric" value="${S.vulnAge}"></div><div></div>
   <div><label class="f">혈압 주의 (수축기/이완기 이상)</label><input class="inp" id="sBw" value="${S.bp.warn.join('/')}"></div><div><label class="f">혈압 위험 (수축기/이완기 이상)</label><input class="inp" id="sBs" value="${S.bp.stop.join('/')}"></div></div></div>
  ${adm?'':'</div>'}
  </section><section class="st" data-st="me">
  <div class="card"><b>갤러리 사진 사용</b><div class="row" style="margin-top:8px"><span class="grow small">${S.galleryConsent?`동의함 (${fmtDT(S.galleryConsent.at)})`:'동의 안 함 — 갤러리에서 선택할 때 동의를 묻습니다'}</span>${S.galleryConsent?'<button class="btn sm line" id="gcOff">동의 철회</button>':''}</div></div>
  <div class="card"><b>잠금</b><label class="f">PIN (숫자 4~6자리, 비우면 잠금 없음)</label><input class="inp" id="sN" inputmode="numeric" maxlength="6" value="${h(S.pin)}">
   <div class="small muted" style="margin-top:6px">지침 10.3: 기록 열람은 현장소장 및 안전관리책임자로 제한.</div></div>
  </section><section class="st" data-st="me site">
  <button class="btn xl" id="sSave">저장</button>
  </section><section class="st" data-st="data">
  <div class="card"><b>데이터</b><div style="height:6px"></div><div class="small muted">근로자 ${W.length} · 장비 ${E.length} · 삼진아웃 ${V.length} · 음주측정 ${A.length} · 취약근로자 ${VU.length}</div>
  ${SERVER&&adm?'<div class="hint small" id="stoBox" style="margin-top:10px">저장소 상태 확인 중…</div><div class="hint small" id="bkBox" style="margin-top:10px">백업 목록 확인 중…</div>':''}
  ${adm?'<div class="row" style="margin-top:10px"><button class="btn line" id="dW">근로자 대장 비우기</button><button class="btn line" id="dE">장비 대장 비우기</button></div>':''}${SERVER?'<button class="btn sm line" id="syncNow" style="margin-top:10px">지금 동기화</button>':''}</div>
  <div class="card small muted">앱 설치: 크롬/사파리 메뉴 → "홈 화면에 추가". 인터넷 없이도 동작합니다.<br>버전 ${APP_VER} · 인터넷에 연결되어 있으면 새 버전을 자동으로 받습니다.</div>
  </section>`;
  /* 내 서명: 저장된 서명이 있으면 보여주고, 다시 그리면 교체 */
  const drawMine=()=>{$('#mySigBox').innerHTML=S.mySig?`<div class="sig" style="padding:8px;text-align:center;background:#fff"><img src="${S.mySig}" style="max-width:100%;height:110px;object-fit:contain"></div><div class="row" style="margin-top:8px"><button class="btn sm line" id="myRe">다시 등록</button><button class="btn sm line" id="myDel">서명 삭제</button></div>`:'<div id="myPad"></div>';
    if(!S.mySig)window._myPad=sigPad($('#myPad'),'여기에 서명');else{window._myPad=null;$('#myRe').onclick=()=>{S._reSig=true;$('#mySigBox').innerHTML='<div id="myPad"></div>';window._myPad=sigPad($('#myPad'),'여기에 새 서명')};$('#myDel').onclick=async()=>{if(!confirm('저장된 내 서명을 삭제할까요?'))return;if(SERVER){try{const r=await api('me',{sig:''});await kvSet('me',r.user);applyMe(r.user)}catch(x){return toast(x.message)}}S.mySig='';await saveSettings();drawMine()}}};
  drawMine();
  const saveMine=async()=>{const nm=$('#sI').value.trim();if(!nm){toast('성명을 입력하세요');$('#sI').focus();return false}
    const newSig=window._myPad&&!window._myPad.isEmpty()?window._myPad.data():null;
    if(SERVER){try{const r=await api('me',{name:nm,org:$('#sO').value.trim(),title:$('#sRole').value.trim(),...(newSig?{sig:newSig}:{})});await kvSet('me',r.user);applyMe(r.user)}catch(x){toast(x.status?x.message:'내 정보 저장은 인터넷 연결이 필요합니다');return false}}
    else{Object.assign(S,{inspectorOrg:$('#sO').value.trim(),inspector:nm,myRole:$('#sRole').value.trim()});if(newSig)S.mySig=newSig}
    delete S._reSig;await saveSettings();return true};
  $('#mySave').onclick=async()=>{if(await saveMine()){toast(S.mySig?'내 정보·서명 저장됨':'내 정보 저장됨 (서명은 아직 없음)');drawMine()}};
  const gco=$('#gcOff');if(gco)gco.onclick=async()=>{S.galleryConsent=null;await saveSettings();toast('갤러리 사용 동의 철회됨');R.settings()};
  $('#sSave').onclick=async()=>{
    const pin0=$('#sN').value.trim();if(pin0&&!/^\d{4,6}$/.test(pin0))return toast('PIN은 숫자 4~6자리');S.pin=pin0;
    if(!adm||R.settings.tab==='me'){if(await saveMine()){await saveSettings();toast('저장됨')}return}
    const r=parseFloat($('#sR').value),t=parseFloat($('#sT').value),dt=parseFloat($('#sDt').value),dy=parseFloat($('#sDy').value),oc=parseInt($('#sOc').value);if(!(r>0&&t>r&&dt>0&&dy>dt&&oc>=1))return toast('음주 기준값을 확인하세요');
    const bpP=v=>{const m=String(v).match(/(\d{2,3})\s*\/\s*(\d{2,3})/);return m?[+m[1],+m[2]]:null};const bw=bpP($('#sBw').value),bs=bpP($('#sBs').value),va=parseInt($('#sVa').value);
    if(!bw||!bs||!(va>0))return toast('취약근로자 기준값을 확인하세요 (예: 140/90)');S.bp={warn:bw,stop:bs};S.vulnAge=va;S.vulnScope=$('#sVs').value==='all'?'all':'admin';S.eqItems=$('#sEq').value.split('\n').map(x=>x.trim()).filter(Boolean).join('\n')||DEF.eqItems;S.eqCheckItems=$('#sEqC').value.split('\n').map(x=>x.trim()).filter(Boolean).join('\n')||DEF.eqCheckItems;
    const pin=$('#sN').value.trim();if(pin&&!/^\d{4,6}$/.test(pin))return toast('PIN은 숫자 4~6자리');
    if($('#sI').value.trim()&&!(await saveMine()))return;
    Object.assign(S,{site:$('#sS').value.trim(),periodMonths:+$('#sP').value,pin,alc:{retest:r,stop:t,detect:dt,day:dy,outCount:oc},alcMode:$('#sAm').value,alcMsg:$('#sMsg').value,
      vtypes:$('#sV').value.split('\n').map(s=>s.trim()).filter(Boolean),
      levels:S.levels.map((l,i)=>({name:$(`[data-ln="${i}"]`).value.trim()||l.name,sticker:$(`[data-ls="${i}"]`).value.trim(),act:$(`[data-la="${i}"]`).value.trim()}))});
    await saveSettings();if(SERVER)await queueShared();$('#siteName').textContent=S.site;toast(SERVER?'저장됨 — 모든 사용자에게 적용됩니다':'저장됨');drawMine()};
  const clearReg=async(store,msg)=>{if(!confirm(msg))return;try{if(SERVER)await pushImport(store,[],true);else{await DB.putMany(store,[],true);if(store==='workers')W=[];else E=[]}R.settings()}catch(x){toast(x.message)}};
  if($('#dW'))$('#dW').onclick=()=>clearReg('workers','근로자 대장을 모두 지웁니다. (적발·측정 기록은 유지) 계속할까요?');
  if($('#dE'))$('#dE').onclick=()=>clearReg('equipment','장비 대장을 모두 지웁니다. 계속할까요?');
  const bkBox=$('#bkBox');
  const loadBk=async()=>{if(!bkBox)return;try{const r=await api('admin/backups');const fmt=n=>`${n.slice(0,4)}.${n.slice(4,6)}.${n.slice(6,8)} ${n.slice(8,10)}:${n.slice(10,12)}`;
    bkBox.innerHTML=`<div class="row"><b class="grow">서버 자동 백업</b><button class="btn sm" id="bkNow">지금 백업</button></div>
      <div style="margin:4px 0 6px">매주 월요일 새벽 3시 자동 저장 · 최근 12주 보관 (사진은 R2에 그대로 보관)</div>
      ${r.backups.length?r.backups.slice(0,15).map(b=>`<div class="row" style="padding:4px 0;border-top:1px solid var(--line)"><span class="grow">${fmt(b.name)} ${b.name.includes('manual')?'(수동)':'(자동)'} · ${Math.max(1,Math.round(b.size/1024))}KB</span><a class="btn sm line" href="/api/admin/backups/${b.name}" download>받기</a></div>`).join(''):'<div class="muted">아직 백업 없음</div>'}
      <div class="muted" style="margin-top:6px">받은 파일은 기록·보고 탭의 [백업 복원]으로 되돌릴 수 있습니다.</div>`;
    $('#bkNow').onclick=async()=>{const b=$('#bkNow');b.disabled=true;b.textContent='백업 중…';try{await api('admin/backups',{});toast('백업 완료')}catch(e){toast(e.message)}loadBk()};
  }catch(e){bkBox.textContent='백업 목록을 불러오지 못했습니다'}};
  if(R.settings.tab==='data')loadBk();
  const stoBox=$('#stoBox');
  const loadSto=async()=>{if(!stoBox)return;try{const r=await api('admin/storage');const mb=b=>(b/1048576).toFixed(1)+'MB';
    stoBox.innerHTML=`<b>서버 저장소</b><br>사진 저장: ${r.r2?'<b>R2 저장소</b> (무료 10GB)':'데이터베이스 (무료 500MB 중 일부)'}<br>데이터베이스 안 사진: ${r.d1Blobs}장 · ${mb(r.d1BlobBytes)} &nbsp;|&nbsp; 기록: ${r.docs}건 · ${mb(r.docBytes)}${r.r2&&r.d1Blobs?`<br><button class="btn sm" id="stoMove" style="margin-top:8px">데이터베이스 사진 ${r.d1Blobs}장 → R2로 옮기기</button>`:''}`;
    const mv=$('#stoMove');if(mv)mv.onclick=async()=>{mv.disabled=true;let left=r.d1Blobs,moved=0;try{while(left>0){const x=await api('admin/migrate-blobs',{});moved+=x.moved;left=x.remaining;mv.textContent=`옮기는 중… ${moved}장 완료, ${left}장 남음`;if(!x.moved)break}toast(`사진 ${moved}장을 R2로 옮겼습니다`)}catch(e){toast(e.message)}loadSto()};
  }catch(e){stoBox.textContent='저장소 상태를 불러오지 못했습니다'}};
  if(R.settings.tab==='data')loadSto();
  if($('#syncNow'))$('#syncNow').onclick=async()=>{await Sync.run();toast(Sync.state==='ok'?'동기화 완료':'서버에 연결할 수 없습니다');R.settings()};
  if($('#pwBtn'))$('#pwBtn').onclick=async()=>{const u=await authScreen('pw');await kvSet('me',u);applyMe(u);toast('비밀번호 변경됨')};
  if($('#outBtn'))$('#outBtn').onclick=()=>{if(confirm('로그아웃할까요?'))logout()};
  if(adm){bindHomeLayout();bindDocCats();bindForms();bindEqForms()}
  if(SERVER&&adm){$('#uAdd').onclick=()=>editUser();$('#uBulk').onclick=()=>bulkUsers();if(R.settings.tab==='users')loadUsers()}
};
