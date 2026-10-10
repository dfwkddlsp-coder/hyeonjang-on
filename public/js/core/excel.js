// 현장ON — 엑셀 불러오기·내보내기
'use strict';
/* ---------- excel import ---------- */
const WORKER_FIELDS={company:['소속업체','협력사명','업체명','소속','업체','협력사','회사'],name:['성명','이름','근로자명'],job:['직종','공종','직책','직무'],gender:['성별'],birth:['생년월일','생일'],phone:['연락처','전화번호','휴대폰','핸드폰'],emergency:['비상연락처'],elderly:['고령근로자','고령자'],foreign:['외국인근로자','외국인'],blood:['혈액형'],helmet:['안전모번호','출입번호','안전모','사번'],inDate:['최초투입일','투입일','입사일','출근일'],hireY:['연도'],hireM:['=월'],hireD:['=일'],eduY:['기초안전보건교육이수'],eduN:['=미이수'],note:['비고']};
const EQUIP_FIELDS={no:['관리번호','번호'],company:['소속업체','업체명','소속','업체'],type:['장비명','장비종류','기종'],operator:['운전원','조종원','기사'],plate:['차량번호','등록번호'],phone:['운전원연락처','연락처','전화번호'],inDate:['반입일자','반입일'],outDate:['반출일자','반출일'],regCert:['건설기계등록증','등록증'],inspect:['검사기간','검사유효기간','검사일'],bizCert:['사업자등록증','사업자'],license:['운전원면허증','면허증','조종사면허'],moveIns:['동산보험'],insurance:['보험유효기간','보험기간','보험만료'],manager:['전담관리자','관리자'],checklist:['점검표'],note:['비고'],commander:['작업지휘자'],signal:['신호수','유도원']};
const EQUIP_LABEL={no:'관리번호',company:'소속업체',type:'장비명',operator:'운전원',plate:'차량번호',phone:'운전원 연락처',inDate:'반입일자',outDate:'반출일자',regCert:'건설기계 등록증',inspect:'건설기계 검사기간',bizCert:'사업자 등록증',license:'운전원 면허증',moveIns:'동산보험',insurance:'보험유효기간',manager:'전담관리자',checklist:'점검표',note:'비고',commander:'작업지휘자',signal:'신호수'};
const WORKER_LABEL={company:'소속업체',name:'성명',job:'직종',gender:'성별',birth:'생년월일',phone:'연락처',emergency:'비상연락처',inDate:'채용일자',elderly:'고령근로자',foreign:'외국인근로자',blood:'혈액형',eduBasic:'기초안전보건교육',note:'비고'};

function buildMap(top,sub,FIELDS){
  const n=Math.max(top.length,sub?sub.length:0);const best={};
  for(let c=0;c<n;c++){
    const hd=norm((top[c]||'')+(sub?(sub[c]||''):''));if(!hd)continue;
    let bf=null,bl=0;
    for(const [f,al] of Object.entries(FIELDS))for(const a of al){const ex=a[0]==='=',na=norm(ex?a.slice(1):a),L=na.length;if((ex?hd===na:hd.includes(na))&&L>bl){bf=f;bl=L}}
    if(bf&&(!best[bf]||best[bf].l<bl))best[bf]={c,l:bl};
  }
  const m={};for(const k in best)m[k]=best[k].c;return m;
}
/* 빈 서식 행, 멀리 떨어진 낙서 셀(예: 1,048,537행의 'ㅋ')을 범위에서 제외 — 빈 행 500개 이상 이어지면 거기서 끝 */
function trimRef(ws){
  if(!ws['!ref'])return;const rs=new Set();let mc=0;
  for(const k in ws){if(k[0]==='!')continue;const c=ws[k];if(c.v===undefined||c.v===null||String(c.v).trim()==='')continue;const a=XLSX.utils.decode_cell(k);rs.add(a.r);if(a.c>mc)mc=a.c}
  const sorted=[...rs].sort((a,b)=>a-b);let mr=sorted[0]||0;
  for(const r of sorted){if(r-mr>500)break;mr=r}
  ws['!ref']=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:mr,c:mc}});
}
function parseWorkbook(wb,FIELDS,minScore){
  let best=null;
  for(const sn of wb.SheetNames){
    const ws=wb.Sheets[sn];trimRef(ws);
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:'',blankrows:true});
    for(let r=0;r<Math.min(rows.length,20);r++){
      const m1=buildMap(rows[r],null,FIELDS),m2=buildMap(rows[r],rows[r+1]||[],FIELDS);
      const two=Object.keys(m2).length>Object.keys(m1).length;
      const map=two?m2:m1,sc=Object.keys(map).length;
      if(sc>=minScore&&(!best||sc>best.score))best={sn,rows,map,score:sc,start:r+(two?2:1)};
    }
  }
  if(!best)return null;
  if(best.map.hireY!=null&&best.map.hireM==null)best.map.hireM=best.map.hireY+1;
  if(best.map.hireM!=null&&best.map.hireD==null)best.map.hireD=best.map.hireM+1;
  const out=[];
  for(let r=best.start;r<best.rows.length;r++){const row=best.rows[r];const o={};
    for(const f in best.map)o[f]=String(row[best.map[f]]??'').trim();out.push(o)}
  return {sheet:best.sn,rows:out,fields:Object.keys(best.map)};
}
const readFile=f=>new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>{try{res(XLSX.read(fr.result,{type:'array'}))}catch(e){rej(e)}};fr.onerror=()=>rej(fr.error);fr.readAsArrayBuffer(f)});
const eqKey=e=>(norm(e.plate)||norm(e.company)+'|'+norm(e.type))+'|'+norm(e.operator);
const wKey=w=>norm(w.name)+'|'+(norm(w.birth)||norm(w.company));

