import test from 'node:test';
import assert from 'node:assert/strict';
import {rowSpacing,planObstacleRow,sweptObstacleHit,nextMysteryDistance,FIRST_BOX_DISTANCE,OPENING_ROWS} from '../runner-rules.js';

test('seeded rows preserve a walkable adjacent route through every district',()=>{
 let seed=8173,safe=0;
 const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
 for(let district=0;district<6;district++)for(let i=0;i<2000;i++){
  const row=planObstacleRow(safe,district,i*25,random);
  assert.ok(Math.abs(row.safeLane-safe)<=1);assert.ok(!row.blocked.includes(row.safeLane));
  assert.ok(row.blocked.length<=2);assert.ok(row.blocked.every(n=>[-1,0,1].includes(n)));
  if(district!==1||i*25<200)assert.ok(row.blocked.length<=1);
  safe=row.safeLane;
 }
});
test('row spacing preserves at least 600ms at every game speed and an opening runway',()=>{
 for(let speed=.26;speed<=.53;speed+=.005)assert.ok(rowSpacing(speed)/(speed*2)>=36-1e-9);
 assert.ok(-OPENING_ROWS[0]/(.26*2)>80);
 assert.equal(OPENING_ROWS[1]-OPENING_ROWS[2],rowSpacing(.26));
});
test('swept hit catches crossed hazards but allows clean dodges, high jumps and exact edges',()=>{
 const h={halfWidth:.8,halfDepth:.8,height:1};
 assert.equal(sweptObstacleHit({x:0,y:.05,z:2},{x:0,y:.05,z:-2},h),true);
 assert.equal(sweptObstacleHit({x:1,y:.05,z:2},{x:1,y:.05,z:-2},h),false);
 assert.equal(sweptObstacleHit({x:0,y:1.2,z:2},{x:0,y:1.1,z:-2},h),false);
 assert.equal(sweptObstacleHit({x:0,y:2,z:2},{x:0,y:0,z:-2},h),true);
 assert.equal(sweptObstacleHit({x:.8,y:.05,z:2},{x:.8,y:.05,z:-2},h),false);
 // Cross the lane while still well ahead of the obstacle, then pass outside.
 assert.equal(sweptObstacleHit({x:0,y:.05,z:5},{x:2.5,y:.05,z:-1},h),false);
});
test('earned boxes start later and have a bounded 1500–2000 metre cooldown',()=>{
 assert.equal(FIRST_BOX_DISTANCE,800);
 for(const roll of [0,.1,.5,.999,1])assert.ok(nextMysteryDistance(800,()=>roll)>=2300&&nextMysteryDistance(800,()=>roll)<=2800);
});
