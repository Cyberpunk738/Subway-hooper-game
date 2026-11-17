const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ROOT=path.join(__dirname,'..');

function worker({failPath='',timeout=false}={}) {
 const handlers={},buckets=new Map(),state={online:true,claimed:false,skipped:false,failPath};
 const fetch=async request=>{
  if(!state.online)throw new Error('Offline');
  const url=new URL(typeof request==='string'?request:request.url);
  if(url.pathname===state.failPath)return new Response('Missing',{status:404});
  if(state.hang)return new Promise(()=>{});
  const file=path.join(ROOT,url.pathname.replace(/^\/game\//,''));
  return fs.existsSync(file)?new Response(fs.readFileSync(file)):new Response('Missing',{status:404});
 };
 const caches={async open(name){
  if(!buckets.has(name))buckets.set(name,new Map());
  const data=buckets.get(name);
  return {async addAll(requests){for(const request of requests){const response=await fetch(request);if(!response.ok)throw new Error('Precache failed');data.set(request.url,response.clone());}},async match(key){return data.get(typeof key==='string'?key:key.url)?.clone();},async put(key,value){data.set(typeof key==='string'?key:key.url,value.clone());}};
 },async keys(){return [...buckets.keys()]},async delete(key){return buckets.delete(key)}};
 const context=vm.createContext({URL,Request,Response,Set,Promise,caches,fetch,
  setTimeout:timeout?(fn)=>{queueMicrotask(fn);return 1}:setTimeout,clearTimeout:timeout?()=>{}:clearTimeout,
  self:{registration:{scope:'https://example.test/game/'},addEventListener(type,fn){handlers[type]=fn;},async skipWaiting(){state.skipped=true;},clients:{async claim(){state.claimed=true;}}}
 });
 vm.runInContext(fs.readFileSync(path.join(ROOT,'sw.js'),'utf8'),context);
 return {state,buckets,context,async install(){const work=[];handlers.install({waitUntil:p=>work.push(p)});await Promise.all(work);},async activate(){const work=[];handlers.activate({waitUntil:p=>work.push(p)});await Promise.all(work);},async request(relative,options={}){let response;handlers.fetch({request:{url:new URL(relative,'https://example.test/game/').href,method:'GET',mode:'cors',...options},respondWith:p=>{response=p},waitUntil:p=>{p.catch(()=>{})}});return response?await response:null;}};
}

test('complete game shell loads from cache after a connected install, including engine and fonts',async()=>{
 const w=worker();await w.install();await w.activate();w.state.online=false;
 const page=await w.request('./?tracking=1',{mode:'navigate'});
 assert.equal(page.status,200);assert.match(await page.text(),/SUPER HOPPER/);
 const engine=await w.request('./vendor/three.module.min.js');assert.ok((await engine.arrayBuffer()).byteLength>600000);
 const font=await w.request('./fonts/fredoka-latin.woff2');assert.equal(Buffer.from(await font.arrayBuffer()).subarray(0,4).toString(),'wOF2');
 for(const url of vm.runInContext('SHELL',w.context)){const response=await w.request(url);assert.equal(response.status,200,url);}
 assert.equal(w.state.skipped,true);assert.equal(w.state.claimed,true);
});

test('a failed required download prevents the worker declaring its shell ready',async()=>{
 const w=worker({failPath:'/game/fonts/fredoka-latin.woff2'});
 await assert.rejects(w.install(),/Precache failed/);assert.equal(w.state.skipped,false);
});

test('cache activation only removes old Hopper caches',async()=>{
 const w=worker();w.buckets.set('unrelated-app',new Map());w.buckets.set('super-hopper-offline-v0',new Map());
 await w.install();await w.activate();assert.equal(w.buckets.has('unrelated-app'),true);assert.equal(w.buckets.has('super-hopper-offline-v0'),false);
});

test('API requests, other origins and non-GET writes are never cached',async()=>{
 const w=worker();await w.install();
 assert.equal(await w.request('https://project.supabase.co/rest/v1/leaderboard'),null);
 assert.equal(await w.request('./api/leaderboard'),null);
 assert.equal(await w.request('./script.js',{method:'POST'}),null);
});

test('server errors and stalled networks use the saved shell instead of breaking reload',async()=>{
 const w=worker({timeout:true});await w.install();w.state.failPath='/game/index.html';
 assert.equal((await w.request('./',{mode:'navigate'})).status,200);
 w.state.failPath='';w.state.hang=true;
 assert.equal((await w.request('./script.js')).status,200);
});

test('cached startup references are local and install metadata points to valid icons',()=>{
 const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
 assert.doesNotMatch(html,/<(?:script|link)[^>]+(?:src|href)="https?:/);
 assert.match(html,/"three": "\.\/vendor\/three.module.min.js"/);
 const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.webmanifest'),'utf8'));
 for(const icon of manifest.icons)assert.equal(fs.existsSync(path.join(ROOT,icon.src)),true);
});

function offlinePage(serviceWorker,isSecureContext=true) {
 const badge={dataset:{},textContent:''},listeners={};
 const context=vm.createContext({document:{getElementById:()=>badge},navigator:{onLine:true,serviceWorker},window:{isSecureContext,addEventListener:(type,fn)=>{listeners[type]=fn}},setTimeout,clearTimeout});
 let source=fs.readFileSync(path.join(ROOT,'offline.js'),'utf8').replace(/^export /gm,'').replace(/if\(typeof window[^\n]+/,'');
 vm.runInContext(source,context);return {badge,listeners,run:code=>vm.runInContext(code,context)};
}

test('ready badge waits for activation, then responds correctly to loss of network',async()=>{
 let activate;const ready=new Promise(resolve=>{activate=resolve});
 const page=offlinePage({register:async()=>({}),ready});const setup=page.run('setupOffline()');
 assert.match(page.badge.textContent,/PREPARING/);activate({});assert.equal(await setup,true);assert.equal(page.badge.textContent,'OFFLINE READY');
 page.run('navigator.onLine=false');page.listeners.offline();assert.equal(page.badge.textContent,'PLAYING OFFLINE');
});

test('failed registration never claims offline readiness',async()=>{
 const page=offlinePage({register:async()=>{throw new Error('Denied')}});
 assert.equal(await page.run('setupOffline()'),false);assert.match(page.badge.textContent,/NOT READY/);
});

test('an already installed offline game does not depend on re-registering over the network',async()=>{
 let registered=false;
 const page=offlinePage({getRegistration:async()=>({active:{}}),register:async()=>{registered=true;throw new Error('Offline')}});
 page.run('navigator.onLine=false');assert.equal(await page.run('setupOffline()'),true);
 assert.equal(registered,false);assert.equal(page.badge.textContent,'PLAYING OFFLINE');
});
