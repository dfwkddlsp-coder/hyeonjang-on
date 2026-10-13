// 현장ON — 안내 봇(안전온): 경례하는 픽셀 캐릭터, 자주 묻는 질문 + AI 답변, 운영자에게 의견 보내기, 받은 의견(운영자)
'use strict';
/* ---------- 픽셀 캐릭터 (16×20, 내림 / 경례) ---------- */
const GB_PAL={W:'#fbfbf8',w:'#d9d6cf',G:'#2f9e5b',K:'#1a1a1a',S:'#f6c9a0',P:'#f29a9a',M:'#b5443a',L:'#cfe6f5',E:'#1a1a1a',T:'#ffffff',V:'#c8f03c',R:'#e8e8e8',N:'#18223d',B:'#4a3426'};
const GB_DOWN=['.....WWWWWW.....','....WWWGGWWW....','...WWGGGGGGWW...','...WWWWGGWWWW...','.wwwwwwwwwwwwww.','..KSSSSSSSSSSK..','..SKKKKKKKKKKS..','..SKLEKSSKELKS..','..SKLEKSSKELKS..','..SKKKKSSKKKKS..','..SPSSSMMSSSPS..','...SSSSSSSSSS...','...VVVVTTVVVV...','..VVVVVTTVVVVV..','..VRRRRRRRRRRV..','..VVVVVVVVVVVV..','..SVVVVVVVVVVS..','...NNNNNNNNNN...','...NNNN..NNNN...','..BBBBB..BBBBB..'];
const GB_UP=['.....WWWWWW.....','....WWWGGWWW....','...WWGGGGGGWW...','...WWWWGGWWWW...','.wwwwwwwwwwwwww.','.SSSSSSSSSSSSK..','.VSKKKKKKKKKKS..','.VSKLEKSSKELKS..','VVSKLEKSSKELKS..','V.SKKKKSSKKKKS..','V.SPSSMMMMSSPS..','VV.SSSSSSSSSS...','.VVVVVVTTVVVV...','...VVVVTTVVVVV..','...RRRRRRRRRRV..','...VVVVVVVVVVV..','...VVVVVVVVVVS..','...NNNNNNNNNN...','...NNNN..NNNN...','..BBBBB..BBBBB..'];
const GB_CALM=matchMedia('(prefers-reduced-motion: reduce)');
let gbUp=true,gbT=null;
function gbDraw(cv,up){const x=cv.getContext('2d');x.clearRect(0,0,16,21);const dy=up&&!GB_CALM.matches?0:1;
  (up?GB_UP:GB_DOWN).forEach((row,r)=>[...row].forEach((c,i)=>{if(c!=='.'){x.fillStyle=GB_PAL[c];x.fillRect(i,r+dy,1,1)}}))}
const gbChar=(cls='')=>`<canvas class="gbc ${cls}" width="16" height="21" aria-hidden="true"></canvas>`;
/* 화면에 있는 캐릭터를 한꺼번에: 경례 0.9초 ↔ 내림 0.7초 (움직임 줄이기를 켠 기기는 경례한 채로 멈춤) */
function gbTick(){clearTimeout(gbT);$$('canvas.gbc').forEach(c=>gbDraw(c,gbUp));if(GB_CALM.matches||document.hidden){gbUp=true;return}
  gbT=setTimeout(()=>{gbUp=!gbUp;gbTick()},gbUp?900:700)}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)gbTick()});

/* ---------- 오른쪽 아래 캐릭터 버튼 ---------- */
const gbSet=()=>Object.assign({},DEF.guide,S.guide||{});
function gbFab(){let b=$('#guideFab');
  if(!b){b=document.createElement('button');b.id='guideFab';b.type='button';b.className='gb-fab';b.setAttribute('aria-label','안내 도우미');b.innerHTML=gbChar();b.onclick=openGuide;document.body.appendChild(b)}
  b.title=gbSet().name;gbTick()}

