import test from 'node:test';
import assert from 'node:assert/strict';
import {localDay,missionsForDay,dailyProgress,dangerMultiplier,BOARDS,DISTRICTS} from '../progression.js';

test('daily missions are stable, unique and reset progress at local date rollover',()=>{
 assert.equal(localDay(new Date(2026,0,2,0,1)),'2026-01-02');
 const today=missionsForDay('2026-11-17');
 assert.equal(today.length,3);assert.equal(new Set(today.map(m=>m.id)).size,3);
 assert.deepEqual(missionsForDay('2026-11-17'),today);
 const saved={date:'2026-11-16',metrics:{coins:99},claimed:['coins']};
 assert.deepEqual(dailyProgress(saved,'2026-11-17'),{date:'2026-11-17',metrics:{},claimed:[]});
});

test('mission storage repairs malformed values without granting invented claims',()=>{
 const progress=dailyProgress({date:'2026-11-17',metrics:{coins:-30,tricks:'4'},claimed:['made-up']},'2026-11-17');
 assert.equal(progress.metrics.coins,0);assert.equal(progress.metrics.tricks,4);assert.deepEqual(progress.claimed,[]);
});

test('near miss multiplier grows gradually and is capped',()=>{
 assert.deepEqual([0,1,2,4,6,100].map(dangerMultiplier),[1,1,2,3,4,4]);
 assert.equal(dangerMultiplier(-1),1);
});

test('districts have distinct layouts and board designs have one free starter',()=>{
 assert.equal(new Set(DISTRICTS.map(d=>d.pattern)).size,4);
 assert.equal(BOARDS.filter(b=>b.cost===0).length,1);
 assert.equal(new Set(BOARDS.map(b=>b.id)).size,3);
});

test('jetpack eligibility enforces distance, flight/landing exclusion and one queued pickup',async()=>{
 const {JETPACK_SPACING,jetpackReady}=await import('../progression.js');
 const run={distance:1199,nextJetpackDistance:JETPACK_SPACING,flightTicks:0,flightLanding:false};
 assert.equal(jetpackReady(run),false);run.distance=1200;assert.equal(jetpackReady(run),true);
 assert.equal(jetpackReady(run,true),false);run.flightTicks=1;assert.equal(jetpackReady(run),false);
 run.flightTicks=0;run.flightLanding=true;assert.equal(jetpackReady(run),false);
});
