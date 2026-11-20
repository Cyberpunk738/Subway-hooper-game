// Local player progression. Mystery boxes are earned pickups, never paid spins.
export const RARITY_COLORS={common:'#dce5ed',rare:'#72ceff',epic:'#c7a4ff',legendary:'#ffe16c'};
export const DEFAULT_SETTINGS={muted:false,music:true,effects:true,volume:0.6,quality:'auto',reducedMotion:false,chaseIntro:true,sensitivity:14};
export function normalizeSettings(raw={},legacyMute=false){
 const value=raw&&typeof raw==='object'?raw:{};
 return {muted:typeof value.muted==='boolean'?value.muted:legacyMute,music:value.music!==false,effects:value.effects!==false,
  volume:Number.isFinite(Number(value.volume))?Math.max(0,Math.min(1,Number(value.volume))):0.6,
  quality:['auto','low','high'].includes(value.quality)?value.quality:'auto',reducedMotion:value.reducedMotion===true,
  chaseIntro:value.chaseIntro!==false,sensitivity:[10,14,24].includes(Number(value.sensitivity))?Number(value.sensitivity):14};
}
const integer=value=>Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,Math.floor(Number(value)||0)));
export function normalizeProfile(raw={}){
 const p=raw&&typeof raw==='object'?raw:{};
 return {runs:integer(p.runs),coins:integer(p.coins),distance:integer(p.distance),bestScore:integer(p.bestScore),bestDistance:integer(p.bestDistance),
  tricks:integer(p.tricks),near:integer(p.near),boxes:integer(p.boxes),opened:integer(p.opened),
  visited:Array.isArray(p.visited)?[...new Set(p.visited.filter(v=>typeof v==='string'))]:[],
  recent:Array.isArray(p.recent)?p.recent.slice(0,5).filter(r=>r&&Number.isFinite(r.score)&&Number.isFinite(r.distance)).map(r=>({score:integer(r.score),distance:integer(r.distance),coins:integer(r.coins),characterId:String(r.characterId||'default').slice(0,24),date:String(r.date||'').slice(0,30)})):[]};
}
export function recordRun(profile,run){
 const p=normalizeProfile(profile),distance=integer(run.distance),score=integer(run.score);
 p.runs++;p.coins+=integer(run.coins);p.distance+=distance;p.tricks+=integer(run.tricks);p.near+=integer(run.nearMissCount);
 p.bestScore=Math.max(p.bestScore,score);p.bestDistance=Math.max(p.bestDistance,distance);
 p.visited=[...new Set([...p.visited,...(run.visited||[])])];
 p.recent.unshift({score,distance,coins:integer(run.coins),characterId:run.characterId,date:run.date});p.recent=p.recent.slice(0,5);
 return p;
}
export function mysteryReward(roll,pick,catalog){
 if(roll<0.7)return{kind:'coins',amount:40,label:'40 COINS'};
 if(roll<0.95)return{kind:'coins',amount:100,label:'100 COINS'};
 const pool=catalog.filter(c=>c.id!=='default'),character=pool[Math.min(pool.length-1,Math.max(0,Math.floor(pick*pool.length)))];
 return character?{kind:'character',id:character.id,label:character.name,rarity:character.rarity}:{kind:'coins',amount:150,label:'150 COINS'};
}
export function redeemMysteryBox(wallet,reward){
 if(normalizeProfile(wallet.profile).boxes<1)return null;
 const next=JSON.parse(JSON.stringify(wallet));next.profile=normalizeProfile(next.profile);next.profile.boxes--;next.profile.opened++;
 let result={...reward};
 if(reward.kind==='character'){
  if(next.owned.includes(reward.id)){next.bank+=150;result={kind:'coins',amount:150,label:'DUPLICATE CREW · 150 COINS'};}
  else next.owned.push(reward.id);
 }else next.bank+=reward.amount;
 return {wallet:next,reward:result};
}
