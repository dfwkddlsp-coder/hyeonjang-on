// 현장ON — server mode: roles, API, sync, login
'use strict';
/* 서버 모드 (Cloudflare Worker + D1): 로그인하면 SERVER=true, ME=로그인 사용자 */
let SERVER=false,ME=null;
const isAdmin=()=>!SERVER||(ME&&ME.role==='admin');
const isDriver=()=>SERVER&&!!ME&&ME.role==='driver';
const roleBadge=r=>r==='admin'?'<span class="badge">운영자</span>':r==='manager'?'<span class="badge">관리자</span>':r==='driver'?'<span class="badge bgray">장비운전원</span>':'<span class="badge bgray">사용자</span>';
const SHARED_KEYS=['site','periodMonths','vtypes','levels','alcMode','alc','alcMsg','vulnAge','bp','eqItems','eqCheckItems','vulnScope','homeLayout','docCats','forms','eqForms','eqExclude'];
async function api(path,body){
  const r=await fetch('/api/'+path,{method:body!==undefined?'POST':'GET',credentials:'same-origin',headers:body!==undefined?{'content-type':'application/json'}:{},body:body!==undefined?JSON.stringify(body):undefined});
  let j=null;try{j=await r.json()}catch(e){}
  if(!r.ok||!j){const e=new Error((j&&j.error)||('HTTP '+r.status));e.status=r.status;throw e}
  return j;
}
const kvGet=async k=>{const r=await DB.req(DB.st('kv','readonly').get(k));return r?r.v:undefined};
const kvSet=(k,v)=>DB.put('kv',{k,v});
function applyMe(u){ME=u;Object.assign(S,{inspector:u.name,inspectorOrg:u.org||'',myRole:u.title||'',mySig:u.sig||''})}
function applyShared(d){for(const k of SHARED_KEYS)if(d[k]!==undefined)S[k]=k==='alc'?Object.assign({},DEF.alc,d[k]):d[k];$('#siteName').textContent=S.site||'';purgeVulnIfHidden()}
/* 열람 권한이 없으면 이 기기에 받아둔 취약근로자 정보도 지움 */
const vulnVisible=()=>!SERVER||isAdmin()||(ME&&ME.role==='manager')||S.vulnScope==='all';
function purgeVulnIfHidden(){if(vulnVisible()||!VU.length)return;VU=[];DB.putMany('vuln',[],true).catch(()=>{})}
function sharedDoc(){const o={id:'shared'};for(const k of SHARED_KEYS)o[k]=S[k];return o}
async function queueShared(){await DB.put('outbox',{k:'settings|shared',store:'settings',id:'shared',data:sharedDoc(),ts:Date.now()});Sync.soon()}
async function applyDoc(d){
  if(d.store==='settings'){if(!d.deleted&&d.data){applyShared(d.data);await saveSettings()}return true}
  if(!STORE[d.store])return false;
  const pend=await DB.req(DB.st('outbox','readonly').get(d.store+'|'+d.id));if(pend)return false; // 내 기기에 더 새 수정이 있음
  if(d.deleted){await DB.del(d.store,d.id);memDel(d.store,d.id)}else{const o={...d.data,id:d.id};await DB.put(d.store,o);memPut(d.store,o)}
  return true}
function softRerender(){const ae=document.activeElement;if(!$('#modal').classList.contains('hidden')||(ae&&/INPUT|TEXTAREA|SELECT/.test(ae.tagName))||$('canvas',V$()))return;R[cur]()}
const Sync={busy:false,again:false,t:null,state:'',
  soon(){clearTimeout(this.t);this.t=setTimeout(()=>this.run(),400)},
  async run(){if(!SERVER)return;if(this.busy){this.again=true;return}this.busy=true;let changed=false;
    try{const a=await this.push(),b=await this.pull();changed=a||b;this.state='ok'}
    catch(e){if(e.status===401){await kvSet('me',null);location.reload();return}this.state='off'}
    finally{this.busy=false;if(this.again){this.again=false;this.soon()}}
    if(changed)softRerender();badge()},
  async push(){const all=await DB.all('outbox');if(!all.length)return false;let i=0;
    while(i<all.length){const chunk=[];let size=0;while(i<all.length&&chunk.length<20){const n=JSON.stringify(all[i].data).length;if(chunk.length&&size+n>3e6)break;chunk.push(all[i]);size+=n;i++}
      const r=await api('docs',{docs:chunk.map(o=>({store:o.store,id:o.id,data:o.data}))});
      for(const o of chunk){const now=await DB.req(DB.st('outbox','readonly').get(o.k));if(now&&now.ts===o.ts)await DB.del('outbox',o.k)}
      for(const d of r.saved)await applyDoc(d)}
    return true},
  async pull(){let since=(await kvGet('lastSync'))||0,changed=false,more=true;
    while(more){const r=await api('sync?since='+since);for(const d of r.docs)if(await applyDoc(d))changed=true;since=r.cursor;more=r.more}
    await kvSet('lastSync',since);return changed}
};
async function badge(){const el=$('#netBadge');if(!SERVER){el.textContent=navigator.onLine?'온라인':'오프라인 · 기기 저장';return}
  const n=(await DB.all('outbox')).length;el.textContent=!navigator.onLine||Sync.state==='off'?(n?`오프라인 · 전송 대기 ${n}`:'오프라인'):(n?`전송 대기 ${n}`:'동기화됨')}
