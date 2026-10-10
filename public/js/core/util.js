// 현장ON — helpers: DOM, escaping, dates, toast
'use strict';
/* ---------- helpers ---------- */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const h=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nl=s=>h(s).replace(/\n/g,'<br>');
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const norm=s=>String(s??'').toLowerCase().replace(/[\s\n\r()（）\-_.·]/g,'');
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today=()=>ymd(new Date());
const nowLocal=()=>{const d=new Date();return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`};
const fmtDT=s=>s?s.replace('T',' '):'';
const hm=s=>s?s.slice(11,16):'';
const WD='일월화수목금토';
const dayLabel=ds=>{const d=new Date(ds+'T00:00');return `${pad(d.getMonth()+1)}/${pad(d.getDate())}(${WD[d.getDay()]})`};
const addDays=(ds,n)=>{const d=new Date(ds+'T00:00');d.setDate(d.getDate()+n);return ymd(d)};
/* 주 단위 (월~토) */
const weekMon=ds=>{const d=new Date(ds+'T00:00');return addDays(ds,-((d.getDay()+6)%7))};
function weekLabel(mon){const d=new Date(mon+'T00:00');const first=new Date(d.getFullYear(),d.getMonth(),1);const off=(first.getDay()+6)%7;
  return `${String(d.getFullYear()).slice(2)}년 ${d.getMonth()+1}월 ${Math.ceil((d.getDate()+off)/7)}주차`}
const md=ds=>`${+ds.slice(5,7)}/${+ds.slice(8,10)}`;
const weekDays=mon=>[0,1,2,3,4,5].map(i=>addDays(mon,i));
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('on'),2200)}
function parseDate(s){
  s=String(s??'').trim();if(!s)return null;let m;
  if((m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/))){let y=+m[3];if(y<100)y+=2000;return new Date(y,m[1]-1,+m[2])}
  if((m=s.match(/(\d{2,4})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})/))){let y=+m[1];if(y<100)y+=2000;return new Date(y,m[2]-1,+m[3])}
  return null;
}
function expState(s){const d=parseDate(s);if(!d)return '';const diff=(d-new Date(today()+'T00:00'))/864e5;if(diff<0)return 'bad';if(diff<=30)return 'warn';return 'ok'}
function expCell(s){const st=expState(s);if(!s)return '';return `<span class="${st==='bad'?'exp-bad':st==='warn'?'exp-warn':''}">${h(s)}${st==='bad'?' (만료)':st==='warn'?' (임박)':''}</span>`}
