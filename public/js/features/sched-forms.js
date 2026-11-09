// 현장ON — 일정표 입력: 빠른 입력(한 줄에 일정 하나) · 하나씩 추가·수정
'use strict';
/* ---------- 빠른 입력 (한 줄에 일정 하나) ---------- */
function schedQuick(){
  const xl=can('file.excel');
  openModal('일정 추가',`<div class="small muted">한 줄에 일정 하나: <b>날짜 → 시간(생략 가능) → 내용</b>. 날짜만 쓴 줄 아래 줄들은 그 날짜로 들어갑니다.</div>
    <textarea class="inp" id="scTx" rows="6" style="margin-top:8px" placeholder="14일 오후 노사협의체 회의&#10;15일 14시 안전점검&#10;내일 9시 30분 교육"></textarea>
    <div id="scPv" class="sch-pv"></div>
    <button class="btn" id="scGo" style="width:100%;margin-top:10px">등록하기</button>
    ${xl?'<button class="btn line" id="scXl" style="width:100%;margin-top:8px"><i class="i i-sheet"></i> 엑셀 계획서로 넣기</button><input type="file" id="scXf" accept=".xlsx,.xls,.xlsm" hidden>':''}
    <div style="text-align:center;margin-top:10px"><a href="#" id="scOne" class="small">날짜·시간 직접 고르기</a></div>`,b=>{
    const tx=$('#scTx',b),pv=$('#scPv',b),go1=$('#scGo',b);
    const read=()=>SCHED_TXT.parseScheduleText(tx.value,new Date(),S.schedPm!==false);
    const draw=()=>{const r=read(),ok=r.filter(x=>!x.error).length;
      pv.innerHTML=r.map(x=>x.error?`<div class="bad">${h(x.line)} — ${h(x.error)}</div>`:`<div>${scMD(x.date)}${x.time?' · '+h(x.time):''} · ${h(x.title)}</div>`).join('');
      go1.textContent=ok?`${ok}건 등록하기`:'등록하기'};
    tx.oninput=draw;
    MODAL_GUARD=()=>!tx.value.trim()||confirm('입력한 일정을 버릴까요?');
    go1.onclick=async()=>{const r=read();if(!r.length)return toast('일정을 입력하세요');
      if(r.some(x=>x.error)){draw();return toast('빨간 줄을 고쳐야 저장됩니다')}
      go1.disabled=true;const lines=tx.value.split(/\r?\n/);let n=0;
      try{for(const x of r){await save('schedule',{id:uid(),date:x.date,time:x.time,title:x.title,created:nowLocal()});n++;
          const i=lines.findIndex(l=>l.trim()===x.line);if(i>=0)lines.splice(i,1)}}
      catch(e){tx.value=lines.join('\n');draw();go1.disabled=false;return toast(`${n}건 저장 후 멈췄습니다: ${e.message||e}`)}
      MODAL_GUARD=null;closeModal();toast(`일정 ${n}건을 넣었습니다`);if(cur==='schedule')R.schedule()};
    $('#scOne',b).onclick=e=>{e.preventDefault();MODAL_GUARD=null;schedOne({date:today(),time:'',title:''})};
    if(xl){const fi=$('#scXf',b);$('#scXl',b).onclick=()=>fi.click();fi.onchange=()=>{const f=fi.files[0];if(f){MODAL_GUARD=null;schedExcel(f)}}}
    setTimeout(()=>tx.focus(),50);
  });
}

/* ---------- 하나씩 추가·수정 (날짜 일정 또는 연간 예정) ---------- */
const SC_TIME_OK=/^(|오전|오후|종일|테마|([01]?\d|2[0-3]):[0-5]\d)$/;
function schedOne(o){
  const yr=!o.date&&'period' in o&&!o.date,isNew=!o.id;
  openModal(isNew?(yr?'연간 일정 추가':'일정 추가'):(yr?'연간 일정 수정':'일정 수정'),`
    ${yr?`<label class="f">시기 (예: 11월, 상반기)</label><input class="inp" id="soP" value="${h(o.period||'')}">`
      :`<label class="f">날짜</label><input class="inp" type="date" id="soD" value="${h(o.date||today())}">
        <label class="f">시간 (비우면 시간 없음)</label><input class="inp" id="soT" value="${h(o.time||'')}" placeholder="14:00">
        <div class="chips" style="margin-top:6px">${['종일','오전','오후'].map(x=>`<button type="button" class="chip${o.time===x?' on':''}" data-t="${x}">${x}</button>`).join('')}</div>`}
    <label class="f">일정 내용</label><input class="inp" id="soN" value="${h(o.title||'')}">
    <div class="small muted" style="margin-top:6px">전화번호는 넣지 마세요. 일정표는 모두가 봅니다.</div>
    <button class="btn" id="soS" style="width:100%;margin-top:12px">저장</button>
    ${!isNew&&canDel(o)?'<button class="btn line" id="soX" style="width:100%;margin-top:8px;color:var(--bad)">삭제</button>':''}`,b=>{
    $$('[data-t]',b).forEach(c=>c.onclick=()=>{$('#soT',b).value=c.dataset.t;$$('[data-t]',b).forEach(x=>x.classList.toggle('on',x===c))});
    $('#soS',b).onclick=async()=>{
      const title=$('#soN',b).value.trim();if(!title)return toast('일정 내용을 입력하세요');
      const n={...o,title};
      if(yr){n.period=$('#soP',b).value.trim();if(!n.period)return toast('시기를 입력하세요')}
      else{n.date=$('#soD',b).value;n.time=$('#soT',b).value.trim().replace(/^(\d):/,'0$1:');if(!n.date)return toast('날짜를 고르세요');if(!SC_TIME_OK.test(n.time))return toast('시간은 14:00 · 오전 · 오후 · 종일 처럼 쓰세요')}
      if(isNew){n.id=uid();n.created=nowLocal()}
      try{await save('schedule',n)}catch(e){return toast(e.message||'저장하지 못했습니다')}
      closeModal();toast('저장했습니다');if(cur==='schedule')R.schedule()};
    const x=$('#soX',b);if(x)x.onclick=async()=>{if(!confirm(`"${o.title}" 일정을 삭제할까요?`))return;
      try{await remove('schedule',o.id)}catch(e){return toast(e.message||'삭제하지 못했습니다')}closeModal();toast('삭제했습니다');if(cur==='schedule')R.schedule()};
  });
}
