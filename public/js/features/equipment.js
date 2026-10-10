// 현장ON — 장비 점검 (장비전담제)
'use strict';
/* ---------- 장비 점검 (장비전담제) ----------
   주간 점검표: 「장비 전담 관리자 점검표」 일일점검표 시트처럼 한 장(한 화면)에 월~토를 한꺼번에 체크
   점검 항목: 「장비전담제 장비점검방법」 10~16쪽 (설정 → 현장 기준에서 운영자가 수정)
   주간 사진: 장비당 주 1회 — [점검사진(관리자+장비)] + 항목별 1장
   사진대지: 「사진대지 양식」 — 한 장에 2건, 건마다 사진 4장 + 일시·내용 */
const WD6='월화수목금토';
const parseItems=src=>String(src).split('\n').map(l=>l.trim()).filter(Boolean).map(l=>l.replace(/^\d+\s*[.)]?\s*/,'')).filter(Boolean).map(l=>{const i=l.indexOf('|');return i<0?{t:l,d:''}:{t:l.slice(0,i).trim(),d:l.slice(i+1).trim()}});
/* 주간 점검표 항목 (엑셀 일일점검표) */
function eqItems(){return parseItems(S.eqCheckItems||DEF.eqCheckItems)}
/* ---------- 장비 종류별 주간 점검표 양식 ----------
   장비명에 키워드가 들어 있으면 그 양식 (장비에서 직접 고른 양식이 우선). 어느 것에도 안 맞으면 기본 양식(굴착기 등).
   항목은 "점검항목|점검방법" 한 줄씩. 출처: 건설장비 안전점검표(40종) */
const EQF_DEF=[
 {k:'crane',name:'크레인',match:'크레인',items:'과부하 방지장치|정격하중 초과시 경보음과 함께 작동이 정지될 것\n권과 방지장치|훅이 최상부에 도달하기 전에 경보음과 함께 작동이 정지될 것\n훅 및 시브|훅 해지장치는 탈락 등의 이상이 없고 훅, 시브(도르래)는 원활하게 회전할 것\n와이어로프|와이어로프는 소선파단 등의 이상이 없고 단말처리가 양호할 것\n아웃트리거|수평 유지하여 최대확장을 하고 지반이상 및 받침목 2단 초과 사용을 금지할 것\n카운터 웨이트|임의개조가 없으며 제원표와 무게가 일치하고 견고하게 고정될 것\n와이어로프 이탈방지핀|시브(도르래)에 와이어로프 이탈 방지핀이 설치되어 있을 것\n유압장치 및 실린더|유압모터·실린더·배관 등에 누유 및 손상, 마모 등이 없을 것\n각종 등화류|전조·후미·안개·경광등의 기능은 정상작동 될 것\n브레이크 및 클러치|브레이크, 클러치 및 조정장치 등은 기능이 정상일 것'},
 {k:'forklift',name:'지게차',match:'지게차',items:'후방 감시카메라|후방 감시카메라는 상시 전원이 켜져있고 모니터 등 작동에 문제가 없을 것\n조종장치 제동장치|조종장치, 클러치, 브레이크 등은 정상작동되고 좌석안전띠가 부착될 것\n후사경 후진경보기|후사경은 정상 부착되고 후진 경보장치는 정상적으로 작동될 것\n유압장치 및 실린더|유압모터·실린더·배관 등에 누유 및 손상, 마모 등이 없을 것\n트랙, 차륜(타이어)|트랙 궤도 또는 차륜(타이어)의 균열 및 변형이 없고, 체결상태가 양호할 것\n카운터 웨이트|추가설치 등 임의개조가 없으며 견고하게 고정될 것\n포크(하역장치)|변형 및 균열이 없고, 고정핀은 견고하게 체결되어 있을 것\n각종 등화류|전조·후미·방향지시·경보등의 기능은 정상작동 될 것\n헤드가드 백레스트|헤드가드와 백레스트는 정상적으로 설치되고 변형 등의 이상이 없을 것\n기타 안전시설|승강용 발판, 헤드가드, 협착 방지봉 등의 설치상태가 양호할 것'},
 {k:'aerial',name:'고소작업차',match:'고소작업차,스카이',items:'과부하 방지장치|정격하중 초과시 경보음과 함께 작동이 정지될 것\n비상 정지장치|버튼을 누르면 동력이 차단되고 버튼은 적색의 수동복귀형일 것\n비상 하강장치|조작 설명서가 부착되고 동력이 차단된 경우라도 조작하면 작업대가 하강할 것\n아웃트리거|수평 유지하여 최대확장을 하고 지반이상 및 받침목 2단 초과 사용을 금지할 것\n와이어로프|와이어로프는 소선파단 등의 이상이 없고 단말처리가 양호할 것\n선회장치 및 작업대|고정볼트는 풀림 등 이상이 없고 작업대 낙하물 및 추락방지조치가 있을 것\n외관상태|용접부 등 주요부에 균열, 변형이 없고 유압장치는 누유 등의 이상이 없을 것\n브레이크 및 클러치|브레이크, 클러치, 운전장치 등은 기능이 정상일 것\n모니터|모니터(인디게이터)는 정상적으로 작동할 것\n모멘트 감지장치|전도모멘트가 발생할 경우 경보음과 함께 전도모멘트가 가중되는 작동이 정지될 것'},
 {k:'pile',name:'항타기·항발기',match:'항타,항발',items:'권과 방지장치|훅, 햄머 등을 최대높이 상승전에 경보음과 함께 작동이 정지될 것\n와이어로프|와이어로프는 소선파단 등의 이상이 없고 단말처리가 양호할 것\n리더 및 햄머|높이, 수직도, 무게는 제원표 이내이고 볼트의 풀림, 변형 등 이상이 없을 것\n트랙|트랙은 균열, 손상 및 변형 등의 이상이 없고 긴장상태가 적정할 것\n아웃트리거 및 철판|이동시 침하방지용 철판을 사용하고 작업시 프론트잭, 아웃트리거를 사용할 것\n발전기|발전기의 고정(용접, 볼트체결)상태는 양호하고 충전부의 노출이 없을 것\n카운터 웨이트|임의개조가 없으며 제원표와 무게가 일치하고 견고하게 고정될 것\n역회전 방지장치|역회전방지장치 및 브레이크는 정상작동되고 이상없이 양호할 것\n주요구조부|턴테이블, 백스테이 등 주요 구조부의 조립부 및 작동부에 이상이 없을 것\n기타 안전시설|리더부 수직사다리에 수직생명줄을 설치할 것'},
 {k:'dozer',name:'도저',match:'도저',items:'비상 정지장치|버튼을 누르면 모든 작동이 중단 될 것, 버튼은 수동 복귀형일 것\n후방 감시카메라|후방 감시카메라는 상시 전원이 켜져있고 모니터 등 작동에 문제가 없을 것\n조종장치 제동장치|조종장치, 클러치, 브레이크 등은 정상작동되고 좌석안전띠가 부착될 것\n후사경 후진경보기|후사경은 정상 부착되고 후진 경보장치는 정상적으로 작동될 것\n유압장치 및 실린더|유압모터·실린더·배관 등에 누유 및 손상, 마모 등이 없을 것\n트랙|트랙은 균열, 손상 및 변형 등의 이상이 없고 긴장상태가 적정할 것\n주요구조부|주요 구조부의 변형, 손상 및 조립부, 작동부에 이상이 없을 것\n각종 등화류|전조·후미·안개·경광등의 기능은 정상작동 될 것'},
 {k:'drill',name:'천공기·어스드릴',match:'천공기,어스드릴,유압드릴,크롤러드릴,점보드릴,오거',items:'리더 및 오거|높이, 수직도, 무게는 제원표 이내이고 볼트의 풀림, 변형 등 이상이 없을 것\n트랙 및 철판|트랙 손상, 변형 여부 및 이동시 지반상태를 확인하고 필요시 철판을 사용할 것\n와이어로프|와이어로프는 소선파단 등의 이상이 없고 단말처리가 양호할 것\n유압장치 및 실린더|유압모터·실린더·배관 등에 누유 및 손상, 마모 등이 없을 것\n주요구조부|주요 구조부의 변형, 손상 및 조립부, 작동부에 이상이 없을 것\n기타|브레이크, 클러치, 운전장치 등은 기능이 정상일 것'},
];
const EQ_EXCLUDE_DEF='살수차';
const eqForms=()=>Array.isArray(S.eqForms)?S.eqForms:EQF_DEF;
const kwList=s=>String(s||'').split(',').map(x=>x.replace(/\s/g,'')).filter(Boolean);
function eqFormOf(e){if(!e)return null;const fs=eqForms();
  if(e.formK){if(e.formK==='base')return null;const f=fs.find(x=>x.k===e.formK);if(f)return f}
  const ty=String(e.type||'').replace(/\s/g,'');return fs.find(f=>kwList(f.match).some(k=>ty.includes(k)))||null}
