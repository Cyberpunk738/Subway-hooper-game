import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSettings,normalizeProfile,recordRun,mysteryReward,redeemMysteryBox} from '../player-meta.js';
import {CHARACTERS} from '../game-art.js';

test('preferences validate choices and retain the legacy master mute',()=>{
 const p=normalizeSettings({quality:'invalid',volume:8,sensitivity:999},true);
 assert.equal(p.quality,'auto');assert.equal(p.volume,1);assert.equal(p.sensitivity,14);assert.equal(p.muted,true);
 assert.equal(normalizeSettings({volume:-4}).volume,0);assert.equal(normalizeSettings().chaseIntro,true);
});

test('run records aggregate only completed runs and bound recent history',()=>{
 let profile=normalizeProfile();
 for(let i=1;i<=7;i++)profile=recordRun(profile,{score:i*100,distance:500,coins:10,tricks:2,nearMissCount:1,visited:['city','forest'],date:'2026-11-20'});
 assert.equal(profile.runs,7);assert.equal(profile.bestScore,700);assert.equal(profile.distance,3500);assert.equal(profile.coins,70);
 assert.equal(profile.recent.length,5);assert.deepEqual(profile.visited,['city','forest']);assert.equal(profile.tricks,14);
});

test('mystery reward thresholds match the displayed odds',()=>{
 assert.equal(mysteryReward(0,0,CHARACTERS).amount,40);assert.equal(mysteryReward(0.6999,0,CHARACTERS).amount,40);
 assert.equal(mysteryReward(0.7,0,CHARACTERS).amount,100);assert.equal(mysteryReward(0.9499,0,CHARACTERS).amount,100);
 const character=mysteryReward(0.95,0.9999,CHARACTERS);assert.equal(character.kind,'character');assert.equal(character.id,'sol');
});

test('earned boxes decrement once and duplicate characters turn into coins',()=>{
 const wallet={bank:20,owned:['default','blue'],profile:{boxes:1}};
 const result=redeemMysteryBox(wallet,{kind:'character',id:'blue',label:'MARINA'});
 assert.equal(result.wallet.bank,170);assert.equal(result.wallet.profile.boxes,0);assert.equal(result.wallet.profile.opened,1);
 assert.equal(wallet.bank,20);assert.equal(wallet.profile.boxes,1);
 assert.equal(redeemMysteryBox(result.wallet,{kind:'coins',amount:40}),null);
});

test('new mystery crew unlocks without spending coins or replacing the selected character',()=>{
 const result=redeemMysteryBox({bank:0,owned:['default'],selected:'default',profile:{boxes:1}},{kind:'character',id:'sol',rarity:'legendary',label:'SOL'});
 assert.deepEqual(result.wallet.owned,['default','sol']);assert.equal(result.wallet.selected,'default');assert.equal(result.wallet.bank,0);
});

test('all characters have a supported rarity and existing IDs remain stable',()=>{
 assert.equal(CHARACTERS.length,9);assert.equal(CHARACTERS.find(c=>c.id==='sol').rarity,'legendary');
 assert.ok(CHARACTERS.every(c=>['common','rare','epic','legendary'].includes(c.rarity)));
 assert.deepEqual(CHARACTERS.slice(0,6).map(c=>c.id),['default','blue','gold','neon','ruby','cosmic']);
});
