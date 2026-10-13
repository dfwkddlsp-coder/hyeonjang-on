// 현장ON — 임시 출입 QR: 관리자·운영자가 QR을 띄우면 정해진 시간 동안 여러 명이 찍고 들어옴 (교육장 등).
// 들어온 사람 = 임시 운전원(guest): 그날 자정까지 본인 장비 추가·점검·사진만. 권한은 서버(worker/lib/policy.js)가 막음
'use strict';
const gqUrl=t=>location.origin+'/#g='+t;
const gqSvg=text=>{const q=qrcode(0,'M');q.addData(text);q.make();return q.createSvgTag({cellSize:8,margin:2,scalable:true})};
const hmOf=t=>{const d=new Date(t);return pad(d.getHours())+':'+pad(d.getMinutes())};

/* ---------- 관리자·운영자: QR 띄우기 ---------- */
function guestQr(){
  let mins=30;
  openModal('임시 출입 QR',`<div class="small muted">교육장 등에서 이 QR을 띄우면 정해진 시간 동안 여러 명이 각자 폰으로 찍고 들어옵니다. 들어온 사람은 <b>오늘 자정까지 본인 장비 추가·점검·사진</b>만 할 수 있습니다.</div>
    <label class="f">QR을 찍을 수 있는 시간</label><div class="chips" id="gqM">${[10,30,60,120].map(m=>`<button type="button" class="chip ${m===30?'on':''}" data-m="${m}">${m<60?m+'분':m/60+'시간'}</button>`).join('')}</div>
    <button class="btn xl" id="gqGo" style="width:100%;margin-top:14px">QR 띄우기</button>`,b=>{
    $$('#gqM .chip',b).forEach(c=>c.onclick=()=>{$$('#gqM .chip',b).forEach(x=>x.classList.remove('on'));c.classList.add('on');mins=+c.dataset.m});
    $('#gqGo',b).onclick=async()=>{if(!navigator.onLine)return toast('QR은 인터넷 연결이 필요합니다');
      try{const r=await api('guest/invite',{minutes:mins});guestQrShow(r)}catch(x){toast(x.message)}}});
}
function guestQrShow(inv){
  const url=gqUrl(inv.token);let t=null;
  openModal('임시 출입 QR',`<div class="gq-box">${gqSvg(url)}</div>
    <div class="gq-exp" id="gqExp"></div>
    <div class="row" style="margin-top:10px"><button class="btn line" id="gqShare"><i class="i i-share"></i> 링크 보내기</button><button class="btn bad" id="gqClose">QR 닫기</button></div>
    <div class="card" style="margin-top:12px"><b>들어온 사람</b> <span class="muted small" id="gqN"></span><div class="list" id="gqList" style="margin-top:6px"><div class="empty small">아직 없습니다</div></div></div>`,b=>{
    const tick=async()=>{const box=$('#gqList');if(!box){clearInterval(t);return} // 창을 닫으면 멈춤
      const left=inv.exp-Date.now();
      try{const s=await api('guest/invite/'+inv.id);
        const done=s.closed||left<=0;
        $('#gqExp').innerHTML=done?'<b style="color:var(--bad)">닫힌 QR입니다 — 더는 들어올 수 없습니다</b>':`<b>${hmOf(inv.exp)}</b>까지 찍을 수 있음 · ${Math.ceil(left/60000)}분 남음`;
        $('.gq-box').classList.toggle('off',done);if(done)$('#gqClose').disabled=true;
        $('#gqN').textContent=s.joined.length+'명';
        box.innerHTML=s.joined.map(j=>`<div class="it"><span class="dot d0">${h(j.name.slice(0,1))}</span><div class="m"><b>${h(j.name)}</b> <span class="muted small">${h(j.org||'')}</span></div><span class="small muted">${hmOf(j.at)}</span></div>`).join('')||'<div class="empty small">아직 없습니다</div>';
        if(done)clearInterval(t)}catch(e){}};
    tick();t=setInterval(tick,4000);
    $('#gqShare',b).onclick=async()=>{const text=`현장ON 임시 출입 (${hmOf(inv.exp)}까지)\n${url}`;
      try{if(navigator.share)await navigator.share({title:'현장ON 임시 출입',text,url});else{await navigator.clipboard.writeText(url);toast('링크를 복사했습니다')}}catch(e){}};
    $('#gqClose',b).onclick=async()=>{if(!confirm('QR을 닫을까요? 이미 들어온 사람은 오늘 자정까지 그대로 쓸 수 있습니다.'))return;
      try{await api('guest/invite/'+inv.id+'/close',{});toast('QR을 닫았습니다');tick()}catch(x){toast(x.message)}};
  });
}