function eqItemsFor(e){const f=eqFormOf(e);return f?parseItems(f.items):eqItems()}
const eqFormName=e=>{const f=eqFormOf(e);return f?f.name:'기본 (굴착기 등)'};
const eqExcluded=e=>!e.formK&&kwList(S.eqExclude===undefined?EQ_EXCLUDE_DEF:S.eqExclude).some(k=>String(e.type||'').replace(/\s/g,'').includes(k));
const eqTargets=()=>E.filter(e=>!e.outDate&&!eqExcluded(e));
/* 저장된 주간 기록은 그때의 항목으로 출력 (양식을 나중에 바꿔도 지난 점검표는 그대로) */
const eqWeekItems=(e,w)=>{const ks=w&&(Array.isArray(w.itemList)&&w.itemList.length?w.itemList:w.marks&&Object.keys(w.marks).length?Object.keys(w.marks):null);return ks?ks.map(t=>{const cur=eqItemsFor(e).find(i=>i.t===t);return {t,d:cur?cur.d:''}}):eqItemsFor(e)};

/* 장비점검 화면 [장비 추가]: 대장에 없는 장비가 갑자기 들어온 경우 */
function eqQuickAdd(){
  const fs=eqForms();
  openModal('장비 추가',`<div class="small muted">관리대장에 없는 장비를 바로 등록하고 점검합니다. 장비 대장에도 함께 들어갑니다.</div>
    <label class="f">점검표 양식 *</label><select class="inp" id="qaF">${fs.map(f=>`<option value="${h(f.k)}">${h(f.name)}</option>`).join('')}<option value="base">기본 (굴착기 등)</option></select>
    <div class="grid g2"><div><label class="f">장비명 *</label><input class="inp" id="qaT" placeholder="예) 크레인(50톤)"></div><div><label class="f">차량번호</label><input class="inp" id="qaP"></div>
    <div><label class="f">소속업체</label>${comboHtml('qaC','company','','업체명 직접 입력')}</div><div><label class="f">전담관리자</label><input class="inp" id="qaM" value="${h(S.inspector||'')}"></div>
    <div><label class="f">운전원</label><input class="inp" id="qaO"></div><div><label class="f">운전원 연락처</label><input class="inp" id="qaPh" inputmode="tel" placeholder="010-0000-0000"></div></div>
    <button class="btn xl" id="qaOk" style="width:100%;margin-top:14px">추가하고 점검표 열기</button>`,b=>{
    bindCombos(b);const sync=()=>{const f=fs.find(x=>x.k===$('#qaF',b).value);if(f&&!$('#qaT',b).dataset.typed)$('#qaT',b).value=f.name};sync();
    $('#qaF',b).onchange=sync;$('#qaT',b).oninput=()=>{$('#qaT',b).dataset.typed=1};
    $('#qaOk',b).onclick=async()=>{const type=$('#qaT',b).value.trim();if(!type)return toast('장비명을 입력하세요');
      const e={id:uid(),type,plate:$('#qaP',b).value.trim(),company:$('#qaC',b).value.trim(),manager:$('#qaM',b).value.trim(),operator:$('#qaO',b).value.trim(),phone:$('#qaPh',b).value.trim(),
        inDate:today(),formK:$('#qaF',b).value,src:'장비점검 추가',created:nowLocal()};
      try{await save('equipment',e);closeModal();toast('장비를 추가했습니다');R.eqcheck();eqWeekForm(e.id,weekMon(R.eqcheck.d||today()))}catch(x){toast(x.message)}}})}