async function importFiles(kind,files,replace){
  if(kind==='vuln')return importVuln(files,replace);
  const isW=kind==='workers';const FIELDS=isW?WORKER_FIELDS:EQUIP_FIELDS;let added=0,updated=0,skipped=0;const msgs=[];const touched=new Set();
  const cur=replace?[]:[...(isW?W:E)];const idx=new Map(cur.map(x=>[isW?wKey(x):eqKey(x),x]));
  for(const f of files){
    let res;try{res=parseWorkbook(await readFile(f),FIELDS,isW?2:3)}catch(e){msgs.push(`${f.name}: 읽기 실패`);continue}
    if(!res){msgs.push(`${f.name}: 머리글(${isW?'성명/소속':'장비명/차량번호'}) 행을 찾지 못함`);continue}
    for(const o of res.rows){
      const valid=isW?!!o.name:!!(o.type||o.plate||o.operator);if(!valid){continue}
      if(isW&&/^(성명|이름)$/.test(o.name)){continue}
      if(isW){if(!o.inDate&&o.hireY&&o.hireM)o.inDate=`${o.hireY}-${pad(o.hireM)}-${pad(o.hireD||1)}`;if(o.eduY||o.eduN)o.eduBasic=o.eduY?'이수':'미이수';['hireY','hireM','hireD','eduY','eduN'].forEach(k=>delete o[k])}
      const k=isW?wKey(o):eqKey(o);const ex=idx.get(k);
      if(ex){for(const f2 in o)if(o[f2])ex[f2]=o[f2];ex.src=f.name;ex.updated=nowLocal();updated++;touched.add(ex.id)}
      else{const n={id:uid(),...o,src:f.name,created:nowLocal()};cur.push(n);idx.set(k,n);added++;touched.add(n.id)}
    }
    msgs.push(`${f.name} [${res.sheet}] 인식 완료`);
  }
  const store=isW?'workers':'equipment';
  if(SERVER)await pushImport(store,replace?cur:cur.filter(x=>touched.has(x.id)),replace);
  else{await DB.putMany(store,cur,replace);if(isW)W=cur;else E=cur}
  return {added,updated,skipped,msgs};
}

