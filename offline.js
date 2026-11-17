// The ready badge is shown only after the worker has cached the complete app shell.
export async function setupOffline() {
 const badge=document.getElementById('offline-status');
 let ready=false;
 const show=()=>{
  const disconnected=navigator.onLine===false;
  badge.dataset.offline=String(disconnected);
  badge.textContent=ready?(disconnected?'PLAYING OFFLINE':'OFFLINE READY'):(disconnected?'OFFLINE · APP NOT SAVED YET':'PREPARING OFFLINE PLAY…');
 };
 show();window.addEventListener('online',show);window.addEventListener('offline',show);
 if(!('serviceWorker' in navigator)||!window.isSecureContext){badge.textContent='OFFLINE SAVE UNAVAILABLE';return false;}
 let timeout;
 try {
  const existing=typeof navigator.serviceWorker.getRegistration==='function'?await navigator.serviceWorker.getRegistration('./'):null;
  if(existing?.active&&navigator.onLine===false){ready=true;show();return true;}
  await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
  const activated=navigator.serviceWorker.ready.then(()=>{ready=true;show();});
  await Promise.race([activated,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Offline setup timed out')),30000);})]);
  ready=true;show();return true;
 } catch {
  badge.textContent='OFFLINE SAVE NOT READY · REOPEN ONLINE';return false;
 } finally {clearTimeout(timeout);}
}
if(typeof window!=='undefined')setupOffline();