/* ---------- 안내 창 ---------- */
let GB_HIST=[]; // 이번에 나눈 AI 대화 (최근 몇 개만 서버로 보냄)
function openGuide(){
  const G=gbSet(),who=(ME&&ME.name)||S.inspector||'';
  const faqs=(G.faqs||[]).filter(f=>f.q&&f.a&&(viewOk('home')||f.drv));
  const ai=SERVER&&G.aiOn!==false;
  openModal(G.name,`<div class="gb-chat" id="gbLog">
    <div class="gb-bot">${gbChar('av')}<div class="gb-b">${nl(String(G.greet||'').replace(/\{이름\}/g,who||'현장'))}</div></div>
    <div class="gb-quick">${faqs.map((f,i)=>`<button type="button" data-fq="${i}">${h(f.q)}</button>`).join('')}${SERVER?'<button type="button" class="fb" id="gbFb"><i class="i i-note"></i> 운영자에게 의견 보내기</button>':''}</div></div>
    ${ai?`<div class="gb-in"><input class="inp" id="gbQ" placeholder="궁금한 점을 입력하세요" maxlength="300" enterkeyhint="send"><button class="btn" id="gbSend">보내기</button></div>`:''}`,b=>{
    const log=$('#gbLog',b);
    const add=html=>{log.insertAdjacentHTML('beforeend',html);gbTick();log.lastElementChild.scrollIntoView({block:'end',behavior:'smooth'});return log.lastElementChild};
    const me=t=>add(`<div class="gb-me">${h(t)}</div>`);
    const bot=html=>add(`<div class="gb-bot">${gbChar('av')}<div class="gb-b">${html}</div></div>`);
    $$('[data-fq]',b).forEach(x=>x.onclick=()=>{const f=faqs[+x.dataset.fq];me(f.q);bot(nl(f.a))});
    const fb=$('#gbFb',b);if(fb)fb.onclick=()=>feedbackForm();
    const q=$('#gbQ',b);if(!q)return;
    const send=async()=>{const t=q.value.trim();if(!t)return;q.value='';me(t);
      const el=bot('<span class="muted">생각하는 중…</span>'),out=$('.gb-b',el);
      if(!navigator.onLine){out.innerHTML='인터넷에 연결되어 있어야 AI가 답할 수 있어요. 위의 버튼은 인터넷 없이도 볼 수 있어요.';return}
      $('#gbSend',b).disabled=true;
      try{const r=await api('guide/ask',{q:t,history:GB_HIST.slice(-3),guide:{aiText:G.aiText,faqs:G.faqs}});
        GB_HIST.push({q:t,a:r.answer});
        out.innerHTML=nl(r.answer)+(r.unknown?`<div class="gb-note">이 질문은 운영자에게도 전달했어요.</div>`:'')+`<div class="gb-note">🤖 AI 답변이라 틀릴 수 있어요${r.left<=5?` · 오늘 ${r.left}번 남음`:''}</div>`}
      catch(x){out.textContent=x.message}
      finally{$('#gbSend',b).disabled=false;log.lastElementChild.scrollIntoView({block:'end'})}};
    $('#gbSend',b).onclick=send;q.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();send()}};
  });
}

/* ---------- 운영자에게 의견 보내기 ---------- */
const FB_KINDS=['불편해요','오류 같아요','이런 기능 있으면','기타'];
function feedbackForm(){
  let kind=FB_KINDS[0],photos=()=>[];
  openModal('운영자에게 의견 보내기',`<div class="small muted" style="margin-bottom:6px">운영자만 볼 수 있어요. 어떤 화면에서 무엇이 불편했는지 적어 주세요.</div>
    <label class="f">종류</label><div class="chips" id="fbK">${FB_KINDS.map((k,i)=>`<button type="button" class="chip ${i?'':'on'}" data-k="${h(k)}">${h(k)}</button>`).join('')}</div>
    <label class="f">내용</label><textarea class="inp" id="fbT" maxlength="2000" style="min-height:140px" placeholder="예) 음주측정 화면에서 측정인 이름이 매번 지워져요"></textarea>
    <label class="f">사진 (선택 · 3장까지, 화면 캡처도 좋아요)</label><div id="fbPh"></div>
    <button class="btn" id="fbSend" style="width:100%;margin-top:12px">보내기</button>`,b=>{
    $$('#fbK .chip',b).forEach(c=>c.onclick=()=>{$$('#fbK .chip',b).forEach(x=>x.classList.remove('on'));c.classList.add('on');kind=c.dataset.k});
    photos=photoInputs($('#fbPh',b),[],3,{cap:'설명 (선택)'});
    $('#fbSend',b).onclick=async()=>{const text=$('#fbT',b).value.trim();if(!text)return toast('내용을 입력하세요');
      if(!navigator.onLine)return toast('의견 보내기는 인터넷 연결이 필요합니다');
      const btn=$('#fbSend',b);btn.disabled=true;btn.textContent='보내는 중…';
      try{await api('feedback',{kind,text,photos:photos().map(p=>p.src)});closeModal();toast('운영자에게 보냈습니다. 고맙습니다!')}
      catch(x){toast(x.message);btn.disabled=false;btn.textContent='보내기'}};
  });
}

/* ---------- 운영자: 홈의 새 의견 알림 ---------- */
async function fbBadge(){if(!SERVER||!can('feedback.view')||!navigator.onLine)return;
  try{const r=await api('feedback?count=1');if(cur!=='home'||!r.new)return;
    const v=V$();if($('#fbNew',v))return;
    v.insertAdjacentHTML('afterbegin',`<button type="button" class="gb-new" id="fbNew"><i class="i i-note"></i> 새 의견 <b>${r.new}</b><span class="muted small">— 눌러서 확인</span></button>`);
    $('#fbNew',v).onclick=()=>go('settings','guide')}catch(e){}}
{const f=R.home;R.home=(...a)=>{f(...a);fbBadge()}}

