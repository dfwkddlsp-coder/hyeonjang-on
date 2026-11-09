// 현장ON — 일정표 휴대폰 달력 연결(구독): 한 번 연결하면 추가·변경·삭제가 기본 달력에 저절로 반영 (서버 worker/routes/calfeed.js)
'use strict';
const SC_SUB={seen:undefined,dev:/Android/i.test(navigator.userAgent)?'ga':'ip'};
const SC_SUB_GUIDE={
  ip:{steps:['아래 버튼을 누릅니다','"구독"을 누릅니다','"추가"를 누르면 끝'],go:'아이폰 달력에 연결',note:'달력 앱의 달력 목록을 아래로 당기면 바로 새로고침됩니다.'},
  ga:{steps:['아래 버튼을 눌러 구글 캘린더를 엽니다','"추가"를 누릅니다','삼성 캘린더에 구글 계정이 켜져 있으면 끝'],go:'구글 캘린더로 연결',note:'구글을 거치므로 변경 반영까지 길게는 하루 가까이 걸릴 수 있습니다. 당일 변경은 현장ON 공지 띠를 확인하세요.'},
};
const scSubLink=(dev,url)=>{const w=url.replace(/^https?:/,'webcal:');return dev==='ip'?w:'https://calendar.google.com/calendar/r?cid='+encodeURIComponent(w)};
const scSubBtn=()=>can('sched.subscribe')?`<button type="button" class="btn sm" id="schSub" style="width:100%;margin-bottom:8px"><i class="i i-records"></i> ${SC_SUB.seen?'휴대폰 달력 연결됨 · 설정':'내 휴대폰 달력에 연결'}</button>`:'';
function scSubBind(box,redraw){
  const b=$('#schSub',box);if(!b)return;
  b.onclick=()=>schedSub(redraw);
  if(SC_SUB.seen===undefined){SC_SUB.seen=false;api('cal/status').then(r=>{if(r.seen){SC_SUB.seen=true;if(box.isConnected)redraw()}}).catch(()=>{})}
}
async function schedSub(redraw){
  let cur;try{cur=await api('cal/link',{})}catch(e){return toast(e.status?e.message:'인터넷 연결이 필요합니다')}
  SC_SUB.seen=!!cur.seen;
  openModal('내 휴대폰 달력에 연결',`<div class="small muted">한 번만 연결하면 일정 추가·변경·삭제가 저절로 반영됩니다.</div><div id="subBody"></div>`,b=>{
    const draw=(msg)=>{const g=SC_SUB_GUIDE[SC_SUB.dev];
      $('#subBody',b).innerHTML=`<div class="sch-seg"><button type="button" class="chip${SC_SUB.dev==='ip'?' on':''}" data-dev="ip">아이폰</button><button type="button" class="chip${SC_SUB.dev==='ga'?' on':''}" data-dev="ga">갤럭시</button></div>
      <label class="sch-ck" style="border:0;padding:0 0 10px"><input type="checkbox" id="subD"${cur.duty?' checked':''}> <span>당직자 포함</span></label>
      ${g.steps.map((x,i)=>`<div class="sch-st"><b>${i+1}</b><span>${x}</span></div>`).join('')}
      <a class="btn" id="subGo" style="width:100%;text-decoration:none;text-align:center" href="${h(scSubLink(SC_SUB.dev,cur.url))}"${SC_SUB.dev==='ga'?' target="_blank" rel="noopener"':''}>${g.go}</a>
      <div class="small muted" style="margin-top:8px">${g.note}</div>
      ${SC_SUB.dev==='ga'?'<button type="button" class="btn sm ghost" id="subCopy" style="width:100%;margin-top:8px">버튼이 안 되면: 주소 복사 (PC 구글 캘린더 → 다른 캘린더 → URL로 추가)</button>':''}
      ${msg?`<div class="hint" style="margin-top:10px">${h(msg)}</div>`:''}
      <div class="sch-subre"><span class="small muted">주소가 새었거나 휴대폰을 바꿨다면</span><button type="button" class="btn sm line" id="subRe">주소 새로 만들기</button></div>`;
      $$('[data-dev]',b).forEach(x=>x.onclick=()=>{SC_SUB.dev=x.dataset.dev;draw()});
      $('#subD',b).onchange=async e=>{try{cur=await api('cal/link',{duty:e.target.checked});toast('저장했습니다 · 다음 새로고침 때 반영됩니다')}catch(x){e.target.checked=!e.target.checked;toast(x.status?x.message:'인터넷 연결이 필요합니다')}};
      const cp=$('#subCopy',b);if(cp)cp.onclick=async()=>{try{await navigator.clipboard.writeText(cur.url);toast('주소를 복사했습니다')}catch(e){prompt('이 주소를 복사하세요',cur.url)}};
      $('#subRe',b).onclick=async()=>{if(!confirm('새 주소를 만들면 옛 주소는 바로 멈춥니다. 연결했던 휴대폰은 다시 연결해야 합니다. 만들까요?'))return;
        try{cur=await api('cal/renew',{});SC_SUB.seen=false;draw('옛 주소는 멈췄습니다. 휴대폰에서 다시 연결해 주세요.');redraw()}catch(x){toast(x.status?x.message:'인터넷 연결이 필요합니다')}};
    };
    draw();
  });
}
