// 현장ON — 장비 점검: 장비 추가(점검 화면) · 장비 종류별 양식 설정
'use strict';
/* 장비점검 화면 [장비 추가]: 대장에 없는 장비가 갑자기 들어온 경우 */
function eqQuickAdd(){
  const fs=eqForms();
  openModal('장비 추가',`${isGuest()?'':'<div class="small muted">관리대장에 없는 장비를 바로 등록하고 점검합니다. 장비 대장에도 함께 들어갑니다.</div>'}
    <label class="f">점검표 양식 *</label><select class="inp" id="qaF">${fs.map(f=>`<option value="${h(f.k)}">${h(f.name)}</option>`).join('')}<option value="base">기본 (굴착기 등)</option></select>
    <div class="grid g2"><div><label class="f">장비명 *</label><input class="inp" id="qaT" placeholder="예) 크레인(50톤)"></div><div><label class="f">차량번호</label><input class="inp" id="qaP"></div>
    <div><label class="f">소속업체</label>${comboHtml('qaC','company',isGuest()?ME.org||'':'','업체명 직접 입력')}</div><div${isGuest()?' hidden':''}><label class="f">전담관리자</label><input class="inp" id="qaM" value="${isGuest()?'':h(S.inspector||'')}"></div>
    <div><label class="f">운전원</label><input class="inp" id="qaO" value="${isGuest()?h(ME.name):''}"></div><div><label class="f">운전원 연락처</label><input class="inp" id="qaPh" inputmode="tel" placeholder="010-0000-0000" value="${isGuest()?h(ME.title||''):''}"></div></div>
    <button class="btn xl" id="qaOk" style="width:100%;margin-top:14px">추가하고 점검표 열기</button>`,b=>{
    bindCombos(b);const sync=()=>{const f=fs.find(x=>x.k===$('#qaF',b).value);if(f&&!$('#qaT',b).dataset.typed)$('#qaT',b).value=f.name};sync();
    $('#qaF',b).onchange=sync;$('#qaT',b).oninput=()=>{$('#qaT',b).dataset.typed=1};
    $('#qaOk',b).onclick=async()=>{const type=$('#qaT',b).value.trim();if(!type)return toast('장비명을 입력하세요');
      const e={id:uid(),type,plate:$('#qaP',b).value.trim(),company:$('#qaC',b).value.trim(),manager:$('#qaM',b).value.trim(),operator:$('#qaO',b).value.trim(),phone:$('#qaPh',b).value.trim(),
        inDate:today(),formK:$('#qaF',b).value,src:isGuest()?'임시 출입':'장비점검 추가',created:nowLocal(),byId:ME?ME.id:''};
      try{await save('equipment',e);closeModal();toast('장비를 추가했습니다');R.eqcheck();eqWeekForm(e.id,weekMon(R.eqcheck.d||today()))}catch(x){toast(x.message)}}})}

/* 설정 → 현장 기준: 장비 종류별 양식 편집 */
function bindEqForms(){const box=$('#efBox');if(!box)return;let L=eqForms().map(f=>({...f}));
  const render=()=>{box.innerHTML=L.map((f,i)=>`<details class="card" style="margin:8px 0;padding:10px"><summary><b>${h(f.name)}</b> <span class="small muted">— 점검 ${parseItems(f.items).length}개 · 사진 ${parseLines(String(f.photos||'').trim()?f.photos:f.items).length+1}칸 · 장비명에 "${h(f.match)}"</span></summary>
      <div class="grid g2" style="margin-top:8px"><div><label class="f">양식 이름</label><input class="inp" data-en="${i}" value="${h(f.name)}"></div><div><label class="f">장비명 키워드 (쉼표로 구분)</label><input class="inp" data-em="${i}" value="${h(f.match)}"></div></div>
      <label class="f">점검 항목 — 한 줄에 "점검항목|점검방법"</label><textarea class="inp" data-ei="${i}" style="min-height:200px;font-size:13px">${h(f.items)}</textarea>
      <label class="f">주간 사진 항목 — 한 줄에 "사진항목|설명" <span class="small muted">(비우면 위 점검 항목을 그대로 씀 · 맨 앞 '점검사진'은 자동)</span></label><textarea class="inp" data-ep="${i}" style="min-height:110px;font-size:13px" placeholder="비우면 점검 항목과 같음">${h(f.photos||'')}</textarea>
      <button class="btn sm line" data-ex="${i}" style="margin-top:8px;color:var(--bad)">이 양식 삭제</button></details>`).join('')+
    `<label class="f">점검 대상에서 뺄 장비 — 장비명 키워드 (쉼표로 구분)</label><input class="inp" id="efEx" value="${h(S.eqExclude===undefined?EQ_EXCLUDE_DEF:S.eqExclude)}" placeholder="예) 살수차">
     <div class="row" style="margin-top:10px"><button class="btn sm line" id="efAdd"><i class="i i-plus"></i> 양식 추가</button><button class="btn sm ghost" id="efReset">기본 양식으로</button><span style="flex:1"></span><button class="btn sm" id="efSave">장비 양식 저장</button></div>`;
    $$('[data-en]',box).forEach(x=>x.oninput=()=>{L[+x.dataset.en].name=x.value});
    $$('[data-em]',box).forEach(x=>x.oninput=()=>{L[+x.dataset.em].match=x.value});
    $$('[data-ei]',box).forEach(x=>x.oninput=()=>{L[+x.dataset.ei].items=x.value});
    $$('[data-ep]',box).forEach(x=>x.oninput=()=>{L[+x.dataset.ep].photos=x.value});
    $$('[data-ex]',box).forEach(x=>x.onclick=()=>{if(!confirm(`「${L[+x.dataset.ex].name}」 양식을 삭제할까요? 이 양식을 쓰던 장비는 기본 양식으로 점검합니다.`))return;L.splice(+x.dataset.ex,1);render()});
    $('#efAdd',box).onclick=()=>{L.push({k:uid(),name:'새 장비',match:'',items:''});render();const d=$$('details',box);d[d.length-1].open=true};
    $('#efReset',box).onclick=()=>{if(!confirm('장비별 양식을 처음 기본값(크레인·지게차·고소작업차·항타기·도저·천공기)으로 되돌릴까요?'))return;L=EQF_DEF.map(f=>({...f}));render()};
    $('#efSave',box).onclick=async()=>{if(L.some(f=>!f.name.trim()))return toast('양식 이름을 입력하세요');
      const clean=t=>String(t||'').split('\n').map(x=>x.trim()).filter(Boolean).join('\n');
      S.eqForms=L.map(f=>({k:f.k,name:f.name.trim(),match:f.match.trim(),items:clean(f.items),photos:clean(f.photos)}));S.eqExclude=$('#efEx',box).value.trim();
      await saveSettings();if(SERVER)await queueShared();toast('장비 양식 저장됨')}};
  render()}

