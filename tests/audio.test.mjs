import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameAudio} from '../audio.js';
function fixture(){
 const preferences={music:true,effects:true,volume:.5};let muted=false,playing=true,beats=[],delays=[],cancelled=[],volumes=[],created=0;
 const ctx={state:'running',currentTime:0,destination:{},createOscillator:()=>({frequency:{setValueAtTime(){}},connect(){},start(){},stop(){}}),createGain:()=>({gain:{setValueAtTime(v){volumes.push(v)},exponentialRampToValueAtTime(){}},connect(){}})};
 const audio=createGameAudio({preferences:()=>preferences,muted:()=>muted,playing:()=>playing,contextFactory:()=>{created++;return ctx;},schedule:fn=>{beats.push(fn);return beats.length;},cancel:id=>cancelled.push(id),delay:fn=>delays.push(fn)});
 return {audio,preferences,beats,delays,cancelled,volumes,created:()=>created,mute:()=>muted=true,pause:()=>playing=false};
}
test('audio creation is lazy and effects respect mute, channel and volume',()=>{
 const f=fixture();assert.equal(f.created(),0);f.audio.sfxJump();assert.equal(f.created(),1);assert.equal(f.volumes[0],.05);
 f.preferences.effects=false;f.audio.sfxCrash();assert.equal(f.volumes.length,1);
 f.preferences.effects=true;f.mute();f.delays[0]();assert.equal(f.volumes.length,1);
});
test('music owns a single timer, works with effects disabled and stops on pause',()=>{
 const f=fixture();f.preferences.effects=false;f.audio.startMusic();f.audio.startMusic();assert.equal(f.beats.length,1);
 f.beats[0]();assert.equal(f.volumes.length,2);f.pause();f.beats[0]();assert.deepEqual(f.cancelled,[1]);
 f.preferences.music=false;f.audio.startMusic();assert.equal(f.beats.length,1);
});
test('browsers without Web Audio can still use the game',()=>{
 const audio=createGameAudio({preferences:()=>({music:true,effects:true,volume:1}),muted:()=>false,playing:()=>true,contextFactory:()=>{throw Error('unsupported')},delay:()=>{}});
 assert.equal(audio.ensureAudio(),null);assert.doesNotThrow(()=>audio.sfxJump());
});
