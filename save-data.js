// A portable wallet snapshot. Import validates before a single wallet write.
export const SAVE_FORMAT = 'super-hopper-progress';
export const SAVE_VERSION = 1;
export const MAX_BACKUP_BYTES = 200000;
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const whole=(value,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
function validIds(value,allowed,max){return Array.isArray(value)&&value.length<=max&&value.every(id=>allowed.includes(id));}
export function exportProgress(wallet,now=new Date()) {
 return JSON.stringify({format:SAVE_FORMAT,version:SAVE_VERSION,createdAt:now.toISOString(),wallet},null,2);
}
export function parseProgress(text,catalog,boards,outfits,districts) {
 if(typeof text!=='string'||text.length>MAX_BACKUP_BYTES)throw new Error('Choose a Hopper progress file smaller than 200 KB.');
 let save;try{save=JSON.parse(text);}catch{throw new Error('This file is not valid JSON.');}
 if(!object(save)||save.format!==SAVE_FORMAT||save.version!==SAVE_VERSION||!object(save.wallet))throw new Error('This is not a supported Hopper progress backup.');
 const w=save.wallet,chars=catalog.map(c=>c.id),decks=boards.map(b=>b.id),looks=outfits.map(o=>o.id);
 const fail=()=>{throw new Error('This backup contains incomplete or invalid progress.');};
 if(!whole(w.bank)||!validIds(w.owned,chars,chars.length)||!w.owned.includes('default')||!w.owned.includes(w.selected))fail();
 if(!validIds(w.boards,decks,decks.length)||!w.boards.includes('street')||!w.boards.includes(w.board))fail();
 if(!object(w.outfits)||!object(w.selectedOutfits))fail();
 for(const id of chars){if(!validIds(w.outfits[id],looks,looks.length)||!w.outfits[id].includes('original')||!w.outfits[id].includes(w.selectedOutfits[id]))fail();}
 const p=w.profile;
 if(!object(p)||!['runs','coins','distance','bestScore','bestDistance','tricks','near','boxes','opened'].every(key=>whole(p[key])))fail();
 if(!validIds(p.visited,districts.map(d=>d.pattern),districts.length)||!Array.isArray(p.recent)||p.recent.length>5)fail();
 for(const r of p.recent)if(!object(r)||!whole(r.score)||!whole(r.coins)||!whole(r.distance)||!chars.includes(r.characterId)||typeof r.date!=='string'||r.date.length>30)fail();
 if(!object(w.daily)||typeof w.daily.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(w.daily.date)||!object(w.daily.metrics)||!Array.isArray(w.daily.claimed)||w.daily.claimed.length>8||!Object.values(w.daily.metrics).every(v=>whole(v))||!w.daily.claimed.every(v=>typeof v==='string'&&v.length<30))fail();
 // Copy only recognised wallet fields; no arbitrary keys enter persistent state.
 return {bank:w.bank,owned:[...new Set(w.owned)],selected:w.selected,boards:[...new Set(w.boards)],board:w.board,
  outfits:Object.fromEntries(chars.map(id=>[id,[...new Set(w.outfits[id])]])),selectedOutfits:Object.fromEntries(chars.map(id=>[id,w.selectedOutfits[id]])),
  profile:{...p},daily:{date:w.daily.date,metrics:{...w.daily.metrics},claimed:[...w.daily.claimed]}};
}