/* 운영자 대장 업로드: 200건씩 서버로 */
async function pushImport(store,docs,replace){
  if(!navigator.onLine)throw new Error('대장 업로드는 인터넷 연결이 필요합니다');
  for(let i=0;i===0||i<docs.length;i+=200){
    const r=await api('docs',{import:true,replaceStores:replace&&i===0?[store]:[],docs:docs.slice(i,i+200).map(o=>({store,id:o.id,data:o}))});
    for(const d of r.saved)await applyDoc(d)}
  await Sync.run()}

/* 로그인·최초 운영자 등록·비밀번호 변경 화면 */
function authScreen(kind){return new Promise(res=>{
  const K={setup:{t:'운영자 계정 만들기',sub:'처음 한 번만 합니다. 이 계정으로 현장 사용자를 등록하고 관리합니다.',f:[['loginId','아이디 (영문·숫자, 휴대폰번호 가능)','text','username'],['name','이름','text','name'],['org','소속','text','organization'],['title','직책','text','organization-title'],['password','비밀번호 (6자 이상)','password','new-password'],['password2','비밀번호 확인','password','new-password']],b:'운영자 계정 만들기'},
    login:{t:'로그인',sub:'운영자에게 받은 아이디와 비밀번호를 입력하세요.',f:[['loginId','아이디','text','username'],['password','비밀번호','password','current-password']],b:'로그인'},
    pw:{t:'비밀번호 변경',sub:'처음 로그인했습니다. 본인만 아는 비밀번호로 바꿔주세요.',f:[['current','받은 비밀번호','password','current-password'],['next','새 비밀번호 (6자 이상)','password','new-password'],['next2','새 비밀번호 확인','password','new-password']],b:'변경하고 시작'}}[kind];
  const d=document.createElement('div');d.className='lock';
  d.innerHTML=`<form class="auth-box" autocomplete="on"><div class="row" style="gap:10px;margin-bottom:6px"><img src="icon.svg" alt="" style="width:40px;height:40px;border-radius:10px"><b style="font-size:22px">현장ON</b></div>
    <h2 style="margin:10px 0 2px">${K.t}</h2><p class="small muted" style="margin:0 0 6px">${K.sub}</p>
    ${K.f.map(([n,l,t,ac])=>`<label class="f">${l}</label><input class="inp" name="${n}" type="${t}" autocomplete="${ac}" ${t==='text'?'autocapitalize="off" autocorrect="off" spellcheck="false"':''}>`).join('')}
    <div class="auth-err"></div><button class="btn xl" type="submit" style="margin-top:12px">${K.b}</button>
    <p class="small muted" style="text-align:center;margin:10px 0 0">습관이 된 노력을 실력이라 한다.</p></form>`;
  document.body.appendChild(d);const fm=$('form',d);
  let savedId='';try{savedId=localStorage.getItem('hjLoginId')||''}catch(e){}
  if(kind==='login'&&savedId){fm.elements.loginId.value=savedId;setTimeout(()=>fm.elements.password.focus(),50)}else setTimeout(()=>fm.elements[0].focus(),50);
  fm.onsubmit=async e=>{e.preventDefault();const v=Object.fromEntries(new FormData(fm));const err=$('.auth-err',d);err.textContent='';
    if(kind==='setup'&&v.password!==v.password2)return err.textContent='비밀번호 확인이 다릅니다';
    if(kind==='pw'&&v.next!==v.next2)return err.textContent='새 비밀번호 확인이 다릅니다';
    const btn=$('button',fm);btn.disabled=true;
    try{const r=kind==='setup'?await api('setup',v):kind==='login'?await api('login',v):await api('me/password',{current:v.current,next:v.next});
      if(r.user){try{localStorage.setItem('hjLoginId',r.user.loginId)}catch(e){}
        const pw=kind==='pw'?v.next:v.password; // 휴대폰·브라우저 비밀번호 저장 (지원하는 기기만)
        if(pw&&window.PasswordCredential)try{await navigator.credentials.store(new PasswordCredential({id:r.user.loginId,password:pw,name:r.user.name}))}catch(e){}}
      d.remove();res(r.user)}
    catch(x){err.textContent=x.status?x.message:'인터넷 연결을 확인하세요'}finally{btn.disabled=false}};
})}
async function authGate(){
  let st;
  try{st=await api('status')}
  catch(e){
    if(e.status&&e.status!==503)return false; // 서버 없음 (파일로 열거나 예전 주소) → 기기 저장 모드
    const cached=await kvGet('me');if(cached&&cached.id){SERVER=true;applyMe(cached);return false} // 오프라인: 마지막 로그인으로 계속
    await new Promise(()=>{V$().innerHTML='<div class="card">처음 로그인은 인터넷 연결이 필요합니다. 연결 후 다시 열어주세요.</div>'});
  }
  SERVER=true;
  let u=st.user;
  if(st.setupNeeded)u=await authScreen('setup');
  else if(!u)u=await authScreen('login');
  if(u.mustChange)u=await authScreen('pw');
  const prev=await kvGet('me');let reset=false;
  if(!prev||prev.id!==u.id||prev.role!==u.role){for(const s of [...STORE_NAMES,'outbox'])await DB.putMany(s,[],true);await kvSet('lastSync',0);reset=true}
  await kvSet('me',u);applyMe(u);return reset;
}
async function logout(){try{await api('logout',{})}catch(e){}await kvSet('me',null);location.reload()}