/* 설정 → 현장 기준: 장비 종류별 양식 편집 */
function bindEqForms(){const box=$('#efBox');if(!box)return;let L=eqForms().map(f=>({...f}));
  const render=()=>{box.innerHTML=L.map((f,i)=>`<details class="card" style="margin:8px 0;padding:10px"><summary><b>${h(f.name)}</b> <span class="small muted">— 항목 ${parseItems(f.items).length}개 · 장비명에 "${h(f.match)}"</span></summary>
      <div class="grid g2" style="margin-top:8px"><div><label class="f">양식 이름</label><input class="inp" data-en="${i}" value="${h(f.name)}"></div><div><label class="f">장비명 키워드 (쉼표로 구분)</label><input class="inp" data-em="${i}" value="${h(f.match)}"></div></div>
      <label class="f">점검 항목 — 한 줄에 "점검항목|점검방법"</label><textarea class="inp" data-ei="${i}" style="min-height:200px;font-size:13px">${h(f.items)}</textarea>
      <button class="btn sm line" data-ex="${i}" style="margin-top:8px;color:var(--bad)">이 양식 삭제</button></details>`).join('')+
    `<label class="f">점검 대상에서 뺄 장비 — 장비명 키워드 (쉼표로 구분)</label><input class="inp" id="efEx" value="${h(S.eqExclude===undefined?EQ_EXCLUDE_DEF:S.eqExclude)}" placeholder="예) 살수차">
     <div class="row" style="margin-top:10px"><button class="btn sm line" id="efAdd"><i class="i i-plus"></i> 양식 추가</button><button class="btn sm ghost" id="efReset">기본 양식으로</button><span style="flex:1"></span><button class="btn sm" id="efSave">장비 양식 저장</button></div>`;
    $$('[data-en]',box).forEach(x=>x.oninput=()=>{L[+x.dataset.en].name=x.value});
    $$('[data-em]',box).forEach(x=>x.oninput=()=>{L[+x.dataset.em].match=x.value});
    $$('[data-ei]',box).forEach(x=>x.oninput=()=>{L[+x.dataset.ei].items=x.value});
    $$('[data-ex]',box).forEach(x=>x.onclick=()=>{if(!confirm(`「${L[+x.dataset.ex].name}」 양식을 삭제할까요? 이 양식을 쓰던 장비는 기본 양식으로 점검합니다.`))return;L.splice(+x.dataset.ex,1);render()});
    $('#efAdd',box).onclick=()=>{L.push({k:uid(),name:'새 장비',match:'',items:''});render();const d=$$('details',box);d[d.length-1].open=true};
    $('#efReset',box).onclick=()=>{if(!confirm('장비별 양식을 처음 기본값(크레인·지게차·고소작업차·항타기·도저·천공기)으로 되돌릴까요?'))return;L=EQF_DEF.map(f=>({...f}));render()};
    $('#efSave',box).onclick=async()=>{if(L.some(f=>!f.name.trim()))return toast('양식 이름을 입력하세요');
      S.eqForms=L.map(f=>({k:f.k,name:f.name.trim(),match:f.match.trim(),items:String(f.items).split('\n').map(x=>x.trim()).filter(Boolean).join('\n')}));S.eqExclude=$('#efEx',box).value.trim();
      await saveSettings();if(SERVER)await queueShared();toast('장비 양식 저장됨')}};
  render()}

