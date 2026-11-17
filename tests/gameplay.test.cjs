const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function game(storage = new Map()) {
 const elements = new Map();
 function element(id) {
  if (!elements.has(id)) elements.set(id, {
   value:'', textContent:'', listeners:{},
   focus(){this.focused=true;}, select(){this.selected=true;}, setSelectionRange(a,b){this.selection=[a,b];},
   classList:{hidden:true,add(name){if(name==="hidden")this.hidden=true;},remove(name){if(name==="hidden")this.hidden=false;},toggle(){},contains(name){return name==="hidden" && this.hidden;}},
   addEventListener(type, fn){this.listeners[type]=fn;},
   setPointerCapture(){}, closest(){return null;}
  });
  return elements.get(id);
 }
 const context = vm.createContext({console, Math, Date, Number, String, Set, URL, Blob, File,
  document:{getElementById:element,body:{classList:{add(){},remove(){}}}},
  window:{location:{href:"https://hopper.example/play/?tracking=1#run"}}, navigator:{maxTouchPoints:0},
  localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
  performance:{now:()=>100}, requestAnimationFrame(){}, setTimeout(){}, clearTimeout(){},setInterval(){},clearInterval(){},
 });
 let source = fs.readFileSync(require('node:path').join(__dirname,'../script.js'),'utf8');
 const art = fs.readFileSync(require('node:path').join(__dirname,'../game-art.js'),'utf8').replace(/^export /gm,'');
 vm.runInContext(art, context);
 source = source.replace(/import \{ CHARACTERS, portraitSVG, renderScoreCard \} from "\.\/game-art.js";/,'').replace(/import \* as THREE from "three";/,'').replace(/import \{[\s\S]*?\} from "\.\/supabase.js";/,'').replace(/init\(\);\s*$/,'');
 vm.runInContext(source, context);
 return {run:code=>vm.runInContext(code,context),element,storage};
}

test('14px swipe switches lane during movement, once per gesture; cancel never jumps',()=>{
 const g=game();g.run('state.isPlaying=true; initTouchControls();');
 const events=g.element('game-container').listeners;
 const down={pointerId:1,isPrimary:true,clientX:100,clientY:100};
 events.pointerdown(down);
 events.pointermove({...down,clientX:113});assert.equal(g.run('state.lane'),0);
 events.pointermove({...down,clientX:115});assert.equal(g.run('state.lane'),1);
 events.pointermove({...down,clientX:40});assert.equal(g.run('state.lane'),1);
 events.pointerup(down);assert.equal(g.run('jumpBuffer'),0);
 events.pointerdown(down);events.pointercancel();events.pointerup(down);
 assert.equal(g.run('jumpBuffer'),0);
 events.pointerdown(down);events.pointerup(down);assert.equal(g.run('jumpBuffer'),8);
});

test('lane boundaries, paused inputs and jump requests are respected',()=>{
 const g=game();g.run('state.isPlaying=true; moveLane(-1); moveLane(-1);');
 assert.equal(g.run('state.lane'),-1);
 g.run('paused=true; moveLane(1); requestJump();');
 assert.equal(g.run('state.lane'),-1);assert.equal(g.run('jumpBuffer'),0);
});

test('sensitivity selection is persisted',()=>{
 const g=game();g.run('document.addEventListener=()=>{}; window.addEventListener=()=>{}; initRunSettings();');
 g.element('sensitivity').value='10';g.element('sensitivity').listeners.change();
 assert.equal(g.run('swipeThreshold'),10);assert.equal(g.storage.get('hopper_sensitivity'),'10');
});

test('simulation advances equally at 30, 60 and 120Hz; pause freezes updates',()=>{
 function simulate(hz){
  const g=game();g.run('let ticks=0; updateGame=()=>{ticks++}; renderer={render(){}}; state.isPlaying=true;');
  for(let i=1;i<=hz;i++)g.run(`animate(${i*1000/hz})`);
  return g;
 }
 const counts=[30,60,120].map(hz=>simulate(hz).run('ticks'));
 assert.ok(Math.max(...counts)-Math.min(...counts)<=1,counts.join(','));
 const g=simulate(60);const ticks=g.run('ticks');g.run('paused=true; animate(1050);');
 assert.equal(g.run('ticks'),ticks);
});

test('frame stalls have bounded catch-up and rapid restarts keep one loop',()=>{
 const g=game();g.run('let queued=0; requestAnimationFrame=()=>queued++; ensureLoop(); ensureLoop();');
 assert.equal(g.run('queued'),1);
 g.run('let ticks=0; updateGame=()=>ticks++; renderer={render(){}}; state.isPlaying=true; animate(5000);');
 assert.ok(g.run('ticks')<=6);
});

test('pause clears queued actions and resumes without elapsed-time catch-up',()=>{
 const g=game();g.run('state.isPlaying=true; isMuted=true; jumpBuffer=8; gesture={}; togglePause(true);');
 assert.equal(g.run('paused'),true);assert.equal(g.run('jumpBuffer'),0);assert.equal(g.run('gesture'),null);
 g.run('togglePause(false)');assert.equal(g.run('paused'),false);assert.equal(g.run('accumulator'),0);
});

