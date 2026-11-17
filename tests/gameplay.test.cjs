const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function game(storage = new Map()) {
 const elements = new Map();
 function element(id) {
  if (!elements.has(id)) elements.set(id, {
   value:'', textContent:'', listeners:{}, attributes:{},scrollTop:0,
   setAttribute(name,value){this.attributes[name]=value;},querySelectorAll(){return [];},
   focus(){this.focused=true;}, select(){this.selected=true;}, setSelectionRange(a,b){this.selection=[a,b];},
   classList:{hidden:true,add(name){if(name==="hidden")this.hidden=true;},remove(name){if(name==="hidden")this.hidden=false;},toggle(name,force){if(name==="hidden")this.hidden=force===undefined?!this.hidden:force;},contains(name){return name==="hidden" && this.hidden;}},
   addEventListener(type, fn){this.listeners[type]=fn;},
   setPointerCapture(){}, closest(){return null;}
  });
  return elements.get(id);
 }
 const context = vm.createContext({console, Math, Date, Number, String, Set, URL, Blob, File,
  document:{getElementById:element,querySelectorAll(){return [];},body:{classList:{add(){},remove(){}}}},
  window:{location:{href:"https://hopper.example/play/?tracking=1#run"}}, navigator:{maxTouchPoints:0},
  localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
  performance:{now:()=>100}, requestAnimationFrame(){},cancelAnimationFrame(){}, setTimeout(){}, clearTimeout(){},setInterval(){},clearInterval(){},
 });
 let source = fs.readFileSync(require('node:path').join(__dirname,'../script.js'),'utf8');
 const progression=fs.readFileSync(require('node:path').join(__dirname,'../progression.js'),'utf8').replace(/^export /gm,'');
 vm.runInContext(progression,context);
 const art = fs.readFileSync(require('node:path').join(__dirname,'../game-art.js'),'utf8').replace(/^export /gm,'');
 vm.runInContext(art, context);
 source = source.replace(/import \{[^\n]+\} from "\.\/progression.js";/,'').replace(/import \{ CHARACTERS, portraitSVG, renderScoreCard \} from "\.\/game-art.js";/,'').replace(/import \* as THREE from "three";/,'').replace(/import \{[\s\S]*?\} from "\.\/supabase.js";/,'').replace(/init\(\);\s*$/,'');
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
   let hits=0; state.rescueUsed=true;
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

test('completed missions pay once and persist across reloads',()=>{
 const storage=new Map(),g=game(storage);
 g.run('const mission=missionsForDay()[0]; advanceMissions(mission.metric,mission.target);');
 const reward=g.run('mission.reward');
 assert.equal(g.run('claimMission(mission.id)'),true);assert.equal(g.run('getCoinBank()'),reward);
 assert.equal(g.run('claimMission(mission.id)'),false);
 const reload=game(storage);assert.equal(reload.run('claimMission(missionsForDay()[0].id)'),false);assert.equal(reload.run('getCoinBank()'),reward);
});

test('incomplete, stale-day and failed mission claims never pay coins',()=>{
 const g=game();assert.equal(g.run('claimMission(missionsForDay()[0].id)'),false);
 g.run('const mission=missionsForDay()[0];advanceMissions(mission.metric,mission.target);');
 assert.equal(g.run('claimMission(mission.id,"2000-01-01")'),false);
 g.run('localStorage.setItem=()=>{throw new Error("Denied")};');
 assert.equal(g.run('claimMission(mission.id)'),false);assert.equal(g.run('getCoinBank()'),0);
});

test('board purchases preserve character ownership, mission progress and remaining coins',()=>{
 const g=game();g.run('saveCoinBank(500);buyOrEquipCharacter("blue");advanceMissions("coins",7);');
 assert.equal(g.run('buyOrEquipBoard("neon")'),true);assert.equal(g.run('getCoinBank()'),300);
 assert.equal(g.run('getSelectedSkin()'),'blue');assert.equal(g.run('readWallet().daily.metrics.coins'),7);
 assert.equal(g.run('readWallet().board'),'neon');g.run('buyOrEquipBoard("neon")');assert.equal(g.run('getCoinBank()'),300);
});

test('near miss chains award escalating bonuses and expire in simulation time',()=>{
 const g=game();g.element('near-miss-flash').style={};
 g.run('registerNearMiss();registerNearMiss();');assert.equal(g.run('state.score'),75);
 assert.equal(g.run('state.dangerChain'),2);
 g.run('for(let i=0;i<300;i++)updateRunFeatures();');assert.equal(g.run('state.dangerChain'),0);
});

test('rescue charges exactly once, holds the world during countdown and grants protection',()=>{
 const g=game();g.run('saveCoinBank(50);state.isPlaying=true;requestRescue();');
 assert.equal(g.run('rescuePending'),true);assert.equal(g.run('paused'),true);
 assert.equal(g.run('rescueRun()'),true);assert.equal(g.run('getCoinBank()'),20);
 assert.equal(g.run('rescueRun()'),false);assert.equal(g.run('getCoinBank()'),20);
 const score=g.run('state.score');g.run('for(let i=0;i<179;i++)updateGame();');
 assert.equal(g.run('state.score'),score);assert.equal(g.run('state.countdownTicks'),1);
 g.run('isMuted=true;updateGame();');assert.equal(g.run('state.countdownTicks'),0);
 assert.equal(g.run('state.invulnerableTicks'),180);
});

test('insufficient funds or denied storage cannot consume the rescue',()=>{
 const g=game();g.run('state.isPlaying=true;requestRescue();');
 assert.equal(g.run('rescueRun()'),false);assert.equal(g.run('state.rescueUsed'),false);
 g.run('saveCoinBank(50);localStorage.setItem=()=>{throw new Error("Denied")};');
 assert.equal(g.run('rescueRun()'),false);assert.equal(g.run('state.rescueUsed'),false);assert.equal(g.run('getCoinBank()'),50);
});

test('a second fatal crash ends the run instead of offering another rescue',()=>{
 const g=game();g.run('let ends=0;gameOver=()=>ends++;state.isPlaying=true;state.rescueUsed=true;requestRescue();');
 assert.equal(g.run('ends'),1);assert.equal(g.run('rescuePending'),false);
});

test('shop always reopens at characters and the top instead of scrolling to Close',()=>{
 const g=game();g.element('shop-panel').scrollTop=900;
 g.run('openShop()');
 assert.equal(g.element('shop-panel').scrollTop,0);
 assert.equal(g.element('character-section').classList.contains('hidden'),false);
 assert.equal(g.element('board-section').classList.contains('hidden'),true);
 assert.equal(g.element('shop-tab-characters').focused,true);
 assert.equal(g.element('close-shop-btn').focused,undefined);
 g.run('showShopTab("boards");closeShop();openShop();');
 assert.equal(g.element('board-section').classList.contains('hidden'),true);
 assert.equal(g.element('shop-panel').scrollTop,0);
});

test('outfits require character ownership and charge once, with persistent selection',()=>{
 const storage=new Map(),g=game(storage);g.run('saveCoinBank(200);');
 assert.equal(g.run('buyOrEquipOutfit("blue","varsity")'),false);
 assert.equal(g.run('buyOrEquipOutfit("default","varsity")'),true);
 assert.equal(g.run('getCoinBank()'),120);
 assert.equal(g.run('buyOrEquipOutfit("default","varsity")'),true);assert.equal(g.run('getCoinBank()'),120);
 const reload=game(storage);assert.equal(reload.run('readWallet().selectedOutfits.default'),'varsity');
 assert.equal(reload.run('outfitAppearance("default").color'),0xfff4da);
 assert.equal(reload.run('buyOrEquipOutfit("default","night")'),true);assert.equal(reload.run('getCoinBank()'),0);
});

test('failed outfit writes cannot debit the wallet or equip unsaved clothing',()=>{
 const storage=new Map(),g=game(storage);g.run('saveCoinBank(100);localStorage.setItem=()=>{throw new Error("Denied")};');
 assert.equal(g.run('buyOrEquipOutfit("default","varsity")'),false);
 const reload=game(storage);assert.equal(reload.run('getCoinBank()'),100);assert.equal(reload.run('readWallet().selectedOutfits.default'),'original');
});

function simpleRun(g) {
 g.run(`
  state.isPlaying=true;
  player={position:{x:0,y:0,z:0},rotation:{x:0,y:Math.PI,z:0},add(){},remove(){}};
  scene={remove(){},add(){}};
  spawnRow=checkThemeTransition=checkMilestones=spawnParticles=spawnDustTrail=sfxCoin=sfxPowerup=sfxJump=showMilestone=()=>{};
  createSkateboard=()=>({rotation:{set(){}},traverse(){}});
 `);
}

test('collecting a skateboard immediately mounts it, without a button or charges',()=>{
 const g=game();simpleRun(g);
 g.run('worldObjects=[{type:"board",mesh:{rotation:{y:0},position:{x:0,y:1,z:-0.4},traverse(){}}}];updateGame();');
 assert.equal(g.run('state.boardTicks'),900);assert.equal(g.run('boardModel!==null'),true);
 assert.equal(g.run('worldObjects.length'),0);assert.equal(g.run('state.boardCharges'),undefined);
});

test('jetpack pickup starts flight automatically and removes the skateboard',()=>{
 const g=game();simpleRun(g);
 g.run('activateBoard();createJetpack=()=>({position:{set(){}},userData:{flames:[]},traverse(){}});spawnAirCoins=()=>{};worldObjects=[{type:"jetpack",mesh:{rotation:{y:0},position:{x:0,y:1,z:-0.4},traverse(){}}}];updateGame();');
 assert.equal(g.run('state.flightTicks'),600);assert.equal(g.run('boardModel'),null);
 assert.equal(g.run('jetpackModel!==null'),true);assert.equal(g.run('worldObjects.length'),0);
});

test('flight expires into a protected descent; jumping is blocked until landing',()=>{
 const g=game();simpleRun(g);
 g.run('state.flightTicks=2;state.playerY=3.6;requestJump();');assert.equal(g.run('jumpBuffer'),0);
 g.run('updateRunFeatures();');assert.equal(g.run('state.flightTicks'),1);
 g.run('updateRunFeatures();');assert.equal(g.run('state.flightLanding'),true);assert.equal(g.run('state.invulnerableTicks'),120);
 g.run('for(let i=0;i<40;i++)updateGame();');
 assert.equal(g.run('state.playerY')<0.11,true);assert.equal(g.run('state.flightLanding'),false);assert.ok(g.run('state.invulnerableTicks')>0);
});

test('air coins require flight and ground coins are not collected from the sky',()=>{
 for(const [flying,air,expected] of [[false,true,0],[true,true,1],[true,false,0]]){
  const g=game();simpleRun(g);
  g.run(`state.flightTicks=${flying?100:0};state.playerY=${flying?3.6:0};worldObjects=[{type:'coin',airCoin:${air},mesh:{rotation:{y:0},position:{x:0,y:4.3,z:-0.4,clone(){return this}},traverse(){}}}];updateGame();`);
  assert.equal(g.run('state.coins'),expected);
 }
});
