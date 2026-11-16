const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function game() {
 const elements = new Map();
 function element(id) {
  if (!elements.has(id)) elements.set(id, {
   value:'', textContent:'', listeners:{},
   classList:{add(){},remove(){},toggle(){},contains(){return true;}},
   addEventListener(type, fn){this.listeners[type]=fn;},
   setPointerCapture(){}, closest(){return null;}
  });
  return elements.get(id);
 }
 const storage = new Map();
 const context = vm.createContext({console, Math, Date, Number, String, Set,
  document:{getElementById:element,body:{classList:{add(){},remove(){}}}},
  window:{}, navigator:{maxTouchPoints:0},
  localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
  performance:{now:()=>100}, requestAnimationFrame(){}, setTimeout(){}, clearTimeout(){},setInterval(){},clearInterval(){},
 });
 let source = fs.readFileSync(require('node:path').join(__dirname,'../script.js'),'utf8');
 source = source.replace(/import \* as THREE from "three";/,'').replace(/import \{[\s\S]*?\} from "\.\/supabase.js";/,'').replace(/init\(\);\s*$/,'');
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
