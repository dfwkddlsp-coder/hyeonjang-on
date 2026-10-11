// 현장ON — haptics (button taps, bottom bar dial ticks) and the bottom bar dial look
'use strict';
/* ---------- 햅틱: 기기마다 켜기/끄기 (설정 → 내 정보) ---------- */
const HAPTIC_KEY='hjHaptic';
function hapticOn(){try{return localStorage.getItem(HAPTIC_KEY)!=='0'}catch(e){return true}}
function setHaptic(on){try{localStorage.setItem(HAPTIC_KEY,on?'1':'0')}catch(e){}}
const HAPTIC={tick:5,tap:9,press:16,snap:12,warn:[12,60,18]};
/* 아이폰 사파리는 vibrate가 없음 → iOS 18+ 스위치 체크박스를 누를 때의 시스템 햅틱을 빌려 씀 (탭에서만 동작) */
const CAN_VIBRATE=typeof navigator.vibrate==='function';
let iosSw=null;
function iosHaptic(){
  if(!iosSw){iosSw=document.createElement('label');iosSw.setAttribute('aria-hidden','true');
    iosSw.style.cssText='position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    iosSw.innerHTML='<input type="checkbox" switch tabindex="-1">';document.body.appendChild(iosSw)}
  iosSw.click()}
function haptic(kind){if(!hapticOn())return;try{if(CAN_VIBRATE)navigator.vibrate(HAPTIC[kind]||HAPTIC.tap);else if(kind!=='tick'&&kind!=='snap')iosHaptic()}catch(e){}}
/* 누르는 모든 것: 버튼·메뉴·탭·체크박스·목록 줄. 삭제(빨간 버튼)는 두 번, 주 버튼은 조금 길게 */
const TAP_SEL='button,.btn,a[href],[data-v],[data-seg],input[type=checkbox],input[type=radio],select,.list .it,[role=button]';
document.addEventListener('click',e=>{
  if(!e.isTrusted)return; // iosHaptic의 가짜 클릭은 다시 울리지 않음
  const el=e.target.closest&&e.target.closest(TAP_SEL);if(!el||el.disabled)return;
  haptic(el.matches('.btn.bad')?'warn':el.matches('.btn:not(.line):not(.ghost):not(.sm)')?'press':'tap')},true);

/* ---------- 하단바 다이얼 (폰): 가운데는 크게, 끝으로 갈수록 기울고 작게 · 한 칸 넘어갈 때마다 틱 ---------- */
const DIAL_MQ=matchMedia('(max-width:760px)'),CALM_MQ=matchMedia('(prefers-reduced-motion: reduce)');
let dialIdx=-1,dialTouch=0,dialEnd=0,dialRaf=0;
function navDialLook(){const n=$('#nav');if(!n)return;const bs=$$('button',n);
  const on=DIAL_MQ.matches&&!CALM_MQ.matches&&n.scrollWidth-n.clientWidth>4;
  if(!on){bs.forEach(b=>{b.style.transform=b.style.opacity=''});return}
  const r=n.getBoundingClientRect(),mid=r.left+r.width/2,half=r.width/2;
  for(const b of bs){const br=b.getBoundingClientRect(),d=Math.max(-1,Math.min(1,(br.left+br.width/2-mid)/half));
    b.style.transform=`perspective(260px) rotateY(${(-d*26).toFixed(1)}deg) scale(${(1-.1*d*d).toFixed(3)})`;
    b.style.opacity=(1-.3*d*d).toFixed(2)}}
function navDial(){const n=$('#nav');if(!n)return;
  cancelAnimationFrame(dialRaf);dialRaf=requestAnimationFrame(navDialLook);
  if(!DIAL_MQ.matches||Date.now()-dialTouch>1200)return; // 손으로 민 때만 (메뉴 이동 시 자동 스크롤은 조용히)
  const b=$('button',n),w=b?b.offsetWidth:0;if(!w)return;
  const i=Math.round(n.scrollLeft/w);if(dialIdx<0)dialIdx=i;
  if(i!==dialIdx){dialIdx=i;haptic('tick')}
  clearTimeout(dialEnd);dialEnd=setTimeout(()=>{if(Date.now()-dialTouch<1500)haptic('snap');dialTouch=0},140)}
function navDialBind(n){
  const touch=()=>{dialTouch=Date.now();const b=$('button',n);dialIdx=b&&b.offsetWidth?Math.round(n.scrollLeft/b.offsetWidth):-1};
  n.addEventListener('touchstart',touch,{passive:true});n.addEventListener('touchmove',()=>{dialTouch=Date.now()},{passive:true});
  n.addEventListener('pointerdown',touch,{passive:true});n.addEventListener('wheel',()=>{dialTouch=Date.now()},{passive:true})}
addEventListener('resize',()=>requestAnimationFrame(navDialLook));
