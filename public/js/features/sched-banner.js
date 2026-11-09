// 현장ON — 일정표: 홈 맨 위 공지 띠 (장비운전원은 장비점검 화면 위)
'use strict';
/* ---------- 홈 맨 위 공지 띠 ---------- */
function schedBanner(){
  if(!can('sched.view'))return '';
  const t=today(),tm=addDays(t,1),td=scDay(t),duty=scDutyName(t),items=td.filter(x=>!scIsDuty(x)),nx=scDay(tm).filter(x=>!scIsDuty(x)),nd=scDutyName(tm);
  if(!items.length&&!duty&&!nx.length){
    const up=scDated().filter(x=>x.date>tm&&!scIsDuty(x)).sort(scSort)[0];
    if(up)return `<button type="button" class="sch-note slim" id="schGo"><i class="i i-records"></i><span class="sch-m">다음 일정 · ${h(md(up.date))}(${WD[new Date(up.date+'T00:00').getDay()]}) ${h(up.title)}</span><span class="sch-more">일정표 ›</span></button>`;
    return can('sched.add')?`<button type="button" class="sch-note slim" id="schGo"><i class="i i-records"></i><span class="sch-m">다가오는 일정이 없습니다</span><span class="sch-more">일정 추가 ›</span></button>`:'';
  }
  /* 두 줄만: 1줄 = 오늘 몇 건·당직, 2줄 = 오늘 일정을 한 줄로 이어 씀(넘치면 …). 오늘 일정이 없으면 내일 것. 자세한 건 눌러서 일정표 */
  const one=x=>`${x.time?`<span class="sch-t">${scTime(x.time)}</span> `:''}${h(x.title)}`;
  const line=items.length?items.map(one).join(' · '):nx.length?`내일 · ${nx.map(one).join(' · ')}`:nd?`내일 당직 ${h(nd)}`:'';
  return `<button type="button" class="sch-note" id="schGo">
    <div class="sch-h"><b><i class="i i-records"></i> 오늘 일정 ${items.length}건</b>${duty?`<span class="sch-duty">당직 ${h(duty)}</span>`:''}<span class="sch-more">전체 ›</span></div>
    ${line?`<div class="sch-line">${line}</div>`:''}
  </button>`;
}
function schedBannerMount(){const b=$('#schGo');if(b)b.onclick=()=>go('schedule',b.textContent.includes('일정 추가')?'add':undefined)}
{const f=R.home;R.home=(...a)=>{f(...a);const html=schedBanner();if(!html)return;const hd=$('.hm-head',V$());if(hd)hd.insertAdjacentHTML('afterend',html);else V$().insertAdjacentHTML('afterbegin',html);schedBannerMount()}}
/* 장비운전원은 홈이 없고 장비점검이 첫 화면 → 그 위에 띠 */
{const f=R.eqcheck;R.eqcheck=(...a)=>{f(...a);if(viewOk('home'))return;const html=schedBanner();if(!html)return;V$().insertAdjacentHTML('afterbegin',html);schedBannerMount()}}
