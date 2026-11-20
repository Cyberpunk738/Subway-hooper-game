// Bump the shell version when changing the offline asset list. Online visits
// refresh cached files too, so future app fixes do not get stuck behind a cache.
const CACHE_NAME='super-hopper-offline-v3';
const ROOT=new URL('./',self.registration.scope);
const INDEX=new URL('./index.html',ROOT).href;
const SHELL=[
 './index.html','./style.css','./script.js','./game-art.js','./progression.js','./player-meta.js','./runner-rules.js','./chase.js','./character-details.js','./save-data.js','./audio.js','./controls.js',
 './supabase.js','./config.js','./offline.js','./manifest.webmanifest',
 './vendor/three.module.min.js','./vendor/supabase.min.js',
 './fonts/fredoka-latin.woff2','./fonts/space-grotesk-latin.woff2',
 './icons/icon-192.png','./icons/icon-512.png',
 './vendor/THREE-LICENSE.txt','./vendor/SUPABASE-LICENSE.txt',
 './fonts/FREDOKA-OFL.txt','./fonts/SPACE-GROTESK-OFL.txt'
].map(path=>new URL(path,ROOT).href);
const ALLOWED=new Set(SHELL);
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);
  await cache.addAll(SHELL.map(url=>new Request(url,{cache:'reload'})));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('super-hopper-offline-')&&key!==CACHE_NAME).map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==ROOT.origin)return;
 url.search='';url.hash='';
 const navigation=request.mode==='navigate'&&(url.href===ROOT.href||url.href===INDEX);
 const key=navigation?INDEX:url.href;
 if(!navigation&&!ALLOWED.has(key))return; // Never cache leaderboard/API responses.
 const network=fetch(request).then(async response=>{
  if(response.ok){try{const cache=await caches.open(CACHE_NAME);await cache.put(key,response.clone());}catch{/* an existing offline copy still works if storage is full */}}
  return response;
 });
 event.waitUntil(network.then(()=>{}).catch(()=>{}));
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE_NAME),saved=await cache.match(key);
  if(!saved){try{return await network;}catch{return Response.error();}}
  let timer;
  try {
   const response=await Promise.race([network,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Network timeout')),2500);})]);
   return response.ok?response:saved;
  }catch{return saved;}
  finally{clearTimeout(timer);}
 })());
});