/* 주간 사진 항목 (장비점검방법 PPT) */
function eqPhotoItems(){return String(S.eqItems||DEF.eqItems).split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{const i=l.indexOf('|');return i<0?{t:l,d:''}:{t:l.slice(0,i).trim(),d:l.slice(i+1).trim()}})}
function eqSlots(){return [{t:'점검사진',d:'전담관리자와 장비가 함께 나온 사진'},...eqPhotoItems().map((it,i)=>({t:`${i+1}. ${it.t}`,d:it.d}))]}
const eqName=e=>`${e.type||'장비'}${e.plate?`(${e.plate})`:''}`;
const isMine=e=>!!S.inspector&&norm(e.manager)===norm(S.inspector);
const weekRecId=(eid,mon)=>`wk-${eid}-${mon}`;
const weekPhotoId=(eid,mon)=>`wp-${eid}-${mon}`;
const eqWeekRec=(eid,mon)=>EC.find(c=>c.id===weekRecId(eid,mon)&&!c.void);
const eqWeekPhoto=(eid,mon)=>EC.find(c=>c.id===weekPhotoId(eid,mon)&&!c.void);
/* 예전 방식(하루 1건) 기록도 같이 읽음 */
const eqLegacyDay=(eid,ds)=>EC.filter(c=>!c.kind&&c.equipId===eid&&c.date===ds&&!c.void).sort((a,b)=>(b.created||'').localeCompare(a.created||''))[0];
/* 특정 날짜 칸의 표시: 'O' 양호 · 'X' 불량 있음 · 'P' 일부만 체크 · '' 미점검 */
function eqDayMark(eid,ds){
  const mon=weekMon(ds),i=weekDays(mon).indexOf(ds),w=eqWeekRec(eid,mon);
  if(w){const vals=Object.values(w.marks||{}).map(a=>a[i]||'');if(vals.some(v=>v)){if(vals.includes('X'))return 'X';return vals.every(v=>v)?'O':'P'}}
  const c=eqLegacyDay(eid,ds);if(c)return c.items.some(x=>x.v==='X')?'X':'O';
  return '';
}
const eqCheckOf=(eid,ds)=>eqDayMark(eid,ds)||undefined;
/* 체크 값: O 적합 · X 부적합 · N 해당없음 · E 기타의견 (X·E는 비고 필수) */
const MARK_SYM={O:'○',X:'×',N:'-',E:'△','':''};
const MARK_TXT={O:'적합',X:'부적합',N:'해당없음',E:'기타의견'};
/* 월~토 모든 칸이 채워지면 '완료' */
function eqWeekComplete(eid,mon){const w=eqWeekRec(eid,mon);if(!w)return false;const items=eqWeekItems(E.find(x=>x.id===eid),w);return items.length>0&&items.every(it=>{const a=(w.marks||{})[it.t];return a&&a.length>=6&&a.slice(0,6).every(Boolean)})}
const stampHtml=(cls='')=>`<span class="stamp ${cls}">완료</span>`;
/* 장비 1대 출력 묶음: 주간 점검표 + 사진대지 */
function eqPrintPages(e,mon){const pages=[];if(weekDays(mon).some(d=>eqDayMark(e.id,d)))pages.push(docEqWeek(e,mon));pages.push(...docPhotoSheet(eqPhotoBlocks([e],mon)));return pages}
function eqCheckForm(eid,ds){eqWeekForm(eid,weekMon(ds||today()))}

