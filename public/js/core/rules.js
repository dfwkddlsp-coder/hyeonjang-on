// 현장ON — 삼진아웃·음주 판정 규칙
'use strict';
/* ---------- domain ---------- */
const pkey=(name,company)=>norm(name)+'|'+norm(company);
function inPeriod(dateStr){if(!S.periodMonths)return true;const d=new Date();d.setMonth(d.getMonth()-S.periodMonths);return dateStr>=ymd(d)}
function strikesOf(key,excludeId){return V.filter(v=>!v.void&&v.pkey===key&&v.id!==excludeId&&inPeriod(v.date)).sort((a,b)=>a.at.localeCompare(b.at))}
function workerByKey(key){return W.find(w=>pkey(w.name,w.company)===key)}
function isBanned(key){const w=workerByKey(key);return (w&&w.banned)||V.some(v=>!v.void&&v.pkey===key&&v.level===3)||A.some(a=>!a.void&&a.pkey===key&&a.out)}
function judge(val,refused,isRetest){if(refused)return '측정거부';
  if(S.alcMode==='site'){if(val<S.alc.detect)return '정상';if(val<S.alc.day)return '오전 작업중지';return '당일 작업중지'}
  if(val>=S.alc.stop)return '작업금지';if(val>=S.alc.retest)return isRetest?'작업금지':'재측정';return '정상'}
const JUDGE_ACT={'정상':'작업 투입','재측정':'10분 후 재측정','작업금지':'당일 작업금지 및 귀가조치','측정거부':'출입통제 및 작업배제','오전 작업중지':'오전 작업 중지 (간단한 숙취)','당일 작업중지':'금일 작업금지, 위험성평가 회의 시 심의 예정'};
const judgeCls=j=>({'정상':'bok','재측정':'bwarn','작업금지':'bbad','측정거부':'bbad','오전 작업중지':'b2','당일 작업중지':'bbad'}[j]||'bgray');
const isAlcBad=a=>!!a.judge&&a.judge!=='정상'&&a.judge!=='재측정';
const f3=v=>(+v).toFixed(3);
function alcCriteria(){const a=S.alc;return S.alcMode==='site'
  ?[`${+a.day}% 미만 : 오전 작업 중지 (간단한 숙취)`,`${+a.day}~0.08%미만 : 당일 작업 중지, 심의`,`${a.outCount}회 적발 시 : 영구퇴출`]
  :[`${f3(a.retest)}% 미만 : 정상 작업`,`${f3(a.retest)}~${f3(a.stop-0.001)}% : 10분 후 재측정`,`${f3(a.stop)}% 이상 : 당일 작업금지 및 귀가조치`,'측정 거부 : 출입통제 및 작업배제']}
/* 이전 음주 적발 횟수 (재측정 묶음은 1회) */
function alcBadCount(key,excludeId){return A.filter(x=>x.pkey===key&&!x.void&&!x.retestOf&&x.id!==excludeId&&isAlcBad(alcFinal(x))).length}
function alcMessage(a){const d=a.at.slice(2,10).split('-');
  return S.alcMsg.replace(/\{업체\}/g,a.company).replace(/\{일시\}/g,`${d[0]}년 ${+d[1]}월 ${+d[2]}일 ${hm(a.at)}`).replace(/\{성명\}/g,a.name).replace(/\{직종\}/g,a.job||'-')
   .replace(/\{수치\}/g,a.refused?'측정 거부':f3(a.value)+'%').replace(/\{조치\}/g,a.action).replace(/\{기준\}/g,alcCriteria().map((c,i)=>`${i+1}. ${c}`).join('\n'))}
async function shareAlcMessage(a){const t=alcMessage(a);
  if(navigator.share){try{await navigator.share({text:t});return}catch(e){if(e.name==='AbortError')return}}
  try{await navigator.clipboard.writeText(t);toast('알림 문구 복사됨 — 카톡 등에 붙여넣기')}catch(e){const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();toast('알림 문구 복사됨')}}
function retestChild(a){return A.find(x=>x.retestOf===a.id&&!x.void)}
function alcFinal(a){let c=a,n;while((n=retestChild(c)))c=n;return c}
