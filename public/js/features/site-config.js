// 현장ON — 현장 기준 panels: home layout, categories, form wording
'use strict';
/* 홈 화면 배치: 운영자가 설정 → 현장 기준에서 순서·넓게·숨기기 (모든 사용자에게 같게 적용) */
const HL_BASE={eqcheck:'장비점검',strike:'삼진아웃',alcohol:'음주측정',workers:'근로자',equip:'장비',vuln:'취약근로자'};
function hlNames(){const o={...HL_BASE};for(const c of docCats())o['d_'+c.k]=c.name;return o}
function homeLayout(){const N=hlNames();
  const cur=(Array.isArray(S.homeLayout)?S.homeLayout:[]).map(it=>it&&it.k==='plans'?{...it,k:'d_plans'}:it).filter(it=>it&&N[it.k]);
  const seen=new Set(cur.map(it=>it.k));
  const rest=[...DEF.homeLayout.map(it=>it.k),...Object.keys(N)].filter((k,i,a)=>N[k]&&!seen.has(k)&&a.indexOf(k)===i);
  return [...cur.map(it=>({k:it.k,wide:!!it.wide,hide:!!it.hide,name:it.name||''})),...rest.map(k=>({k,wide:k==='eqcheck',hide:false,name:''}))]}
function applyHomeLayout(){const g=$('.hm-grid',V$());if(!g)return;
  for(const it of homeLayout()){const b=g.querySelector(`[data-hl="${it.k}"]`)||g.querySelector(`[data-go="${it.k}"]:not([data-hl])`);if(!b)continue;
    b.classList.toggle('wide',it.wide);b.hidden=it.hide;if(it.name)$('.nm',b).textContent=it.name;g.appendChild(b)}}
function bindDocCats(){const box=$('#dcBox');if(!box)return;let L=docCats().map(c=>({...c}));
  const render=()=>{box.innerHTML=L.map((c,i)=>{const n=PL.filter(p=>(p.cat||'plans')===c.k).length+RC.filter(r=>r.cat===c.k).length;const ty=catType(c);
      return `<div class="row" style="padding:7px 0;border-top:1px solid var(--line);gap:8px;flex-wrap:wrap"><input class="inp grow" data-dn="${i}" value="${h(c.name)}" style="min-width:140px;padding:6px 8px;font-size:14px">
      <select class="inp" data-dt="${i}" style="width:auto;padding:6px;font-size:13px" ${n?'disabled title="기록이 있으면 유형을 바꿀 수 없습니다"':''}>${Object.entries(CAT_TYPES).map(([k,l])=>`<option value="${k}" ${ty===k?'selected':''}>${l}</option>`).join('')}</select>
      ${ty!=='pdf'?`<button class="btn sm" data-dc="${i}">${ty==='check'?`점검 항목 ${catItems(c).length}개`:ty==='form'?`양식 칸 ${(c.fields||[]).length}개`:`사진 ${photoLayout(c)}장/칸`} · 구성</button>`:''}
      <select class="inp" data-ds="${i}" style="width:auto;padding:6px;font-size:13px"><option value="all" ${c.scope!=='staff'?'selected':''}>모두 열람</option><option value="staff" ${c.scope==='staff'?'selected':''}>운영자·관리자만</option></select>
      <span class="small muted" style="white-space:nowrap">${n}건</span><button class="btn sm line" data-dd="${i}" ${n||L.length<2?'disabled':''} title="${n?'문서가 있으면 지울 수 없습니다':''}">삭제</button></div>`}).join('')+
    '<div class="row" style="margin-top:8px"><button class="btn sm line" id="dcAdd"><i class="i i-plus"></i> 카테고리 추가</button><span class="sp" style="flex:1"></span><button class="btn sm" id="dcSave">저장</button></div>';
    $$('[data-dn]',box).forEach(x=>x.oninput=()=>{L[+x.dataset.dn].name=x.value});
    $$('[data-ds]',box).forEach(x=>x.onchange=()=>{L[+x.dataset.ds].scope=x.value});
    $$('[data-dt]',box).forEach(x=>x.onchange=()=>{const c=L[+x.dataset.dt];c.type=x.value;render();if(x.value!=='pdf')catConfig(c,saveCats)});
    $$('[data-dc]',box).forEach(x=>x.onclick=()=>catConfig(L[+x.dataset.dc],saveCats));
    $$('[data-dd]',box).forEach(x=>x.onclick=()=>{L.splice(+x.dataset.dd,1);render()});
    $('#dcAdd').onclick=()=>{L.push({k:uid(),name:'새 문서함',scope:'all'});render();const ins=$$('[data-dn]',box);ins[ins.length-1].select()};
    $('#dcSave').onclick=saveCats};
  const saveCats=async()=>{if(L.some(c=>!c.name.trim()))return toast('카테고리 이름을 입력하세요');
      L=L.map(c=>({k:c.k,name:c.name.trim(),scope:c.scope==='staff'?'staff':'all',type:catType(c),mode:c.mode==='week'?'week':'each',items:c.items||'',fields:c.fields||[],layout:c.layout==='1'?'1':'4'}));S.docCats=L;await saveSettings();
      if(SERVER){await queueShared();
        for(const p of PL){const c=L.find(x=>x.k===(p.cat||'plans'));if(c&&(p.scope||'all')!==c.scope)await save('plans',{...p,cat:p.cat||'plans',scope:c.scope})}
        for(const r of RC){const c=L.find(x=>x.k===r.cat);if(c&&(r.scope||'all')!==c.scope)await save('records',{...r,scope:c.scope})}}
      toast('카테고리 저장됨');R.settings('site')};
  render()}