R.eqcheck=()=>{
  const ds=R.eqcheck.d||today();const mon=weekMon(ds);const days=weekDays(mon);const t=today();
  const f=R.eqcheck.f||(E.some(isMine)?'mine':'all');const q=R.eqcheck.q||'';
  const inUse=eqTargets();
  const list=inUse.filter(e=>(f!=='mine'||isMine(e))&&(f!=='todo'||!eqDayMark(e.id,t))&&(!q||norm([e.type,e.plate,e.company,e.manager,e.operator].join(' ')).includes(norm(q))))
    .sort((a,b)=>(isMine(b)-isMine(a))||(+a.no||999)-(+b.no||999));
  const done=inUse.filter(e=>eqDayMark(e.id,t)).length,mine=inUse.filter(isMine),mineTodo=mine.filter(e=>!eqDayMark(e.id,t));
  const slots=eqSlots().length,phDone=inUse.filter(e=>{const p=eqWeekPhoto(e.id,mon);return p&&(p.photos||[]).length>=slots}).length;
  const future=mon>weekMon(t);
  V$().innerHTML=`<div class="row" style="justify-content:space-between"><h1>장비 점검</h1>${isDriver()?'':'<button class="btn sm" id="eqAdd"><i class="i i-plus"></i> 장비 추가</button>'}</div>
  <div class="row" style="margin-bottom:10px"><button class="btn sm line" id="wPrev">◀</button><div class="grow" style="text-align:center"><b>${weekLabel(mon)}</b><div class="small muted">${md(days[0])} ~ ${md(days[5])}</div></div><button class="btn sm line" id="wNext">▶</button>${mon!==weekMon(t)?'<button class="btn sm ghost" id="wNow">이번 주</button>':''}</div>
  <div class="grid g4" style="margin-bottom:10px"><div class="stat"><div class="t">오늘 점검</div><div class="n">${done}<span class="small muted">/${inUse.length}대</span></div></div>
   <div class="stat"><div class="t">내 담당 미점검</div><div class="n" style="color:${mineTodo.length?'var(--bad)':'inherit'}">${mineTodo.length}<span class="small muted">/${mine.length}대</span></div></div>
   <div class="stat"><div class="t">주간 사진 완료</div><div class="n">${phDone}<span class="small muted">/${inUse.length}대</span></div></div></div>
  <button class="btn line" id="pAll" style="width:100%;margin-bottom:10px"><i class="i i-print"></i> 주간 출력 — 목록의 모든 장비 (점검표 + 사진대지)</button>
  <div class="chips scroll" style="margin-bottom:8px">${[['mine','내 담당'],['all','전체'],['todo','오늘 미점검']].map(([k,l])=>`<button class="chip ${f===k?'on':''}" data-ef="${k}">${l}</button>`).join('')}</div>
  <input class="inp" id="eqq" type="search" placeholder="장비명·차량번호·업체·전담관리자" value="${h(q)}" style="margin-bottom:10px">
  ${!inUse.length?'<div class="card empty">장비 대장이 비어 있습니다. 관리대장 → 장비에서 엑셀을 불러오세요.</div>':''}
  ${list.map(e=>{const wp=eqWeekPhoto(e.id,mon),pn=wp?(wp.photos||[]).length:0;
    return `<div class="card eqc"><div class="row" style="gap:8px"><div class="grow" style="min-width:0"><b>${h(eqName(e))}</b>${isMine(e)?' <span class="badge">내 담당</span>':''}${eqWeekComplete(e.id,mon)?' '+stampHtml('sm'):''}<div class="small muted ell">${h(e.company||'')} · 전담 ${h(e.manager||'미지정')}${e.operator?' · 운전원 '+h(e.operator):''} · 양식 ${h(eqFormName(e))}</div></div></div>
    <div class="eqdays">${days.map((d,i)=>{const m=eqDayMark(e.id,d);return `<div class="eqd${d===t?' today':''}${m==='O'?' ok':m==='X'?' bad':''}${d>t&&!m?' off':''}"><span>${WD6[i]} ${md(d)}</span><b>${m==='O'?'○':m==='X'?'×':m==='P'?'…':d>t?'':'–'}</b></div>`}).join('')}</div>
    ${future?'':`<div class="grid g2" style="margin-top:8px;gap:8px"><button class="btn sm${eqWeekRec(e.id,mon)?' line':''}" data-wk="${e.id}"><i class="i i-pen"></i> ${eqWeekRec(e.id,mon)?'주간 점검표 보기/수정':'주간 점검표 체크'}</button>
      <button class="btn sm ${pn>=slots?'line':'ghost'}" data-wp="${e.id}"><i class="i i-camera"></i> 주간 사진 ${pn}/${slots}</button></div>
      <button class="btn sm line" data-pr="${e.id}" style="width:100%;margin-top:8px"><i class="i i-print"></i> 이 장비 출력 (점검표 + 사진대지)</button>`}</div>`}).join('')}
  ${inUse.length&&!list.length?'<div class="card empty">해당 장비 없음</div>':''}
  <div class="hint small">점검표는 한 화면에서 <b>월~토를 한꺼번에</b> 체크합니다. 사진은 <b>주 1회</b>, [점검사진(관리자+장비)]과 항목별로 1장씩 올립니다. (○ 적합 · × 부적합 · … 일부 · – 미점검)</div>`;
  const setD=v=>{R.eqcheck.d=v;R.eqcheck()};
  $('#wPrev').onclick=()=>setD(addDays(mon,-7));$('#wNext').onclick=()=>setD(addDays(mon,7));if($('#wNow'))$('#wNow').onclick=()=>setD(t);
  $$('[data-ef]').forEach(b=>b.onclick=()=>{R.eqcheck.f=b.dataset.ef;R.eqcheck()});
  $('#eqq').oninput=e=>{R.eqcheck.q=e.target.value;clearTimeout(R.eqcheck.t);R.eqcheck.t=setTimeout(()=>{R.eqcheck();const i=$('#eqq');i.focus();i.setSelectionRange(i.value.length,i.value.length)},250)};
  $$('[data-wk]').forEach(b=>b.onclick=()=>eqWeekForm(b.dataset.wk,mon));
  if($('#eqAdd'))$('#eqAdd').onclick=eqQuickAdd;
  $$('[data-wp]').forEach(b=>b.onclick=()=>eqWeekPhotoForm(b.dataset.wp,mon));
  $$('[data-pr]').forEach(b=>b.onclick=()=>{const e=E.find(x=>x.id===b.dataset.pr);const pg=eqPrintPages(e,mon);if(!pg.length)return toast('이번 주 점검표·사진이 없습니다');printPages(pg)});
  $('#pAll').onclick=()=>{const pg=list.flatMap(e=>eqPrintPages(e,mon));if(!pg.length)return toast('이번 주 점검표·사진이 없습니다');printPages(pg)};
};

