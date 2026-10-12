// 현장ON — 초대 QR과 가입 신청: QR(앱 주소 #join)을 찍은 사람이 가입 신청 → 운영자가 설정 → 사용자 관리에서 승인
'use strict';
const joinUrl=()=>location.origin+'/#join';

/* 로그인 전 화면: 가입 신청 (끝나면 로그인 화면으로) */
function joinScreen(){return new Promise(async res=>{
  const d=document.createElement('div');d.className='lock';document.body.appendChild(d);
  const back=()=>{d.remove();res()};
  let open=true;try{open=(await api('join/open')).open}catch(e){}
  if(!open){d.innerHTML=`<div class="auth-box"><b style="font-size:20px">가입 신청</b><p class="muted">지금은 가입 신청을 받지 않습니다. 현장 운영자에게 계정을 요청해 주세요.</p><button class="btn xl" id="jBack" style="width:100%">로그인 화면으로</button></div>`;$('#jBack',d).onclick=back;return}
  d.innerHTML=`<form class="auth-box" autocomplete="on"><div class="row" style="gap:10px;margin-bottom:6px"><img src="icon.svg" alt="" style="width:40px;height:40px;border-radius:10px"><b style="font-size:22px">현장ON</b></div>
    <h2 style="margin:10px 0 2px">가입 신청</h2><p class="small muted" style="margin:0 0 6px">운영자가 승인하면 아래 휴대폰 번호와 비밀번호로 로그인합니다.</p>
    <label class="f">이름 *</label><input class="inp" name="name" autocomplete="name" maxlength="30">
    <label class="f">휴대폰 번호 * <span class="small muted">(아이디가 됩니다)</span></label><input class="inp" name="phone" inputmode="tel" autocomplete="tel" placeholder="010-0000-0000">
    <label class="f">소속 업체 *</label><input class="inp" name="company" autocomplete="organization" maxlength="40">
    <label class="f">직종</label><input class="inp" name="job" maxlength="30" placeholder="예) 형틀, 안전관리">
    <label class="f">어떤 일로 쓰나요?</label>
    <label class="row" style="gap:8px;margin:4px 0"><input type="radio" name="want" value="user" checked style="width:20px;height:20px"> 현장 기록 (삼진아웃·음주측정·점검 등)</label>
    <label class="row" style="gap:8px;margin:4px 0"><input type="radio" name="want" value="driver" style="width:20px;height:20px"> 장비운전원 (내 장비 점검만)</label>
    <label class="f">비밀번호 * (6자 이상)</label><input class="inp" name="password" type="password" autocomplete="new-password">
    <label class="f">비밀번호 확인 *</label><input class="inp" name="password2" type="password" autocomplete="new-password">
    <div class="auth-err"></div><button class="btn xl" type="submit" style="margin-top:12px">가입 신청</button>
    <button class="btn line" type="button" id="jLogin" style="width:100%;margin-top:8px">이미 계정이 있어요 · 로그인</button></form>`;
  const fm=$('form',d);$('#jLogin',d).onclick=back;setTimeout(()=>fm.elements.name.focus(),50);
  fm.onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(fm)),err=$('.auth-err',d);err.textContent='';
    if(v.password!==v.password2)return err.textContent='비밀번호 확인이 다릅니다';
    const btn=$('button[type=submit]',fm);btn.disabled=true;
    try{await api('join/request',{name:v.name,phone:v.phone,company:v.company,job:v.job,want:v.want,password:v.password});
      try{localStorage.setItem('hjLoginId',String(v.phone).replace(/\D/g,''))}catch(x){}
      d.innerHTML=`<div class="auth-box"><b style="font-size:20px">신청했습니다 🫡</b><p class="muted">운영자가 승인하면 <b>${h(v.phone)}</b> 번호와 방금 정한 비밀번호로 로그인할 수 있습니다. 승인되면 운영자에게 연락이 갈 수 있으니 잠시 기다려 주세요.</p><button class="btn xl" id="jBack" style="width:100%">로그인 화면으로</button></div>`;$('#jBack',d).onclick=back}
    catch(x){err.textContent=x.message;btn.disabled=false}};
})}

