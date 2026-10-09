// 현장ON service worker.
// Same-origin files: network first, bypassing the HTTP cache, so a home-screen
// install picks up new versions as soon as it is online; cache is the offline fallback.
// Fonts (Google, vendored woff2): cache first — they never change.
const C='fieldsafety-v24';
const FILES=['./','index.html','vendor/xlsx.full.min.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES.map(f=>new Request(f,{cache:'reload'})))));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
const put=(req,res)=>{if(res&&(res.ok||res.type==='opaque')){const cp=res.clone();caches.open(C).then(c=>c.put(req,cp))}return res};
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;
  const url=new URL(req.url);
  const isFont=/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)||/\.(woff2|ttf)$/.test(url.pathname);
  if(isFont){e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>put(req,r))));return}
  if(url.origin!==location.origin)return;
  // API: never cache (sync/login must be live); photos & signatures are immutable → cache first
  if(url.pathname.startsWith('/api/blob/')){e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>put(req,r))));return}
  if(url.pathname.startsWith('/api/'))return;
  e.respondWith(fetch(req.url,{cache:'no-store',credentials:'same-origin'}).then(r=>put(req,r)).catch(()=>caches.match(req,{ignoreSearch:true}).then(hit=>hit||caches.match('index.html'))));
});