test('keyboard shortcuts cannot start a run behind a modal',()=>{
 const g=game();g.run('let starts=0; startGame=()=>starts++;');
 g.element('username-modal').classList.contains=()=>false;
 g.run('handleInput({target:{closest(){return null;}},code:"Enter",preventDefault(){}})');
 assert.equal(g.run('starts'),0);
});

test('actual simulation moves lanes quickly, lands jumps and caps difficulty',()=>{
 const g=game();
 g.run(`
  state.isPlaying=true;
  player={position:{x:0,y:0,z:0},rotation:{x:0,z:0}};
  updatePowerupTimers=magnetPull=updateCombo=checkMilestones=checkThemeTransition=spawnDustTrail=spawnRow=updateParticles=sfxJump=()=>{};
  moveLane(1); requestJump();
  for(let i=0;i<6;i++)updateGame();
 `);
 assert.ok(g.run('player.position.x')>2.2,'lane shift should cover 90% within about 100ms');
 assert.ok(g.run('state.playerY')>0,'jump must lift the player');
 g.run('for(let i=0;i<60;i++)updateGame();');
 assert.equal(g.run('state.isJumping'),false);
 g.run('for(let i=0;i<10000;i++)updateGame();');
 assert.equal(g.run('state.speed'),0.52);
});

test('new character feet collide on the ground and clear one-unit obstacles when jumping',()=>{
 for (const [height,expectedHits] of [[0,1],[1.5,0]]) {
  const g=game();
  g.run(`
   let hits=0;
   gameOver=()=>{hits++; state.isPlaying=false;};
   state.isPlaying=true; state.isJumping=true; state.playerY=${height};
   player={position:{x:0,y:0,z:0},rotation:{x:0,z:0}};
   worldObjects=[{type:'obstacle',mesh:{position:{x:0,y:0.5,z:-0.4}}}];
   updateGame();
  `);
  assert.equal(g.run('hits'),expectedHits);
 }
});

test('unsupported native sharing opens a visible fallback with correct score and current URL',async()=>{
 const g=game();g.run('state.score=1234.8; state.coins=17; currentUsername="Afeez";');
 await g.run('shareScore()');
 assert.equal(g.element('share-overlay').classList.contains('hidden'),false);
 assert.match(g.element('share-text').value,/Afeez scored 1234 points and collected 17 coins/);
 assert.ok(g.element('share-text').value.endsWith('https://hopper.example/play/'));
 assert.equal(new URL(g.element('share-whatsapp').href).searchParams.get('text'),g.element('share-text').value);
 assert.equal(g.element('close-share-btn').focused,true);
});

function mockPNG(g, supported = true) {
 g.run(`renderScoreCard=async()=>new Blob(['png'],{type:'image/png'}); navigator.canShare=()=>${supported};`);
}

test('image sharing sends a prepared PNG File on the second user gesture',async()=>{
 const g=game();mockPNG(g);
 g.run('let shared; navigator.share=async data=>{shared=data}; state.score=4096;');
 await g.run('shareScore()');
 assert.equal(g.element('share-image-btn').disabled,false);
 assert.equal(g.element('download-score-btn').download,'super-hopper-4096.png');
 assert.equal(g.run('shared'),undefined,'no native sheet before the user chooses Share Image');
 await g.run('shareScoreImage()');
 assert.equal(g.run('shared.files[0].type'),'image/png');
 assert.equal(g.run('shared.files[0].name'),'super-hopper-4096.png');
 assert.equal(g.run('shareInProgress'),false);
});

test('cancelling file sharing keeps the preview; a denied sheet preserves download',async()=>{
 const g=game();mockPNG(g);g.run('navigator.share=async()=>{throw {name:"AbortError"}};');
 await g.run('shareScore()');await g.run('shareScoreImage()');
 assert.equal(g.element('share-overlay').classList.contains('hidden'),false);
 assert.equal(g.run('shareInProgress'),false);
 g.run('navigator.share=async()=>{throw {name:"NotAllowedError"}};');
 await g.run('shareScoreImage()');
 assert.equal(g.element('download-score-btn').classList.contains('hidden'),false);
 assert.match(g.element('share-status').textContent,/Download/);
});

test('repeated taps cannot open concurrent native file share requests',async()=>{
 const g=game();mockPNG(g);
 g.run('let shares=0, finish; navigator.share=()=>{shares++;return new Promise(resolve=>{finish=resolve})};');
 await g.run('shareScore()');
 const pending=g.run('shareScoreImage()');await g.run('shareScoreImage()');
 assert.equal(g.run('shares'),1);g.run('finish()');await pending;
 assert.equal(g.run('shareInProgress'),false);
});

test('file sharing unsupported still provides a PNG download',async()=>{
 const g=game();mockPNG(g,false);await g.run('shareScore()');
 assert.equal(g.element('share-image-btn').disabled,true);
 assert.equal(g.element('download-score-btn').classList.contains('hidden'),false);
 assert.match(g.element('download-score-btn').href,/^blob:/);
});

