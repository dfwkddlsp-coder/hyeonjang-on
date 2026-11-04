// 현장ON — 앱 안 카메라 (안드로이드): "촬영" 칸을 누르면 휴대폰 카메라 앱 대신 이 화면에서 찍음
'use strict';
/* 안드로이드(특히 삼성 인터넷)는 카메라 앱으로 넘어간 사이 메모리가 모자라면 브라우저를 꺼 버림
   → 돌아오면 "메모리가 부족하여 이전 작업을 완료할 수 없습니다"와 함께 사진이 사라짐. 앱 안에서 찍으면 브라우저를 떠나지 않음.
   모든 카메라 칸(input[capture])을 한 곳에서 가로챔: 찍은 사진을 그 칸에 넣고 change를 보내서 각 화면 코드는 그대로.
   카메라를 못 쓰면(권한 거부·지원 안 함) 원래대로 카메라 앱을 엶. PC·아이폰은 원래대로 */
/* 시험 스위치: 주소에 ?camtest=1 → 이 기기(아이폰·PC 포함)에서도 앱 안 카메라, ?camtest=0 → 끔 (기기에 기억) */
const CAM_TEST=(()=>{try{const q=new URLSearchParams(location.search).get('camtest');if(q!=null)localStorage.setItem('camtest',q);return localStorage.getItem('camtest')==='1'}catch(e){return false}})();
const CAM_INAPP=(CAM_TEST||/Android/i.test(navigator.userAgent))&&!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)&&typeof DataTransfer==='function';
let camNative=false,camPop=null; // 이번 한 번은 카메라 앱으로 (화면의 "카메라 앱으로 찍기" 또는 앱 안 카메라 실패)
document.addEventListener('click',ev=>{
  const inp=ev.target;
  if(!CAM_INAPP||!(inp instanceof HTMLInputElement)||inp.type!=='file'||!inp.hasAttribute('capture'))return;
  if(camNative){camNative=false;return}
  ev.preventDefault();
  camShot().then(f=>{
    if(f==='native'){camNative=true;inp.click();return}
    if(!f)return;
    const dt=new DataTransfer();dt.items.add(f);inp.files=dt.files;inp.dispatchEvent(new Event('change',{bubbles:true}));
  });
},true);

addEventListener('popstate',e=>{if(camPop){e.stopImmediatePropagation();camPop()}});

/* 전체 화면 카메라. 결과: 찍은 File, 취소 null, 카메라 앱으로 'native' */
function camShot(){return new Promise(async done=>{
  let stream;
  try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1440}},audio:false})}
  catch(e){toast(e&&e.name==='NotAllowedError'?'카메라 권한이 없어 카메라 앱으로 엽니다':'카메라 앱으로 엽니다');return done('native')}
  const ov=document.createElement('div');ov.className='cam';
  ov.innerHTML=`<video playsinline autoplay muted></video>
    <div class="cam-bar"><button type="button" class="cam-x" aria-label="닫기">✕</button>
    <button type="button" class="cam-shot" aria-label="찍기"></button>
    <button type="button" class="cam-nat">카메라 앱으로<br>찍기</button></div>`;
  document.body.appendChild(ov);
  const v=ov.querySelector('video');v.srcObject=stream;
  /* 휴대폰 뒤로 가기 = 카메라만 닫기. 카메라 칸 자리를 history에 하나 넣고, 닫을 때 그 자리를 되돌림.
     이 파일은 ui.js보다 먼저 읽혀서 popstate를 먼저 받고, 아래 작성 창(모달)까지 닫히지 않게 막음 */
  let res=null;
  const end=()=>{stream.getTracks().forEach(t=>t.stop());ov.remove();camPop=null;done(res)};
  camPop=end;history.pushState(Object.assign({},history.state,{cam:1}),'');
  const close=r=>{res=r;history.back()};
  ov.querySelector('.cam-x').onclick=()=>close(null);
  ov.querySelector('.cam-nat').onclick=()=>close('native');
  const shot=ov.querySelector('.cam-shot');
  shot.onclick=()=>{if(!v.videoWidth)return;shot.disabled=true;
    const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);
    c.toBlob(b=>{if(!b){shot.disabled=false;return toast('사진을 만들지 못했습니다')}
      if(navigator.vibrate)navigator.vibrate(30);
      close(new File([b],'photo-'+Date.now()+'.jpg',{type:'image/jpeg'}))},'image/jpeg',.9)};
})}
