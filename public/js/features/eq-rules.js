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


/* 주간 사진 항목: 장비 양식마다 (설정 → 장비 종류별 양식의 '주간 사진 항목'). 비우면 그 양식의 점검 항목,
   기본(굴착기 등) 양식은 장비점검방법 PPT 항목(S.eqItems) */
const parseLines=t=>String(t||'').split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{const i=l.indexOf('|');return i<0?{t:l,d:''}:{t:l.slice(0,i).trim(),d:l.slice(i+1).trim()}});
function eqPhotoItems(e){const f=eqFormOf(e);return parseLines(f?(String(f.photos||'').trim()?f.photos:f.items):(S.eqItems||DEF.eqItems))}
function eqSlots(e){return [{t:'점검사진',d:'점검자와 장비가 함께 나온 사진'},...eqPhotoItems(e).map((it,i)=>({t:`${i+1}. ${it.t}`,d:it.d}))]}
const eqName=e=>`${e.type||'장비'}${e.plate?`(${e.plate})`:''}`;
const isMine=e=>!!S.inspector&&norm(e.manager)===norm(S.inspector);
/* 점검은 둘로 따로: 관리자 점검(mgr — 운영자·관리자·사용자)과 운전원 점검(drv — 장비운전원·임시 운전원).
   기록이 따로라 한쪽이 체크한 것이 다른 쪽 점검표에 뜨지 않음. tr을 안 주면 내 쪽 */
const myTrack=()=>can('eq.drv')&&!can('eq.mgr')?'drv':'mgr'; // 운전원 점검만 할 수 있으면 운전원 쪽
const eqCanCheck=()=>can('eq.mgr')||can('eq.drv'); // 둘 다 없으면 점검표·사진은 보기만 (저장해도 서버가 거절하므로 버튼을 안 보임)
const weekRecId=(eid,mon,tr=myTrack())=>`${tr==='drv'?'wkd':'wk'}-${eid}-${mon}`;
const weekPhotoId=(eid,mon,tr=myTrack())=>`${tr==='drv'?'wpd':'wp'}-${eid}-${mon}`;
const eqWeekRec=(eid,mon,tr)=>EC.find(c=>c.id===weekRecId(eid,mon,tr)&&!c.void);
const eqWeekPhoto=(eid,mon,tr)=>EC.find(c=>c.id===weekPhotoId(eid,mon,tr)&&!c.void);
/* 예전 방식(하루 1건) 기록도 같이 읽음 */
const eqLegacyDay=(eid,ds)=>EC.filter(c=>!c.kind&&c.equipId===eid&&c.date===ds&&!c.void).sort((a,b)=>(b.created||'').localeCompare(a.created||''))[0];
/* 특정 날짜 칸의 표시: 'O' 양호 · 'X' 불량 있음 · 'P' 일부만 체크 · '' 미점검 */
function eqDayMark(eid,ds,tr){
  const mon=weekMon(ds),i=weekDays(mon).indexOf(ds),w=eqWeekRec(eid,mon,tr);
  if(w){const vals=Object.values(w.marks||{}).map(a=>a[i]||'');if(vals.some(v=>v)){if(vals.includes('X'))return 'X';return vals.every(v=>v)?'O':'P'}}
  const c=(tr||myTrack())==='mgr'&&eqLegacyDay(eid,ds);if(c)return c.items.some(x=>x.v==='X')?'X':'O';
  return '';
}
const eqCheckOf=(eid,ds)=>eqDayMark(eid,ds)||undefined;
/* 체크 값: O 적합 · X 부적합 · N 해당없음 · E 기타의견 (X·E는 비고 필수) */
const MARK_SYM={O:'○',X:'×',N:'-',E:'△','':''};
const MARK_TXT={O:'적합',X:'부적합',N:'해당없음',E:'기타의견'};
/* 월~토 모든 칸이 채워지면 '완료' */
function eqWeekComplete(eid,mon,tr){const w=eqWeekRec(eid,mon,tr);if(!w)return false;const items=eqWeekItems(E.find(x=>x.id===eid),w);return items.length>0&&items.every(it=>{const a=(w.marks||{})[it.t];return a&&a.length>=6&&a.slice(0,6).every(Boolean)})}
const stampHtml=(cls='')=>`<span class="stamp ${cls}">완료</span>`;