/* 주간 점검표: 항목 × 월~토 표에서 칸을 눌러 ○ → × → - → 빈칸 */
function eqWeekForm(eid,mon,fresh){
  const e=E.find(x=>x.id===eid);if(!e)return;const prev=eqWeekRec(eid,mon);const items=prev&&!fresh?eqWeekItems(e,prev):eqItemsFor(e),days=weekDays(mon),t=today();
  const st={marks:{},notes:{...(prev&&prev.notes||{})}};
  for(const it of items)st.marks[it.t]=[...((prev&&prev.marks&&prev.marks[it.t])||['','','','','',''])];
  /* 예전 방식 하루 기록이 있으면 빈칸에 채워 넣음 */
  days.forEach((d,i)=>{const c=eqLegacyDay(eid,d);if(c)c.items.forEach(x=>{if(st.marks[x.t]&&!st.marks[x.t][i])st.marks[x.t][i]=x.v;if(x.note&&!st.notes[x.t])st.notes[x.t]=x.note})});
  const SYM=MARK_SYM,NEXT={'':'O',O:'X',X:'N',N:'E',E:''};
  openModal(`주간 점검표 · ${eqName(e)}`,`<div class="card"><dl class="kv"><dt>소속협력사</dt><dd>${h(e.company||'-')}</dd><dt>장비</dt><dd>${h(eqName(e))}</dd><dt>전담관리자</dt><dd>${h(e.manager||'미지정')}</dd><dt>점검표 양식</dt><dd>${isDriver()?h(eqFormName(e)):`<select class="inp" id="wkF" style="padding:4px 6px;width:auto">${eqForms().map(f=>`<option value="${h(f.k)}" ${eqFormOf(e)===f?'selected':''}>${h(f.name)}</option>`).join('')}<option value="base" ${eqFormOf(e)?'':'selected'}>기본 (굴착기 등)</option></select>`}</dd></dl>
     <div style="margin-top:8px"><b>${weekLabel(mon)}</b> <span class="muted small">(${md(days[0])}~${md(days[5])})</span> <span id="wkStamp"></span></div></div>
   ${items.some(it=>it.d)?'':'<!--'}<details class="card small"><summary><b>점검 방법 보기</b> (${h(eqFormName(e))})</summary>${items.map((it,i)=>`<div style="margin-top:8px"><b>${i+1}. ${h(it.t)}</b><div class="muted">${h(it.d)}</div></div>`).join('')}</details>${items.some(it=>it.d)?'':'-->'}
   <div class="row" style="margin-bottom:8px"><span class="grow small muted">칸을 누를 때마다 ○적합 → ×부적합 → -해당없음 → △기타의견 → 빈칸. 요일을 누르면 그날 전체 ○</span><button class="btn sm ghost" id="wkAll">오늘까지 모두 ○</button></div>
   <div class="wkwrap"><table class="wkt"><tr><th class="it">점검 항목</th>${days.map((d,i)=>`<th><button type="button" class="wkh" data-col="${i}" ${d>t?'disabled':''}>${WD6[i]}<br><small>${md(d)}</small></button></th>`).join('')}</tr>
     ${items.map((it,r)=>`<tr><td class="it">${r+1}. ${h(it.t)}</td>${days.map((d,c)=>`<td><button type="button" class="wkc" data-r="${r}" data-c="${c}" ${d>t?'disabled':''}></button></td>`).join('')}</tr>`).join('')}</table></div>
   <div id="wkNotes"></div>
   <div class="card"><label class="f">비고</label><textarea class="inp" id="wkR" placeholder="특이사항">${h(prev&&prev.remark||'')}</textarea>
     <div class="grid g2"><div><label class="f">점검자 (전담관리자)</label><input class="inp" id="wkBy" value="${h(prev&&prev.inspector||S.inspector||'')}"></div></div><div id="wkSig" style="margin-top:10px"></div></div>
   <div class="grid g2"><button class="btn xl" id="wkSave">저장</button>${prev&&isAdmin()?'<button class="btn xl line" id="wkDel">이 주 점검표 삭제</button>':''}</div>`,b=>{
    const paint=()=>{
      $$('.wkc',b).forEach(x=>{const v=st.marks[items[+x.dataset.r].t][+x.dataset.c];x.textContent=SYM[v];x.className='wkc'+(v?' v'+v:'')});
      const bad=items.filter(it=>st.marks[it.t].some(v=>v==='X'||v==='E'));
      $('#wkStamp',b).innerHTML=items.every(it=>st.marks[it.t].every(Boolean))?stampHtml('sm'):'';
      const box=$('#wkNotes',b);const keep={};$$('[data-note]',box).forEach(i=>keep[i.dataset.note]=i.value);Object.assign(st.notes,keep);
      box.innerHTML=bad.length?`<div class="card"><b style="color:var(--bad)">비고 (부적합 조치사항 · 기타의견) — 필수</b>${bad.map(it=>`<label class="f">${items.indexOf(it)+1}. ${h(it.t)} (${st.marks[it.t].map((v,i)=>v==='X'||v==='E'?WD6[i]+' '+MARK_TXT[v]:'').filter(Boolean).join(', ')})</label><input class="inp" data-note="${h(it.t)}" value="${h(st.notes[it.t]||'')}" placeholder="${st.marks[it.t].includes('X')?'부적합 내용·조치사항':'의견 내용'}">`).join('')}</div>`:'';
      $$('[data-note]',box).forEach(i=>i.oninput=()=>st.notes[i.dataset.note]=i.value)};
    $$('.wkc',b).forEach(x=>x.onclick=()=>{const a=st.marks[items[+x.dataset.r].t],c=+x.dataset.c;a[c]=NEXT[a[c]];paint()});
    $$('.wkh',b).forEach(x=>x.onclick=()=>{const c=+x.dataset.col;items.forEach(it=>{if(!st.marks[it.t][c])st.marks[it.t][c]='O'});paint()});
    $('#wkAll',b).onclick=()=>{days.forEach((d,c)=>{if(d<=t)items.forEach(it=>{if(!st.marks[it.t][c])st.marks[it.t][c]='O'})});paint()};
    paint();
    const wf=$('#wkF',b);if(wf)wf.onchange=async()=>{if(prev&&!confirm('양식을 바꾸면 이번 주 체크 중 같은 이름의 항목만 남습니다. 바꿀까요?')){wf.value=eqFormOf(e)?eqFormOf(e).k:'base';return}
      await save('equipment',{...e,formK:wf.value});closeModal();toast('점검표 양식을 바꿨습니다');eqWeekForm(eid,mon,true)};
    const sig=sigPad($('#wkSig',b),'전담관리자 서명',prev&&prev.sig?prev.sig:(($('#wkBy',b).value.trim()===S.inspector)?S.mySig:''));
    $('#wkBy',b).addEventListener('change',()=>{$('#wkBy').value.trim()===S.inspector?sig.useMine():sig.clear()});
    const del=$('#wkDel',b);if(del)del.onclick=async()=>{if(!confirm('이 주 점검표를 삭제할까요?'))return;try{await remove('eqchecks',prev.id);closeModal();R[cur]()}catch(x){toast(x.message)}};
    $('#wkSave',b).onclick=async()=>{
      $$('[data-note]',b).forEach(i=>st.notes[i.dataset.note]=i.value);
      if(!items.some(it=>st.marks[it.t].some(Boolean)))return toast('체크한 칸이 없습니다');
      const bad=items.find(it=>st.marks[it.t].some(v=>v==='X'||v==='E')&&!String(st.notes[it.t]||'').trim());if(bad){toast(`비고를 꼭 적어주세요: ${bad.t}`);const i=$(`[data-note="${CSS.escape(bad.t)}"]`,b);if(i)i.focus();return}
      const by=$('#wkBy').value.trim();if(!by)return toast('점검자 이름을 입력하세요');if(sig.isEmpty())return toast('서명이 필요합니다');
      const notes={};items.forEach(it=>{if(st.marks[it.t].some(v=>v==='X'||v==='E'))notes[it.t]=String(st.notes[it.t]||'').trim()});
      await save('eqchecks',{id:weekRecId(eid,mon),kind:'week',week:mon,equipId:e.id,type:e.type||'',plate:e.plate||'',company:e.company||'',manager:e.manager||'',
        marks:Object.fromEntries(items.map(it=>[it.t,st.marks[it.t]])),itemList:items.map(it=>it.t),form:eqFormName(e),notes,remark:$('#wkR').value.trim(),inspector:by,sig:sig.data(),created:prev?prev.created:nowLocal(),updated:nowLocal()});
      closeModal();toast(items.every(it=>st.marks[it.t].every(Boolean))?'주간 점검 완료':items.some(it=>st.marks[it.t].includes('X'))?'저장됨 — 부적합 항목 조치를 확인하세요':'주간 점검표 저장됨');R[cur]();
    };
  });
}

