// 현장ON service worker.
// Same-origin files: network first, bypassing the HTTP cache, so a home-screen
// install picks up new versions as soon as it is online; cache is the offline fallback.
// Fonts and photos live in their own caches that survive app updates:
//   fonts  — cache first, never change
//   photos — cache first (immutable), but only the most recent PHOTO_MAX are kept
//            so the phone's storage does not keep growing week after week.
const C='fieldsafety-v26';
const FONTS='fieldsafety-fonts';
const PHOTOS='fieldsafety-photos';
const PHOTO_MAX=250; // ≈ 30MB at ~120KB per photo
const KEEP=[C,FONTS,PHOTOS];
const FILES=['./','index.html','vendor/xlsx.full.min.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES.map(f=>new Request(f,{cache:'reload'})))));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>!KEEP.includes(k)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
const put=(name,req,res)=>{if(res&&(res.ok||res.type==='opaque')){const cp=res.clone();caches.open(name).then(c=>c.put(req,cp))}return res};
let trimming=null;
function trimPhotos(){ // oldest first (cache keys keep insertion order)
  if(trimming)return trimming;
  trimming=caches.open(PHOTOS).then(async c=>{const ks=await c.keys();for(const k of ks.slice(0,Math.max(0,ks.length-PHOTO_MAX)))await c.delete(k)}).finally(()=>{trimming=null});
  return trimming;
}
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  const isFont=/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)||/\.(woff2|ttf)$/.test(url.pathname);
  if(isFont){e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>put(FONTS,req,r))));return}
  if(url.origin!==location.origin)return;
  // API: never cache (sync/login/backups must be live); photos & signatures are immutable → cache first
  if(url.pathname.startsWith('/api/blob/')){
    e.respondWith(caches.open(PHOTOS).then(c=>c.match(req)).then(hit=>hit||fetch(req).then(r=>{put(PHOTOS,req,r);e.waitUntil(trimPhotos());return r})));
    return;
  }
  if(url.pathname.startsWith('/api/'))return;
  e.respondWith(fetch(req.url,{cache:'no-store',credentials:'same-origin'}).then(r=>put(C,req,r)).catch(()=>caches.match(req,{ignoreSearch:true}).then(hit=>hit||caches.match('index.html'))));
});
