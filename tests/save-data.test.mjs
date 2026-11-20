import test from 'node:test';
import assert from 'node:assert/strict';
import {exportProgress,parseProgress,MAX_BACKUP_BYTES} from '../save-data.js';
import {CHARACTERS} from '../game-art.js';
import {BOARDS,OUTFITS,DISTRICTS,dailyProgress,localDay} from '../progression.js';
import {normalizeProfile} from '../player-meta.js';
function wallet(){return {bank:700,owned:['default','nova'],selected:'nova',boards:['street','neon'],board:'neon',outfits:Object.fromEntries(CHARACTERS.map(c=>[c.id,['original','varsity']])),selectedOutfits:Object.fromEntries(CHARACTERS.map(c=>[c.id,'varsity'])),profile:normalizeProfile({runs:3,boxes:2,visited:['forest']}),daily:dailyProgress(null,localDay())};}
const read=text=>parseProgress(text,CHARACTERS,BOARDS,OUTFITS,DISTRICTS);
test('progress files roundtrip ownership, coins, outfits, missions and unspent boxes',()=>{
 const w=wallet(),text=exportProgress(w,new Date('2026-11-20T12:00:00Z'));
 assert.deepEqual(read(text),w);assert.deepEqual(wallet(),w);
});
test('invalid versions, incomplete wallets, unknown IDs and oversized files are rejected',()=>{
 for(const mutate of [s=>s.version=99,s=>s.wallet.bank=-1,s=>s.wallet.bank='700',s=>s.wallet.owned.push('fake'),s=>delete s.wallet.outfits,s=>s.wallet.selected='cosmic',s=>s.wallet.profile.runs=NaN,s=>s.wallet.profile.recent=[{score:2,distance:3,coins:0,characterId:'<script>',date:''}]]){
  const data=JSON.parse(exportProgress(wallet()));mutate(data);assert.throws(()=>read(JSON.stringify(data)));
 }
 assert.throws(()=>read('{bad json'));assert.throws(()=>read(' '.repeat(MAX_BACKUP_BYTES+1)));
});