/* 주간 사진: 점검사진 + 항목별 1장 (장비당 주 1회 — 같은 주에 다시 열면 같은 기록을 수정) */
function eqWeekPhotoForm(eid,mon){
  const e=E.find(x=>x.id===eid);if(!e)return;const prev=eqWeekPhoto(eid,mon);const slots=eqSlots();
  const st={};for(const p of (prev&&prev.photos)||[])if(p.slot)st[p.slot]=p.src;
  let target=null;
  openModal(`주간 사진 · ${eqName(e)}`,`<div class="card"><b>${weekLabel(mon)}</b> <span class="muted small">(${md(mon)}~${md(addDays(mon,5))})</span>
     <div class="small muted" style="margin-top:4px">장비당 <b>한 주에 한 번</b>, 항목마다 사진 1장. 먼저 <b>점검사진</b>(전담관리자와 장비가 함께 나온 사진)을 올려주세요.${prev?` · 마지막 저장 ${h(prev.by||'')} ${fmtDT(prev.updated||prev.created)}`:''}</div>
     <div class="small" style="margin-top:6px" id="wpProg"></div></div>
   <div id="wpSlots"></div>
   <input type="file" accept="image/*" capture="environment" hidden id="wpCam"><input type="file" accept="image/*" hidden id="wpGalIn">
   <div class="grid g2"><button class="btn xl" id="wpSave">${prev?'수정 저장':'저장'}</button>${prev&&isAdmin()?'<button class="btn xl line" id="wpDel">이 주 사진 삭제</button>':''}</div>`,b=>{
    const draw=()=>{
      $('#wpProg',b).innerHTML=`등록 <b>${slots.filter(s=>st[s.t]).length}</b> / ${slots.length}`;
      $('#wpSlots',b).innerHTML=slots.map((s,i)=>`<div class="card wpslot${st[s.t]?' done':''}"><div class="row" style="gap:10px;align-items:flex-start">
        <div class="wpthumb">${st[s.t]?`<img src="${st[s.t]}">`:'<i class="i i-camera"></i>'}</div>
        <div class="grow" style="min-width:0"><b>${h(s.t)}</b>${s.d?`<div class="small muted">${h(s.d)}</div>`:''}
          <div class="row" style="margin-top:8px;gap:6px"><button type="button" class="btn sm${st[s.t]?' line':''}" data-cam="${i}"><i class="i i-camera"></i> ${st[s.t]?'다시 촬영':'촬영'}</button><button type="button" class="btn sm ghost" data-gal="${i}">갤러리</button>${st[s.t]?`<button type="button" class="btn sm line" data-rm="${i}">삭제</button>`:''}</div></div></div></div>`).join('');
      $$('[data-cam]',b).forEach(x=>x.onclick=()=>{target=slots[+x.dataset.cam].t;$('#wpCam',b).click()});
      $$('[data-gal]',b).forEach(x=>x.onclick=()=>{target=slots[+x.dataset.gal].t;withGalleryConsent(()=>$('#wpGalIn').click())});
      $$('[data-rm]',b).forEach(x=>x.onclick=()=>{delete st[slots[+x.dataset.rm].t];draw()});
    };draw();
    const take=async ev=>{const fl=ev.target.files[0];ev.target.value='';if(!fl||!target)return;try{st[target]=await compressImg(fl);draw()}catch(x){toast('사진 처리 실패')}};
    $('#wpCam',b).onchange=take;$('#wpGalIn',b).onchange=take;
    const del=$('#wpDel',b);if(del)del.onclick=async()=>{if(!confirm('이 주의 사진을 모두 삭제할까요?'))return;try{await remove('eqchecks',prev.id);closeModal();R[cur]()}catch(x){toast(x.message)}};
    $('#wpSave',b).onclick=async()=>{const photos=slots.filter(s=>st[s.t]).map(s=>({slot:s.t,cap:s.t,src:st[s.t]}));if(!photos.length)return toast('사진을 1장 이상 올려주세요');
      await save('eqchecks',{id:weekPhotoId(eid,mon),kind:'weekPhoto',week:mon,equipId:e.id,type:e.type||'',plate:e.plate||'',company:e.company||'',manager:e.manager||'',
        photos,by:S.inspector||'',created:prev?prev.created:nowLocal(),updated:nowLocal()});
      closeModal();toast(`${weekLabel(mon)} 사진 ${photos.length}/${slots.length} 저장됨`);R[cur]()};
  });
}

