// 현장ON — 카테고리: PDF 문서함, 사진대지, 점검표, 작성 양식
'use strict';
/* ---------- 현장 운영안 (PDF) — 운영자가 올리고 모든 사용자가 열람 ---------- */
/* 문서함(PDF) 카테고리 — 운영자가 설정 → 현장 기준에서 추가·이름·공개 범위 지정. 각 카테고리는 홈 타일 하나 */
const docCats=()=>(Array.isArray(S.docCats)&&S.docCats.length?S.docCats:DEF.docCats);
const catVisible=c=>can('records.view')&&(c.scope!=='staff'||can('records.staff'));
/* 문서 순서: 관리자·운영자가 정한 순서(ord). 순서가 없는 문서(새로 올린 것)는 맨 위에 최신순 */
const plansSorted=k=>PL.filter(p=>k===undefined||(p.cat||'plans')===k).sort((a,b)=>(b.ord==null)-(a.ord==null)||(a.ord==null?String(b.at).localeCompare(String(a.at)):a.ord-b.ord));
const fmtSize=n=>n>=1048576?(n/1048576).toFixed(1)+'MB':Math.max(1,Math.round(n/1024))+'KB';
const planUrl=p=>`/api/file/${p.fileId}?n=${encodeURIComponent(p.title)}`;

/* ---------- 카테고리 기록 (사진대지 · 점검표 · 작성 양식) ----------
   운영자가 설정 → 현장 기준 → 카테고리에서 유형과 내용 구성을 정함. 기록은 'records' 저장소 (cat = 카테고리 키) */
const CAT_TYPES={pdf:'PDF 문서함',photo:'사진대지',check:'점검표',form:'작성 양식'};
const FIELD_TYPES={text:'글자',area:'긴 글',num:'숫자',date:'날짜',sel:'선택',chk:'체크',photo:'사진',sig:'서명'};
const catType=c=>CAT_TYPES[c&&c.type]?c.type:'pdf';
const catItems=c=>String(c.items||'').split('\n').map(x=>x.trim()).filter(Boolean);
const recsOf=k=>RC.filter(r=>r.cat===k).sort((a,b)=>String(b.date||b.week||'').localeCompare(String(a.date||a.week||''))||String(b.at).localeCompare(String(a.at)));
const CK_SYM={O:'○',X:'×',N:'-'};
const canWriteCat=C=>!SERVER||catVisible(C);
/* 고치기·지우기: 쓴 사람과 운영자 (서버도 같은 규칙) */
const canEditRec=r=>!SERVER||ownRec(r);


/* 사진대지 형식 (기록마다 작성자가 고름, 수정 가능) — '4': 한 칸에 사진 4장 + 일시·내용 1개 / '1': 한 칸에 사진 1장 + 사진마다 내용 */
const recLayout=r=>r&&r.layout==='1'?'1':'4';

