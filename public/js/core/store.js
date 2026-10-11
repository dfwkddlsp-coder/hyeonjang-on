// 현장ON — IndexedDB, in-memory stores, save/remove, settings (DEF/S)
'use strict';
/* ---------- storage ---------- */
/* 기록 저장소 (IndexedDB object store = 서버 docs.store). 새 종류를 추가하면 여기와 아래 STORE·loadAll 배열만 */
const STORE_NAMES=['workers','equipment','violations','alcohol','vuln','eqchecks','plans','records'];
const DB={db:null,
  open(){return new Promise((res,rej)=>{const r=indexedDB.open('fieldsafety',6);
    r.onupgradeneeded=()=>{const d=r.result;STORE_NAMES.forEach(s=>{if(!d.objectStoreNames.contains(s))d.createObjectStore(s,{keyPath:'id'})});if(!d.objectStoreNames.contains('kv'))d.createObjectStore('kv',{keyPath:'k'});if(!d.objectStoreNames.contains('outbox'))d.createObjectStore('outbox',{keyPath:'k'})};
    r.onsuccess=()=>{this.db=r.result;res()};r.onerror=()=>rej(r.error)})},
  req(r){return new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})},
  st(s,m){return this.db.transaction(s,m).objectStore(s)},
  all(s){return this.req(this.st(s,'readonly').getAll())},
  put(s,o){return this.req(this.st(s,'readwrite').put(o))},
  del(s,id){return this.req(this.st(s,'readwrite').delete(id))},
  putMany(s,arr,clear){return new Promise((res,rej)=>{const t=this.db.transaction(s,'readwrite');const o=t.objectStore(s);if(clear)o.clear();arr.forEach(x=>o.put(x));t.oncomplete=res;t.onerror=()=>rej(t.error)})}
};
let W=[],E=[],V=[],A=[],VU=[],EC=[],PL=[],RC=[];
const STORE={workers:()=>W,equipment:()=>E,violations:()=>V,alcohol:()=>A,vuln:()=>VU,eqchecks:()=>EC,plans:()=>PL,records:()=>RC};
function memPut(store,obj){const arr=STORE[store]();const i=arr.findIndex(x=>x.id===obj.id);if(i>=0)arr[i]=obj;else arr.push(obj)}
function memDel(store,id){const arr=STORE[store]();const i=arr.findIndex(x=>x.id===id);if(i>=0)arr.splice(i,1)}
/* 서버 모드: 기기에 먼저 저장 → 전송 대기함(outbox) → 연결되면 서버로. 인터넷이 없어도 입력은 계속 됩니다 */
async function save(store,obj){await DB.put(store,obj);memPut(store,obj);if(SERVER){await DB.put('outbox',{k:store+'|'+obj.id,store,id:obj.id,data:obj,ts:Date.now()});Sync.soon()}}
async function remove(store,id){if(SERVER){if(!navigator.onLine){toast('삭제는 인터넷 연결이 필요합니다');throw new Error('offline')}await api('docs/delete',{store,id})}await DB.del(store,id);memDel(store,id)}