/* ---------- 운영자: 설정 → 안내·의견 (받은 의견 + 안내 봇 설정) ---------- */
{const f=R.settings;R.settings=(...a)=>{f(...a);if(!SERVER||!(can('feedback.view')||can('set.guide')))return;
  V$().insertAdjacentHTML('beforeend',`<section class="st" data-st="guide">
   ${can('feedback.view')?`<div class="card"><div class="row"><b class="grow">받은 의견</b><button class="btn sm line" id="fbAll">확인한 것도 보기</button></div><div class="list" id="fbBox" style="margin-top:6px"><div class="empty">불러오는 중…</div></div></div>`:''}
   ${can('set.guide')?`<div class="card"><b>안내 봇</b> <span class="small muted">— 오른쪽 아래 캐릭터를 누르면 나오는 안내. 바꾸면 모든 사용자에게 적용</span>
    <div class="grid g2"><div><label class="f">이름</label><input class="inp" id="gbN"></div><div><label class="f">AI 답변</label><label class="row" style="gap:8px;min-height:48px"><input type="checkbox" id="gbAi" style="width:22px;height:22px"> 버튼에 없는 질문은 AI가 답하기</label></div></div>
    <label class="f">현장 전체 하루 AI 질문 수 <span class="small muted">(0~500 · 무료 사용량 안에 머물도록 최대 500, 한국시간 오전 9시에 다시 채워짐)</span></label><input class="inp" id="gbD" type="number" inputmode="numeric" min="0" max="500" style="max-width:160px">
    <label class="f">인사말 <span class="small muted">({이름} = 로그인한 사람 이름)</span></label><textarea class="inp" id="gbG" rows="3"></textarea>
    <label class="f">자주 묻는 질문 <span class="small muted">— 버튼으로 보이고 AI도 참고합니다</span></label><div id="gbF"></div>
    <button class="btn sm line" id="gbAdd" style="margin-top:8px"><i class="i i-plus"></i> 질문 추가</button>
    <label class="f">AI 참고 안내문 <span class="small muted">— 현장 규칙·연락처 등 AI가 답할 때 참고할 내용 (근로자 개인정보는 넣지 마세요)</span></label><textarea class="inp" id="gbT" style="min-height:140px" placeholder="예) 현장 출입 시간은 06:30~18:00 입니다. 음주 재측정은 15분 뒤에 합니다."></textarea>
    <div class="row" style="margin-top:12px"><button class="btn" id="gbSave">안내 봇 저장</button><button class="btn line" id="gbTry">미리 보기</button><button class="btn sm ghost" id="gbReset">기본값으로</button></div></div>
  `:''}</section>`);
  if(can('set.guide'))bindGuideSettings();loadFeedback(false)}}

let FB_ALL=false;
async function loadFeedback(all){FB_ALL=all;const box=$('#fbBox');if(!box)return;
  try{const r=await api('feedback');const items=r.items.filter(x=>all||x.status!=='done');
    $('#fbAll').textContent=all?'새 의견만 보기':'확인한 것도 보기';$('#fbAll').onclick=()=>loadFeedback(!FB_ALL);
    box.innerHTML=items.map(x=>`<div class="it" data-fb="${h(x.id)}"><div class="m"><div>${x.status==='done'?'<span class="badge bgray">확인함</span>':'<span class="badge bbad">새 의견</span>'} <span class="badge bgray">${h(x.kind)}</span> ${x.photos&&x.photos.length?'📷':''}</div>
      <div class="ell" style="margin-top:4px">${h(x.text)}</div><div class="small muted">${h(x.by)} (${h(({admin:'운영자',manager:'관리자',user:'사용자',driver:'장비운전원'})[x.role]||'')}${x.org?' · '+h(x.org):''}) · ${fmtDT(nowLocalOf(x.at))}</div></div></div>`).join('')||`<div class="empty">${all?'받은 의견이 없습니다':'새 의견이 없습니다'}</div>`;
    $$('[data-fb]',box).forEach(el=>el.onclick=()=>showFeedback(r.items.find(x=>x.id===el.dataset.fb)))}
  catch(x){box.innerHTML=`<div class="empty">${h(navigator.onLine?x.message:'받은 의견은 인터넷 연결이 필요합니다')}</div>`}}