function bindForms(){const box=$('#fmBox');if(!box)return;
  box.innerHTML=FORM_FIELDS.map(([k,l,big])=>`<label class="f">${l}</label>${big?`<textarea class="inp" data-fm="${k}" rows="3" placeholder="${h(FORM_DEF[k])}">${h((S.forms||{})[k]||'')}</textarea>`:`<input class="inp" data-fm="${k}" value="${h((S.forms||{})[k]||'')}" placeholder="${h(FORM_DEF[k])}">`}`).join('')+
    '<div class="row" style="margin-top:10px"><button class="btn sm ghost" id="fmReset">모두 기본 문구로</button><span style="flex:1"></span><button class="btn sm" id="fmSave">양식 문구 저장</button></div>';
  const commit=async f=>{S.forms=f;await saveSettings();if(SERVER)await queueShared();toast('양식 문구 저장됨')};
  $('#fmSave').onclick=()=>{const f={};$$('[data-fm]',box).forEach(x=>{const v=x.value.trim();if(v)f[x.dataset.fm]=v});commit(f)};
  $('#fmReset').onclick=async()=>{if(!confirm('모든 양식 문구를 기본값으로 되돌릴까요?'))return;await commit({});bindForms()}}
function bindHomeLayout(){const box=$('#hlBox');if(!box)return;let L=homeLayout();
  const N=hlNames();
  const commit=async()=>{S.homeLayout=L.map(it=>({k:it.k,wide:it.wide,hide:it.hide,name:it.name||''}));await saveSettings();if(SERVER)await queueShared();render();toast('홈 배치 저장됨')};
  const render=()=>{box.innerHTML=L.map((it,i)=>`<div class="row" style="padding:7px 0;border-top:1px solid var(--line);gap:8px;flex-wrap:nowrap">
      <span class="small muted" style="width:18px">${i+1}</span><input class="inp grow" data-hn="${i}" value="${h(it.name||'')}" placeholder="${h(N[it.k])}" style="min-width:0;padding:6px 8px;font-size:14px;${it.hide?'opacity:.45':''}" title="타일 이름 (비우면 기본 이름)">
      <label class="small row" style="gap:4px;flex-wrap:nowrap"><input type="checkbox" data-hw="${i}" ${it.wide?'checked':''}>넓게</label>
      <label class="small row" style="gap:4px;flex-wrap:nowrap"><input type="checkbox" data-hs="${i}" ${it.hide?'':'checked'}>보이기</label>
      <button class="btn sm line" data-hu="${i}" ${i?'':'disabled'} aria-label="위로">▲</button><button class="btn sm line" data-hd="${i}" ${i<L.length-1?'':'disabled'} aria-label="아래로">▼</button></div>`).join('')+
      '<button class="btn sm ghost" id="hlReset" style="margin-top:8px">기본 배치로 되돌리기</button>';
    $$('[data-hw]',box).forEach(c=>c.onchange=()=>{L[+c.dataset.hw].wide=c.checked;commit()});
    $$('[data-hn]',box).forEach(c=>c.onchange=()=>{L[+c.dataset.hn].name=c.value.trim();commit()});
    $$('[data-hs]',box).forEach(c=>c.onchange=()=>{L[+c.dataset.hs].hide=!c.checked;commit()});
    $$('[data-hu]',box).forEach(b=>b.onclick=()=>{const i=+b.dataset.hu;[L[i-1],L[i]]=[L[i],L[i-1]];commit()});
    $$('[data-hd]',box).forEach(b=>b.onclick=()=>{const i=+b.dataset.hd;[L[i+1],L[i]]=[L[i],L[i+1]];commit()});
    $('#hlReset').onclick=()=>{if(!confirm('홈 배치를 기본값으로 되돌릴까요?'))return;S.homeLayout=[];L=homeLayout();commit()}};
  render()}
