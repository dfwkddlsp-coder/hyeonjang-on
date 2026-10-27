// 현장ON — 카테고리 내용 구성 설정 (점검 항목 / 양식 칸)
'use strict';
/* 설정: 카테고리 내용 구성 (점검 항목 / 양식 칸) */
function catConfig(c,done){const t=catType(c);
  if(t==='check'){openModal(c.name+' — 점검표 구성',`<label class="f">기록 방식</label><select class="inp" id="ccM"><option value="each" ${c.mode!=='week'?'selected':''}>건별 — 점검할 때마다 한 장</option><option value="week" ${c.mode==='week'?'selected':''}>주간 — 월~토를 한 장에 (장비점검처럼)</option></select>
      <label class="f">점검 항목 (한 줄에 한 항목)</label><textarea class="inp" id="ccI" rows="10" placeholder="안전난간 설치 상태&#10;작업발판 고정 상태">${h(c.items||'')}</textarea>
      <button class="btn xl" id="ccOk" style="width:100%;margin-top:12px">적용</button>`,b=>{$('#ccOk',b).onclick=()=>{c.mode=$('#ccM',b).value;c.items=$('#ccI',b).value.split('\n').map(x=>x.trim()).filter(Boolean).join('\n');if(!c.items)return toast('점검 항목을 1개 이상 입력하세요');closeModal();done()}});return}
  if(t==='form'){let F=(c.fields||[]).map(f=>({...f}));
    openModal(c.name+' — 양식 구성',`<div class="small muted">작성할 칸을 만드세요. 칸 종류: 글자 · 긴 글 · 숫자 · 날짜 · 선택(목록) · 체크 · 사진 · 서명. 작성일과 작성자는 자동으로 들어갑니다.</div><div id="ccF"></div>
      <button class="btn sm line" id="ccAdd" style="margin-top:8px"><i class="i i-plus"></i> 칸 추가</button><button class="btn xl" id="ccOk" style="width:100%;margin-top:12px">적용</button>`,b=>{
      const draw=()=>{$('#ccF',b).innerHTML=F.map((f,i)=>`<div style="padding:8px 0;border-top:1px solid var(--line)"><div class="row" style="gap:6px;flex-wrap:nowrap"><input class="inp grow" data-fl="${i}" value="${h(f.l)}" placeholder="칸 이름" style="min-width:0;padding:6px 8px">
          <select class="inp" data-ft="${i}" style="width:auto;padding:6px">${Object.entries(FIELD_TYPES).map(([k,l])=>`<option value="${k}" ${f.t===k?'selected':''}>${l}</option>`).join('')}</select>
          <button class="btn sm line" data-fu="${i}" ${i?'':'disabled'}>▲</button><button class="btn sm line" data-fx="${i}">✕</button></div>
          <div class="row" style="gap:8px;margin-top:6px">${f.t==='sel'?`<input class="inp grow" data-fo="${i}" value="${h(f.o||'')}" placeholder="선택지 (쉼표로 구분) 예) 양호, 불량, 보수필요" style="padding:6px 8px">`:''}<label class="small row" style="gap:4px"><input type="checkbox" data-fr="${i}" ${f.req?'checked':''}> 필수</label></div></div>`).join('')||'<div class="empty">칸을 추가하세요</div>';
        $$('[data-fl]',b).forEach(x=>x.oninput=()=>{F[+x.dataset.fl].l=x.value});
        $$('[data-fo]',b).forEach(x=>x.oninput=()=>{F[+x.dataset.fo].o=x.value});
        $$('[data-fr]',b).forEach(x=>x.onchange=()=>{F[+x.dataset.fr].req=x.checked});
        $$('[data-ft]',b).forEach(x=>x.onchange=()=>{F[+x.dataset.ft].t=x.value;draw()});
        $$('[data-fu]',b).forEach(x=>x.onclick=()=>{const i=+x.dataset.fu;[F[i-1],F[i]]=[F[i],F[i-1]];draw()});
        $$('[data-fx]',b).forEach(x=>x.onclick=()=>{F.splice(+x.dataset.fx,1);draw()})};
      draw();$('#ccAdd',b).onclick=()=>{F.push({id:uid(),l:'',t:'text'});draw();const ins=$$('[data-fl]',b);ins[ins.length-1].focus()};
      $('#ccOk',b).onclick=()=>{F=F.filter(f=>f.l.trim()).map(f=>({id:f.id,l:f.l.trim(),t:f.t,o:f.t==='sel'?(f.o||''):'',req:!!f.req}));if(!F.length)return toast('칸을 1개 이상 만드세요');c.fields=F;closeModal();done()}});return}
  toast(t==='photo'?'사진대지 형식(한 칸에 4장 / 1장)은 작성하는 사람이 기록마다 고릅니다':'PDF 문서함은 따로 구성할 것이 없습니다')}