const nowLocalOf=t=>{const d=new Date(t);return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`};
function showFeedback(x){if(!x)return;
  openModal(x.kind,`<dl class="kv"><dt>보낸 사람</dt><dd>${h(x.by)}${x.org?' · '+h(x.org):''}</dd><dt>보낸 때</dt><dd>${fmtDT(nowLocalOf(x.at))}</dd></dl>
    <div class="card" style="white-space:pre-wrap;margin-top:10px">${h(x.text)}</div>
    ${x.photos&&x.photos.length?`<div class="photos" style="margin-bottom:12px">${x.photos.map(p=>`<div class="ph"><a href="${h(p.src||p)}" target="_blank" rel="noopener"><img src="${h(p.src||p)}"></a></div>`).join('')}</div>`:''}
    <label class="f">메모 (운영자만 봄)</label><textarea class="inp" id="fbM" rows="3">${h(x.memo||'')}</textarea>
    <div class="row" style="margin-top:12px"><button class="btn" id="fbDone">${x.status==='done'?'새 의견으로 되돌리기':'확인함'}</button><button class="btn line" id="fbMemo">메모 저장</button></div>`,b=>{
    const mark=async(o,msg)=>{try{await api('feedback/'+x.id,o);toast(msg);closeModal();loadFeedback(FB_ALL)}catch(e){toast(e.message)}};
    $('#fbDone',b).onclick=()=>mark({status:x.status==='done'?'new':'done',memo:$('#fbM',b).value},x.status==='done'?'새 의견으로 되돌렸습니다':'확인함으로 표시했습니다');
    $('#fbMemo',b).onclick=()=>mark({memo:$('#fbM',b).value},'메모를 저장했습니다')});
}
function bindGuideSettings(){
  let G=JSON.parse(JSON.stringify(gbSet()));
  const fill=()=>{$('#gbN').value=G.name;$('#gbAi').checked=G.aiOn!==false;$('#gbD').value=G.aiDay??300;$('#gbG').value=G.greet;$('#gbT').value=G.aiText||'';drawF()};
  const keep=()=>$$('[data-fi]').forEach(r=>{const i=+r.dataset.fi;G.faqs[i]={q:$('[data-q]',r).value.trim(),a:$('[data-a]',r).value.trim(),drv:$('[data-d]',r).checked}});
  const drawF=()=>{$('#gbF').innerHTML=G.faqs.map((f,i)=>`<div data-fi="${i}" style="border-top:1px solid var(--line);padding:8px 0">
      <div class="row" style="gap:6px;flex-wrap:nowrap"><input class="inp grow" data-q value="${h(f.q)}" placeholder="질문 (버튼 글자)" style="min-width:0"><button class="btn sm line" data-u ${i?'':'disabled'} aria-label="위로">▲</button><button class="btn sm line" data-dn ${i<G.faqs.length-1?'':'disabled'} aria-label="아래로">▼</button><button class="btn sm line" data-x aria-label="삭제"><i class="i i-x"></i></button></div>
      <textarea class="inp" data-a rows="3" placeholder="답" style="margin-top:6px">${h(f.a)}</textarea>
      <label class="row small" style="gap:6px;margin-top:4px"><input type="checkbox" data-d ${f.drv?'checked':''}> 장비운전원에게도 보이기</label></div>`).join('')||'<div class="empty small">질문이 없습니다</div>';
    $$('[data-fi]').forEach(r=>{const i=+r.dataset.fi;
      $('[data-u]',r).onclick=()=>{keep();[G.faqs[i-1],G.faqs[i]]=[G.faqs[i],G.faqs[i-1]];drawF()};
      $('[data-dn]',r).onclick=()=>{keep();[G.faqs[i+1],G.faqs[i]]=[G.faqs[i],G.faqs[i+1]];drawF()};
      $('[data-x]',r).onclick=()=>{keep();G.faqs.splice(i,1);drawF()}})};
  const collect=()=>{keep();return {name:$('#gbN').value.trim()||DEF.guide.name,greet:$('#gbG').value,aiOn:$('#gbAi').checked,aiDay:(v=>isNaN(v)?300:Math.max(0,Math.min(500,v)))(parseInt($('#gbD').value,10)),aiText:$('#gbT').value.trim(),faqs:G.faqs.filter(f=>f.q&&f.a)}};
  fill();
  $('#gbAdd').onclick=()=>{keep();G.faqs.push({q:'',a:'',drv:false});drawF();const qs=$$('#gbF [data-q]');qs[qs.length-1].focus()};
  $('#gbSave').onclick=async()=>{S.guide=collect();G=JSON.parse(JSON.stringify(S.guide));await saveSettings();await queueShared();fill();gbFab();toast('안내 봇 저장됨')};
  $('#gbTry').onclick=()=>{const keepS=S.guide;S.guide=collect();openGuide();S.guide=keepS};
  $('#gbReset').onclick=()=>{if(!confirm('안내 봇 설정을 기본값으로 되돌릴까요? (저장을 눌러야 적용)'))return;G=JSON.parse(JSON.stringify(DEF.guide));fill()};
}