/* 주간 일일점검표 출력 — A4 가로 1장 / 장비 1대 (현장 엑셀 양식과 같은 배치) */
function docEqWeek(e,mon){
  const days=weekDays(mon),w=eqWeekRec(e.id,mon),legacy=days.map(d=>eqLegacyDay(e.id,d));
  const its=eqWeekItems(e,w),titles=its.map(i=>i.t);
  const val=(t,i)=>{const v=w&&w.marks&&w.marks[t]?w.marks[t][i]:'';if(v)return v;const c=legacy[i];const it=c&&c.items.find(x=>x.t===t);return it?it.v:''};
  const sym=v=>v==='X'?'<b>×</b>':MARK_SYM[v]||'';
  const note=t=>{const n=[];if(w&&w.notes&&w.notes[t])n.push(h(w.notes[t]));legacy.forEach((c,i)=>{const it=c&&c.items.find(x=>x.t===t);if(it&&it.note)n.push(`${WD6[i]}: ${h(it.note)}`)});return n.join('<br>')};
  const sigSrc=w&&w.sig||(legacy.find(c=>c&&c.sig)||{}).sig;
  const remarks=[w&&w.remark?h(w.remark):'',...legacy.map((c,i)=>c&&c.remark?`${WD6[i]} ${h(c.remark)}`:'')].filter(Boolean);
  const done=eqWeekComplete(e.id,mon);
  const memo=[...titles.map((t,r)=>{const n=note(t);return n?`<div><b>${r+1}. ${h(t)}</b> — ${n}</div>`:''}).filter(Boolean),...remarks.map(x=>`<div>${x}</div>`)];
  const rowH=Math.max(7,Math.min(20,Math.floor(129/Math.max(titles.length,1))));
  return `<div class="doc eqw">${done?stampHtml('doc'):''}<h1>${FT('eqTitle')}</h1>
  <div class="eqf"><div><span>■ 소속협력사 :</span><u>${h(e.company||'')}</u></div>
    <div><span>■ 장비종류 :</span><u>${h(e.type||'')}${eqFormOf(e)?` (${h(w&&w.form||eqFormName(e))} 양식)`:''}</u><span style="margin-left:6mm">■ 장비번호 :</span><u>${h(e.plate||'')}</u><span class="wl">${weekLabel(mon)}</span></div>
    <div><span>■ 장비 전담관리자 :</span><u>${h(w&&w.inspector||e.manager||'')}</u><span class="sg">(서명)${sigSrc?`<img src="${sigSrc}">`:''}</span></div></div>
  <table class="grid6"><colgroup><col style="width:46%">${days.map(()=>'<col style="width:9%">').join('')}</colgroup>
  <tr><th class="it">점 검 항 목</th>${days.map((d,i)=>`<th>${WD6[i]}<br>( ${md(d)} )</th>`).join('')}</tr>
  ${titles.map((t,r)=>`<tr style="height:${rowH}mm"><td class="it">${r+1}. ${h(t)}${its[r].d?`<div class="md">${h(its[r].d)}</div>`:''}</td>${days.map((d,i)=>`<td class="mk">${sym(val(t,i))}</td>`).join('')}</tr>`).join('')}
  <tr class="memo"><th class="it">비 고</th><td colspan="6" class="rm">${memo.join('')}</td></tr>
  </table>
  <div class="eqfoot"><span>○ 적합 · × 부적합 · - 해당없음 · △ 기타의견 (부적합·기타의견은 비고에 내용)</span><span>${h(S.site||'')}</span></div></div>`;
}

/* 사진대지: 장비별 주간 사진을 4장씩 한 건으로 (사진마다 항목명 표시) */
function eqPhotoBlocks(list,mon){
  const out=[],label=weekLabel(mon),days=weekDays(mon);
  for(const e of list){
    const wp=eqWeekPhoto(e.id,mon);
    const order=eqSlots().map(s=>s.t);
    const ph=[...((wp&&wp.photos)||[]).slice().sort((a,b)=>order.indexOf(a.slot)-order.indexOf(b.slot)),
      ...EC.filter(c=>!c.kind&&c.equipId===e.id&&!c.void&&c.date>=days[0]&&c.date<=days[5]).flatMap(c=>(c.photos||[]))];
    for(let i=0;i<ph.length;i+=4){const g=ph.slice(i,i+4);out.push({date:label,content:eqName(e),photos:g.map(p=>({src:p.src,cap:p.cap||p.slot||''}))})}
  }
  return out;
}
function docPhotoSheet(blocks){
  const cell=p=>p?`<td colspan="2" class="pc"><div class="pw"><img src="${p.src}">${p.cap?`<span class="pcap">${h(p.cap)}</span>`:''}</div></td>`:'<td colspan="2" class="pc"></td>';
  const block=b=>{const ph=b.photos;return `<table class="pst"><colgroup><col style="width:9%"><col style="width:41%"><col style="width:9%"><col style="width:41%"></colgroup>
    <tr>${cell(ph[0])}${cell(ph[1])}</tr><tr>${cell(ph[2])}${cell(ph[3])}</tr>
    <tr class="cap"><th>일 시</th><td>${h(b.date)}</td><th>내 용</th><td>${h(b.content)}</td></tr></table>`};
  const pages=[];
  for(let i=0;i<blocks.length;i+=2){
    const two=blocks.slice(i,i+2);
    pages.push(`<div class="doc psheet"><h1>${FT('psTitle')}</h1><div class="pl">현장명 : ${h(S.site||'')}</div>
    ${two.map(block).join('')}${two.length===1?'<table class="pst"><tr><td class="pempty">이하 여백</td></tr></table>':''}</div>`);
  }
  return pages;
}
