// 현장ON — 일정표 월간 달력: 월 이동, 날짜별 일정, 월별 달력 파일 받기 (이 칸만 다시 그려서 화면이 튀지 않음)
'use strict';
/* 보고 있는 달·날짜와 받기 칸 상태 (화면을 나갔다 와도 유지) */
const SC_VIEW={m:'',sel:'',dlOpen:false,dlDuty:false};
const scMonthAll=ym=>scDated().filter(x=>x.date.startsWith(ym));
const scExportList=(ym,duty)=>scMonthAll(ym).filter(x=>duty||!scIsDuty(x)).sort(scSort);

/* 일요일 시작. 점은 그 날 일정 수(당직 제외, 최대 3개) */
function scCalGrid(y,m,t){
  const ym=SC_VIEW.m,lead=new Date(y,m-1,1).getDay(),last=new Date(y,m,0).getDate();
  const cell=i=>{const d=`${ym}-${pad(i)}`,wd=(lead+i-1)%7,n=Math.min(3,scDay(d).filter(x=>!scIsDuty(x)).length);
    return `<button type="button" class="sch-cd${wd===0?' sun':wd===6?' sat':''}${d===t?' today':''}${d===SC_VIEW.sel?' sel':''}" data-d="${d}" aria-label="${scMD(d)}"><span class="n">${i}</span><span class="dots">${'<span></span>'.repeat(n)}</span></button>`};
  return `<div class="sch-cg">${[...WD].map(x=>`<div class="sch-cw">${x}</div>`).join('')}${'<div class="sch-ce"></div>'.repeat(lead)}${Array.from({length:last},(_,i)=>cell(i+1)).join('')}</div>`;
}
/* 월별 달력 파일 받기 칸 */
function scCalExport(m){
  if(!can('sched.export'))return '';
  const {m:ym,dlOpen,dlDuty}=SC_VIEW,dn=scMonthAll(ym).filter(scIsDuty).length;
  return `<button type="button" class="btn sm line" id="schDl" style="width:100%;margin-bottom:10px"><i class="i i-records"></i> ${m}월 달력 받기 (한 번만 복사)</button>${dlOpen?`<div class="sch-dl"><b>${m}월 달력 받기</b><div class="small muted" style="margin:4px 0 8px">일정 ${scExportList(ym,dlDuty).length}건을 파일로 받습니다${dlDuty&&dn?` (당직 ${dn}건 포함)`:''}</div>
      <label class="sch-ck" style="border:0;padding:0 0 8px"><input type="checkbox" id="schDlD"${dlDuty?' checked':''}> <span>당직자 포함</span></label>
      <div class="small muted" style="margin-bottom:10px">휴대폰 달력에 복사본으로 들어갑니다. 받은 뒤 바뀐 일정은 따라오지 않고, 같은 달을 다시 넣으면 중복될 수 있습니다.</div>
      <button type="button" class="btn" id="schDlGo" style="width:100%">파일 받기</button><div class="hint" id="schDlOk" style="margin-top:10px" hidden></div></div>`:''}`;
}
function scCalExportBind(box,redraw){
  const b=(id,fn,ev='onclick')=>{const e=$('#'+id,box);if(e)e[ev]=()=>fn(e)};
  b('schDl',()=>{SC_VIEW.dlOpen=!SC_VIEW.dlOpen;redraw()});
  b('schDlD',e=>{SC_VIEW.dlDuty=e.checked;redraw()},'onchange');
  b('schDlGo',()=>{const list=scExportList(SC_VIEW.m,SC_VIEW.dlDuty);if(!list.length)return toast('받을 일정이 없습니다');
    const name=`현장ON_일정_${SC_VIEW.m}.ics`;scDownload(name,SCHED_ICS.buildIcs(list,Date.now()),'text/calendar;charset=utf-8');
    const ok=$('#schDlOk',box);ok.hidden=false;ok.textContent=`${name} 파일을 받았습니다. 아이폰은 "모두 추가", 갤럭시는 파일을 삼성 캘린더로 열어 저장하세요.`});
}
function schedCal(box){
  const t=today(),now=t.slice(0,7),V=SC_VIEW;if(!V.m){V.m=now;V.sel=t}
  const [y,m]=V.m.split('-').map(Number),redraw=()=>schedCal(box);
  const goto=(ym,sel)=>{V.m=ym;V.sel=sel;redraw()};
  const move=n=>{const k=ymd(new Date(y,m-1+n,1)).slice(0,7);goto(k,k===now?t:k+'-01')};
  box.innerHTML=`<div class="sch-cal-t"><b>월간 계획 보기</b>${V.m===now?'':'<button type="button" class="btn sm ghost" id="schNow">오늘</button>'}</div>
    <div class="sch-cal-h"><button type="button" class="btn sm line" id="schPrev" aria-label="전월">◀</button><div class="sch-cal-m">${y===+t.slice(0,4)?'':y+'년 '}${m}월</div><button type="button" class="btn sm line" id="schNext" aria-label="다음 달">▶</button></div>
    ${scSubBtn()}${scCalExport(m)}${scCalGrid(y,m,t)}
    <div class="sch-dh sch-cal-d">${scMD(V.sel)}${V.sel===t?' · <b>오늘</b>':''}</div>
    <div class="list">${scDay(V.sel).map(x=>scRow(x)).join('')||'<div class="empty small">일정 없음</div>'}</div>
    ${can('sched.add')?'<button type="button" class="btn sm ghost" id="schDay" style="margin-top:8px"><i class="i i-plus"></i> 이 날 일정 추가</button>':''}`;
  $('#schPrev',box).onclick=()=>move(-1);$('#schNext',box).onclick=()=>move(1);
  const nw=$('#schNow',box);if(nw)nw.onclick=()=>goto(now,t);
  $$('[data-d]',box).forEach(x=>x.onclick=()=>{V.sel=x.dataset.d;redraw()});
  scBindRows(box);
  const ad=$('#schDay',box);if(ad)ad.onclick=()=>schedOne({date:V.sel,time:'',title:''});
  scCalExportBind(box,redraw);
  scSubBind(box,redraw);
}
