// 현장ON — app version, bottom nav, view router (go), view registry R
'use strict';
/* ---------- views ---------- */
const APP_VER='2026.10.10-8';
const VIEWS=[['home','홈'],['strike','삼진아웃'],['alcohol','음주측정'],['reg','관리대장'],['settings','설정']];
/* 하위 화면 → 하단 탭 묶음 */
const NAVOF={plans:'home',workers:'reg',equip:'reg',eqcheck:'reg',vuln:'reg',records:'settings'};
const REG_TABS=[['workers','근로자'],['equip','장비'],['eqcheck','장비점검'],['vuln','취약근로자']];
let lastReg='workers';
let cur='home';
const DRIVER_VIEWS=['eqcheck','settings'];
function go(v,arg,fromPop){if(isDriver()&&!DRIVER_VIEWS.includes(v))v='eqcheck';if(v==='reg')v=lastReg;if(NAVOF[v]==='reg')lastReg=v;if(!fromPop&&(v!==cur||arg!==undefined)){history.pushState({hj:'v',v},'');NAV.stale=false}cur=v;document.body.classList.toggle('is-home',v==='home');$$('#nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===(isDriver()?v:(NAVOF[v]||v))));window.scrollTo(0,0);R[v](arg);try{sessionStorage.setItem('v',v)}catch(e){}}
function renderNav(){$('#nav').innerHTML=(isDriver()?[['eqcheck','장비점검'],['settings','내 정보']]:VIEWS).map(([v,t])=>`<button data-v="${v}"><span class="ni"><i class="i i-${v}"></i></span>${t}</button>`).join('');$$('#nav button').forEach(b=>b.onclick=()=>go(b.dataset.v))}
const R={};
const V$=()=>$('#view');