/* ---------- excel export ---------- */
function sheet(aoa,cols,merges){const ws=XLSX.utils.aoa_to_sheet(aoa);if(cols)ws['!cols']=cols.map(w=>({wch:w}));if(merges)ws['!merges']=merges.map(m=>XLSX.utils.decode_range(m));return ws}
function download(wb,name){XLSX.writeFile(wb,name)}
function tplWorkers(){
  const wb=XLSX.utils.book_new();const C=XLSX.utils.decode_col;const row=o=>{const r=[];for(const k in o)r[C(k)]=o[k];for(let i=0;i<36;i++)if(r[i]===undefined)r[i]='';return r};
  const r1=row({E:S.site||'현장명'});
  const r2=row({A:'구분',B:'채용일자',E:'근로자 인적사항',L:'고령근로자',M:'외국인근로자',N:'혈액형',O:'체온',P:'혈압이상유무',U:'기초안전보건교육',W:'기타건강이상유무',Y:'배치전건강검진',Z:'교육대상',AA:'불법',AD:'유소견자',AF:'취약근로자',AG:'건강검진',AH:'소음',AI:'분진'});
  const r3=row({A:'NO',B:'연도',C:'월',D:'일',E:'협력사명',F:'직종',G:'성  명',H:'성별',I:'생년월일',J:'연락처',K:'비상연락처',P:'수축기',Q:'이완기',R:'진단',S:'복약',T:'소견서',U:'이수',V:'미이수',W:'정상',X:'이상',Y:'대상/비대상',Z:'특별',AA:'불법',AB:' 사유서제출/검사서',AC:'배치 전 검진결과',AD:'고혈압',AE:'당뇨',AJ:'비고'});
  const aoa=[r1,r2,r3];for(let i=1;i<=300;i++)aoa.push([i]);
  const cols=[5,6,4,4,16,10,9,5,11,14,14,9,10,6,6,6,6,6,6,6,6,6,6,6,9,6,6,12,12,6,6,9,8,6,6,18];
  XLSX.utils.book_append_sheet(wb,sheet(aoa,cols,['A1:D1','E1:AB1','B2:D2','E2:K2','P2:S2','U2:V2','W2:X2','AD2:AE2']),'신규근로자 관리대장');
  XLSX.utils.book_append_sheet(wb,sheet([['작성 안내'],['· 2~3행 머리글은 지우거나 바꾸지 마세요. 앱이 머리글 이름으로 열을 찾습니다.'],['· 성명·협력사명은 필수. 생년월일은 640125-1 처럼 기존 방식대로 적으면 됩니다.'],['· 업체별로 따로 작성해 여러 파일을 한 번에 올려도 됩니다. 같은 성명+생년월일은 자동 병합됩니다.']],[90]),'작성안내');
  download(wb,'근로자 관리대장 양식.xlsx');
}
function tplEquip(){
  const wb=XLSX.utils.book_new();
  const top=['관리\n번호','소속업체','장비명','운전원','차량번호','운전원 연락처','반입일자','반출일자','장 비 관 련 서 류','','','','','보험유효기간','전담관리자','점검표','','비고','작업지휘자','신호수'];
  const sub=['','','','','','','','','건설기계\n등 록 증','건설기계\n검사기간','사 업 자\n등 록 증','운 전 원\n면 허 증','동산보험','','','','','','',''];
  const aoa=[['  년  월  주차 장비관리현황'],['A-고소작업대, B-굴삭기, C-이동식크레인, D-천공기, E-도저'],top,sub];for(let i=1;i<=60;i++)aoa.push([i]);
  const mg=['A1:T1','A2:T2','I3:M3','P3:Q3'];['A','B','C','D','E','F','G','H','N','O','R','S','T'].forEach(c=>mg.push(`${c}3:${c}4`));mg.push('P4:Q4');
  XLSX.utils.book_append_sheet(wb,sheet(aoa,[5,18,20,8,13,14,10,10,9,10,9,9,8,11,10,5,5,8,10,8],mg),'장비담당제');
  download(wb,'장비 관리대장(장비 전담 관리자 지정서) 양식.xlsx');
}
function exportWorkers(list){
  const wb=XLSX.utils.book_new();const hd=['NO',...Object.values(WORKER_LABEL),'삼진아웃 누적','상태'];
  const aoa=[['근로자 관리대장'],['현장명 :',S.site,'','','','','','','','출력일',today()],hd];
  list.forEach((w,i)=>{const k=pkey(w.name,w.company);aoa.push([i+1,...Object.keys(WORKER_LABEL).map(f=>w[f]||''),strikesOf(k).length,isBanned(k)?'퇴출':''])});
  XLSX.utils.book_append_sheet(wb,sheet(aoa,[5,18,10,12,6,12,15,15,11,10,10,7,10,11,18,10,8],['A1:Q1']),'근로자관리대장');download(wb,`근로자 관리대장_${today()}.xlsx`);
}
function exportEquip(list){
  const keys=Object.keys(EQUIP_LABEL);const aoa=[['장비 관리대장'],['현장명 :',S.site,'','','','','출력일',today()],keys.map(k=>EQUIP_LABEL[k])];
  list.forEach(e=>aoa.push(keys.map(k=>e[k]||'')));const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,sheet(aoa,keys.map(k=>k==='company'||k==='type'?18:11),['A1:S1']),'장비관리대장');download(wb,`장비 관리대장_${today()}.xlsx`);
}
function violationRows(list){return list.map((v,i)=>[i+1,fmtDT(v.at),v.company,v.name,v.job,v.type,v.detail||'',v.place||'',`${v.level}차`,v.action.replace(/\n/g,' / '),v.level===2?(v.edu&&v.edu.done?`이수 ${fmtDT(v.edu.at)}`:'미이수'):'',`${v.inspectorOrg||''} ${v.inspector||''}`.trim(),v.violatorRefused?`서명거부(입회:${v.witness||''})`:(v.sigViolator?'서명':'') ,v.void?`무효: ${v.void.reason}`:''])}
function exportViolations(list){
  const wb=XLSX.utils.book_new();const hd=['NO','적발일시','소속업체','성명','직종','위반내용','상세','장소','차수','조치사항','교육이수','점검자','위반자확인','비고'];
  XLSX.utils.book_append_sheet(wb,sheet([['삼진아웃제 적발 관리대장'],['현장명 :',S.site],hd,...violationRows(list)],[5,16,16,9,10,22,20,14,6,40,16,16,16,16],['A1:N1']),'삼진아웃');
  download(wb,`삼진아웃 적발대장_${today()}.xlsx`);
}
function alcRowsOfDay(ds){return A.filter(a=>a.date===ds&&!a.void).sort((a,b)=>a.at.localeCompare(b.at))}
function alcSheetAoa(ds){
  const rows=alcRowsOfDay(ds);const d=new Date(ds+'T00:00');
  const aoa=[['음주측정관리명부'],['현장명 : ',S.site,'','','','','','','',`${d.getFullYear()}. ${d.getMonth()+1}. ${d.getDate()}.`],['NO','소속/업체명','직종','성명','측정시간','측정결과(%)','판정','조치사항','측정인','사후조치']];
  rows.forEach((a,i)=>aoa.push([i+1,a.company,a.job,a.name+(a.retestOf?' (재측정)':''),hm(a.at),a.refused?'거부':a.value.toFixed(3),a.judge,a.action,a.measurer,a.follow||'']));
  for(let i=rows.length;i<40;i++)aoa.push([i+1]);return aoa;
}
function weekSummary(from,to){
  const out=[];for(let ds=from;ds<=to;ds=addDays(ds,1)){
    const base=alcRowsOfDay(ds).filter(a=>!a.retestOf);const am=base.filter(a=>+a.at.slice(11,13)<12),pm=base.filter(a=>+a.at.slice(11,13)>=12);
    const c=l=>{const bad=l.filter(a=>isAlcBad(alcFinal(a))).length;return [l.length,l.length-bad,bad]};
    out.push({ds,am:c(am),pm:c(pm)})}
  return out;
}
function exportAlcohol(from,to){
  const wb=XLSX.utils.book_new();
  const sm=weekSummary(from,to);
  const aoa=[[`음주측정일지 (${from} ~ ${to})`],['현장명',S.site,'','','측정일',`${from} ~ ${to}`],['측정인',`${S.inspectorOrg} ${S.inspector}`.trim()],['일자','구분','측정인원(명)','양호(명)','적발(명)']];
  sm.forEach(r=>{aoa.push([dayLabel(r.ds),'오전',...r.am]);aoa.push(['','오후',...r.pm])});
  const tot=sm.reduce((t,r)=>[0,1,2].map(i=>t[i]+r.am[i]+r.pm[i]),[0,0,0]);aoa.push(['합계','',...tot]);
  aoa.push([]);aoa.push(['■ 판정기준',alcCriteria().join(' / ')]);
  XLSX.utils.book_append_sheet(wb,sheet(aoa,[12,8,12,10,10,30],['A1:F1']),'음주측정일지');
  for(let ds=from;ds<=to;ds=addDays(ds,1)){if(!alcRowsOfDay(ds).length)continue;
    XLSX.utils.book_append_sheet(wb,sheet(alcSheetAoa(ds),[5,18,10,12,9,11,9,24,12,18],['A1:J1','B2:H2']),ds.slice(5).replace('-','월')+'일')}
  download(wb,`음주측정기록표_${from}_${to}.xlsx`);
}