test('failed image export leaves text fallback and never offers a broken download',async()=>{
 const g=game();g.run('renderScoreCard=async()=>{throw new Error("Canvas unavailable")};');
 await g.run('shareScore()');
 assert.equal(g.element('download-score-btn').classList.contains('hidden'),true);
 assert.equal(g.element('share-image-btn').disabled,true);
 assert.match(g.element('share-status').textContent,/could not be created/);
 assert.match(g.element('share-text').value,/points/);
});

test('closing during image generation prevents a stale preview appearing',async()=>{
 const g=game();g.run('let finishPNG; renderScoreCard=()=>new Promise(resolve=>{finishPNG=resolve});');
 const pending=g.run('shareScore()');g.run('closeScoreShareDialog();finishPNG(new Blob(["png"],{type:"image/png"}));');
 await pending;
 assert.equal(g.run('scoreCard'),null);
 assert.equal(g.element('share-overlay').classList.contains('hidden'),true);
});

test('copy feedback reports success only when clipboard write succeeds',async()=>{
 const g=game();await g.run('shareScore()');
 g.run('let copied; navigator.clipboard={writeText:async text=>{copied=text}};');
 await g.run('copyScore()');
 assert.equal(g.run('copied'),g.element('share-text').value);
 assert.match(g.element('share-status').textContent,/Score copied!/);
});

test('denied clipboard access leaves selectable text instead of a blocked popup',async()=>{
 const g=game();await g.run('shareScore()');
 g.run('navigator.clipboard={writeText:async()=>{throw new Error("Denied")}}; document.execCommand=()=>false;');
 await g.run('copyScore()');
 assert.equal(g.element('share-text').selected,true);
 assert.deepEqual(g.element('share-text').selection,[0,g.element('share-text').value.length]);
 assert.match(g.element('share-status').textContent,/Long-press/);
 g.run('navigator.clipboard=undefined; document.execCommand=()=>true;');
 await g.run('copyScore()');
 assert.match(g.element('share-status').textContent,/Score copied!/);
});

test('share dialog blocks background start shortcuts',()=>{
 const g=game();g.run('let starts=0; startGame=()=>starts++; openScoreShareDialog();');
 g.run('handleInput({target:{closest(){return null;}},code:"Space",preventDefault(){}})');
 assert.equal(g.run('starts'),0);
 g.run('closeScoreShareDialog()');
 assert.equal(g.element('share-overlay').classList.contains('hidden'),true);
});


test('legacy coins and unlocked skins migrate without charging existing owners',()=>{
 const storage=new Map([['subway_hopper_bank','175'],['subway_hopper_skins','["default","blue"]'],['subway_hopper_skin_sel','blue']]);
 const g=game(storage);
 assert.equal(g.run('getCoinBank()'),175);assert.equal(g.run('getSelectedSkin()'),'blue');
 const result=g.run('buyOrEquipCharacter("blue")');assert.equal(result.ok,true);
 assert.equal(g.run('getCoinBank()'),175);
 const reload=game(storage);assert.equal(reload.run('getSelectedSkin()'),'blue');
});

test('buying debits exactly once, equips the character and survives reload',()=>{
 const storage=new Map();const g=game(storage);g.run('saveCoinBank(150);');
 assert.equal(g.run('buyOrEquipCharacter("gold").ok'),true);
 assert.equal(g.run('getCoinBank()'),50);assert.equal(g.run('getSelectedSkin()'),'gold');
 assert.equal(g.run('getUnlockedSkins().includes("gold")'),true);
 g.run('buyOrEquipCharacter("gold")');assert.equal(g.run('getCoinBank()'),50);
 const reload=game(storage);assert.equal(reload.run('getCoinBank()'),50);
 assert.equal(reload.run('getSelectedSkin()'),'gold');
});

test('insufficient coins and invalid characters cannot change the wallet',()=>{
 const g=game();g.run('saveCoinBank(49);');
 assert.equal(g.run('buyOrEquipCharacter("blue").ok'),false);
 assert.equal(g.run('buyOrEquipCharacter("fake").ok'),false);
 assert.equal(g.run('getCoinBank()'),49);assert.equal(g.run('getSelectedSkin()'),'default');
 assert.equal(g.run('getUnlockedSkins().length'),1);
});

test('denied purchase storage never partially spends coins or grants ownership',()=>{
 const storage=new Map();const g=game(storage);g.run('saveCoinBank(500);');
 g.run('localStorage.setItem=()=>{throw new Error("Quota exceeded")};');
 assert.equal(g.run('buyOrEquipCharacter("ruby").ok'),false);
 const reload=game(storage);assert.equal(reload.run('getCoinBank()'),500);
 assert.equal(reload.run('getUnlockedSkins().includes("ruby")'),false);
});

test('corrupt ownership data cannot equip unowned or unknown characters',()=>{
 const g=game(new Map([['subway_hopper_character_wallet_v1','{"bank":-10,"owned":["fake"],"selected":"cosmic"}']]));
 assert.equal(g.run('getCoinBank()'),0);assert.equal(g.run('getSelectedSkin()'),'default');
 g.run('saveSelectedSkin("cosmic")');assert.equal(g.run('getSelectedSkin()'),'default');
});