/* ---------- QR을 찍은 사람: 이름·연락처만 넣고 들어감 ---------- */
function guestJoin(token,current){
  if(current&&!confirm(`이 기기는 ${current.name}님으로 로그인되어 있습니다.\n임시 출입으로 바꿀까요? (기존 로그인은 끝납니다)`))return Promise.resolve(null);
  return new Promise(res=>{
    V$().innerHTML=`<div class="card" style="max-width:440px;margin:24px auto">
      <div class="row" style="gap:10px;align-items:center"><canvas class="gbc" width="16" height="21"></canvas><div><b style="font-size:18px">현장ON 임시 출입</b><div class="small muted">오늘 자정까지 본인 장비 점검·사진 등록만 할 수 있습니다</div></div></div>
      <label class="f">이름 *</label><input class="inp" id="gjN" autocomplete="name" maxlength="30">
      <label class="f">연락처 (휴대폰) *</label><input class="inp" id="gjP" inputmode="tel" autocomplete="tel" placeholder="010-0000-0000">
      <label class="f">소속 업체</label><input class="inp" id="gjC" autocomplete="organization" placeholder="예) OO중기">
      <button class="btn xl" id="gjGo" style="width:100%;margin-top:14px">들어가기</button>
      <div class="small muted" style="margin-top:8px">입력한 이름·연락처는 점검 기록에 남고 현장 관리자만 봅니다.</div></div>`;
    if(typeof gbTick==='function')gbTick();setTimeout(()=>$('#gjN').focus(),50);
    $('#gjGo').onclick=async()=>{const btn=$('#gjGo');btn.disabled=true;
      try{const r=await api('guest/join',{token,name:$('#gjN').value.trim(),phone:$('#gjP').value.trim(),company:$('#gjC').value.trim()});res(r.user)}
      catch(x){toast(x.message);btn.disabled=false;if(x.status===403)$('#gjGo').textContent='새 QR을 받아 주세요'}};
  });
}
/* 자정이 지나 임시 출입이 끝났을 때 */
function guestEnded(){return new Promise(res=>{
  V$().innerHTML=`<div class="card" style="max-width:440px;margin:24px auto;text-align:center"><b style="font-size:18px">임시 출입이 끝났습니다</b>
    <div class="muted" style="margin:8px 0 14px">임시 출입은 받은 날 자정까지입니다. 다시 점검하려면 관리자에게 새 QR을 받아 주세요.<br>남긴 점검 기록은 그대로 저장되어 있습니다.</div>
    <button class="btn line" id="geLogin">계정으로 로그인</button></div>`;
  $('#geLogin').onclick=async()=>{await kvSet('me',null);res()}})}

/* ---------- 장비점검 화면: 관리자·운영자에게 'QR' 버튼 ---------- */
{const f=R.eqcheck;R.eqcheck=(...a)=>{f(...a);if(!SERVER||!can('qr.guest'))return;const add=$('#eqAdd');if(!add||$('#gqBtn'))return;
  add.insertAdjacentHTML('beforebegin','<button class="btn sm line" id="gqBtn" style="margin-left:auto;margin-right:6px">임시 출입 QR</button>');$('#gqBtn').onclick=guestQr}}