const DEF={
  site:'',inspectorOrg:'',inspector:'',periodMonths:0,pin:'',
  vtypes:['안전모 미착용 / 턱끈 미체결','안전대 미체결','지정 통로 외 이동','출입금지구역 무단 출입','개인보호구 미착용','신호수·유도자 없이 장비작업','작업절차 미준수','흡연구역 외 흡연','음주 후 출근·작업','기타'],
  levels:[
    {name:'1차 적발',sticker:'노란색',act:'위반 스티커 부착(노란색)\n근로자 관리대장 기록\n현장지도 및 교육'},
    {name:'2차 적발',sticker:'주황색',act:'위반 스티커 부착(주황색)\n근로자 관리대장 기록\n안전교육장에서 교육 진행(1시간)'},
    {name:'3차 적발',sticker:'적색',act:'작업중지\n해당 협력사 소장에게 퇴출 요청\n퇴출 조치'}
  ],
  vulnAge:55,bp:{warn:[140,90],stop:[160,100]},
  eqItems:'안전벨트 / 안전레버|좌석 안전벨트는 운행 중 상시 착용하고 안전레버 하강 시 조종이 불가할 것\n버켓 안전핀 / 훅해지장치|규정된 버켓을 사용하고 안전핀은 정상적으로 체결되어 있을 것, 훅해지장치가 있을 것\n조종장치 / 제동장치|브레이크, 클러치 및 조종장치는 손상 및 변형이 없으며 정상 작동될 것\n장비실명제 부착상태|장비실명제(허가증)가 부착되어 있고 해당 운전원이 실제 운전을 하고 있는지 확인\n협착방지봉 / 후방카메라·센서·후사경·경보기·조명|협착방지봉 부착상태, 후방카메라·센서·후사경·경보기·조명 정상작동 여부\n트랙 / 차륜|트랙 또는 차륜(타이어)의 균열·변형·파손 등 주행장치 이상이 없을 것 (손상이 심하면 타이어 교체 지시 및 확인)\n작업구역 통제|안전시설물 등으로 작업구역을 설정하고 유도자를 배치할 것 (장비 1대당 유도자 1명 이상)',
  eqCheckItems:'작업계획서 작성여부\n장비 실명제 부착상태\n백호 버킷 이탈방진핀 체결상태 (인식웨빙띠 설치)\n백호 훅 해지장치 설치상태\n크레인등 양중장비 권과방지장치 부착상태\n신호수 배치 및 복장상태 (깃발,호루라기,신호봉,적색조끼 및 안전모)\n후방카메라 작동상태\n후진경고음 작동상태\n타이어 마모상태\n장비후면 접근금지표지 및 협착방지봉 부착상태\n작업장구획 및 안전표지 부착상태\n작업장 정리정돈 상태\n주변 위험요소 방치 여부',
  vulnScope:'admin',
  homeLayout:[{k:'eqcheck',wide:true},{k:'strike'},{k:'alcohol'},{k:'workers'},{k:'equip'},{k:'vuln'},{k:'d_plans'}],
  docCats:[{k:'plans',name:'현장 운영안',scope:'all'}],forms:{},
  /* 안내 봇(안전온): 인사말({이름} = 로그인한 사람), 자주 묻는 질문(drv = 장비운전원에게도 보임), AI 참고 안내문 */
  guide:{name:'안전온',greet:'안녕하세요, {이름}님!\n현장ON 안내를 맡은 안전온입니다. 궁금한 걸 눌러 보세요.',aiOn:true,aiDay:300,aiText:'',faqs:[
    {q:'삼진아웃 등록하는 법',a:'홈 → 삼진아웃 → [적발 등록]을 누르세요.\n① 위반자를 이름으로 찾아 고르고 ② 위반 내용을 고른 뒤 ③ 사진(선택)을 넣고 ④ 점검자 서명과 위반자 서명을 받아 [저장]합니다.\n위반자가 서명을 거부하면 "서명 거부"에 체크하고 입회자를 적으면 됩니다.\n차수(1·2·3차)는 이전 적발 기록으로 자동으로 정해집니다.'},
    {q:'음주측정 하는 법',a:'홈 → 음주측정에서 측정할 근로자를 이름으로 찾아 고르세요.\n측정값(예: 0.012)과 측정인을 넣고 저장하면 현장 기준에 따라 판정이 바로 나옵니다.\n재측정이 필요하면 그 기록을 눌러 [재측정]을 누르세요.'},
    {q:'장비점검 하는 법',drv:true,a:'홈 → 장비점검에서 점검할 장비를 누르세요.\n장비운전원은 본인 장비만 보입니다.\n이번 주 점검표의 항목을 체크하고 저장한 뒤, 주간 사진 칸에 사진을 한 장씩 넣으면 됩니다.'},
    {q:'사진 여러 장 올리기',a:'사진 칸에서 [갤러리 (여러 장 선택)]을 누르면 한 번에 여러 장을 고를 수 있고, 빈 칸에 차례로 들어갑니다.\n[촬영]은 한 장씩 찍습니다.'},
    {q:'인터넷이 안 될 때',drv:true,a:'인터넷이 없어도 기록은 이 기기에 저장됩니다.\n화면 위에 "전송 대기 N"이 보이면 아직 서버로 안 간 기록이 있다는 뜻이고, 인터넷이 연결되면 자동으로 보내집니다.'},
    {q:'비밀번호를 잊었어요',drv:true,a:'운영자에게 말씀해 주세요. 운영자가 설정 → 사용자 관리에서 새 비밀번호를 정해 주면, 다음 로그인 때 비밀번호를 직접 바꾸게 됩니다.'}]},
  alcMode:'site',
  alc:{retest:0.020,stop:0.050,detect:0.001,day:0.030,outCount:2},
  alcMsg:'음주적발 알림\n1. 협력사명 : {업체}\n2. 측정일시 : {일시}\n3. {성명}({직종})\n4. 혈중 알코올 농도 {수치}\n5. 조치 : 🚫{조치}\n\n기준 : \n{기준}\n\n해당인원이 현장에서 작업하지 않도록 각별한 관리 부탁드리며 작업 중 적발 시 영구 퇴출 등 불이익이 발생할 수 있으니 참고해주시기 바랍니다.\n\n모든 관리자께서는 해당인원이 현장에서 작업할 시 작업중지 및 안전보건팀에 연락해주시기 바랍니다.'
};
let S=JSON.parse(JSON.stringify(DEF));
async function loadSettings(){const r=await DB.req(DB.st('kv','readonly').get('settings'));if(r){S=Object.assign(JSON.parse(JSON.stringify(DEF)),r.v);S.alc=Object.assign({},DEF.alc,r.v.alc||{})}}
async function saveSettings(){await DB.put('kv',{k:'settings',v:S})}