/* 초대 QR 카드: 운영자(사용자 관리 탭, 가입 신청 받기 켜기/끄기 + 신청 목록)와 관리자(내 정보 탭) */
const inviteCard=adm=>`<div class="card"><b>현장ON 초대 QR</b> <span class="small muted">— 찍으면 현장ON이 열리고, 계정이 없으면 가입 신청 화면이 나옵니다</span>
  <div class="gq-box" style="max-width:220px;margin-top:10px">${gqSvg(joinUrl())}</div>
  <div class="row" style="margin-top:10px;gap:8px"><button class="btn line grow" id="ivShare"><i class="i i-share"></i> 링크 보내기</button><button class="btn line grow" id="ivPrint"><i class="i i-print"></i> QR 인쇄</button></div>
  ${adm?`<label class="row n-main" style="margin-top:10px"><span class="grow"><b>가입 신청 받기</b><div class="small muted">끄면 QR로 들어와도 신청할 수 없습니다 (로그인은 됨)</div></span>${swHtml('id="ivOpen"',S.joinOpen!==false)}</label>`:''}</div>
  ${adm?'<div class="card"><b>가입 신청</b> <span class="small muted" id="jrN"></span><div class="list" id="jrBox" style="margin-top:6px"><div class="empty small">불러오는 중…</div></div></div>':''}`;
function bindInvite(adm){
  const sh=$('#ivShare');if(!sh)return;
  sh.onclick=async()=>{const url=joinUrl(),text=`현장ON (${S.site||'현장'}) — 아래 주소를 열어 가입 신청하세요\n${url}`;
    try{if(navigator.share)await navigator.share({title:'현장ON 초대',text,url});else{await navigator.clipboard.writeText(url);toast('링크를 복사했습니다')}}catch(e){}};
  $('#ivPrint').onclick=()=>printPages([`<div class="doc" style="text-align:center"><h1 style="font-size:28pt;margin-top:20mm">현장ON 시작하기</h1><div class="site" style="font-size:14pt">[ ${h(S.site||'현장명')} ]</div>
    <div style="width:120mm;margin:12mm auto">${gqSvg(joinUrl())}</div><div style="font-size:15pt;line-height:1.8">휴대폰 카메라로 QR을 찍으세요<br>계정이 없으면 <b>가입 신청</b> → 운영자 승인 후 로그인<br><span style="font-size:11pt">${h(joinUrl())}</span></div></div>`]);
  const op=$('#ivOpen');if(op)op.onchange=async()=>{S.joinOpen=op.checked;await saveSettings();await queueShared();toast(op.checked?'가입 신청을 받습니다':'가입 신청을 막았습니다')};
  if(adm)loadJoinReqs();
}
async function loadJoinReqs(){const box=$('#jrBox');if(!box)return;
  let r;try{r=await api('join/requests')}catch(x){box.innerHTML=`<div class="empty small">${h(navigator.onLine?x.message:'인터넷 연결이 필요합니다')}</div>`;return}
  $('#jrN').textContent=r.items.length?`${r.items.length}건 대기`:'';
  box.innerHTML=r.items.map(x=>`<div class="it" style="cursor:default;flex-wrap:wrap"><div class="m"><b>${h(x.name)}</b> <span class="muted small">${h(x.phone)}</span><div class="small muted">${h(x.company)}${x.job?' · '+h(x.job):''} · ${x.want==='driver'?'장비운전원':'사용자'}로 신청 · ${fmtDT(nowLocalOf(x.at))}</div></div>
    <div class="row" style="gap:6px;width:100%;margin-top:6px"><select class="inp" data-jr-role="${h(x.phone)}" style="min-height:40px;padding:4px 8px;flex:1"><option value="user" ${x.want==='user'?'selected':''}>사용자</option><option value="driver" ${x.want==='driver'?'selected':''}>장비운전원</option><option value="manager">관리자</option></select>
    <button class="btn sm" data-jr-ok="${h(x.phone)}">승인</button><button class="btn sm line" data-jr-no="${h(x.phone)}">거절</button></div></div>`).join('')||'<div class="empty small">대기 중인 신청이 없습니다</div>';
  const act=async(id,action)=>{const role=($(`[data-jr-role="${id}"]`)||{}).value;
    if(action==='reject'&&!confirm('이 가입 신청을 거절할까요?'))return;
    try{await api('join/requests/'+id,{action,role});toast(action==='approve'?'승인했습니다 — 신청한 비밀번호로 로그인할 수 있습니다':'거절했습니다');loadJoinReqs();if(typeof loadUsers==='function')loadUsers()}catch(x){toast(x.message)}};
  $$('[data-jr-ok]',box).forEach(b=>b.onclick=()=>act(b.dataset.jrOk,'approve'));
  $$('[data-jr-no]',box).forEach(b=>b.onclick=()=>act(b.dataset.jrNo,'reject'));
}
{const f=R.settings;R.settings=(...a)=>{f(...a);if(!SERVER||!isStaff())return;const adm=isAdmin();
  const at=adm?$('section.st[data-st="users"]',V$()):null;
  if(adm&&at)at.insertAdjacentHTML('beforebegin',`<section class="st" data-st="users">${inviteCard(true)}</section>`);
  else if(!adm)V$().insertAdjacentHTML('beforeend',`<section class="st" data-st="me">${inviteCard(false)}</section>`);
  bindInvite(adm)}}
