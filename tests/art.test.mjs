import test from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTERS,portraitSVG,scoreCardSVG,renderScoreCard} from '../game-art.js';

test('roster has six distinct species with stable legacy IDs and one free character',()=>{
 assert.deepEqual(CHARACTERS.map(c=>c.id),['default','blue','gold','neon','ruby','cosmic']);
 assert.equal(new Set(CHARACTERS.map(c=>c.species)).size,6);
 assert.equal(CHARACTERS.filter(c=>c.cost===0).length,1);
 assert.equal(new Set(CHARACTERS.map(c=>portraitSVG(c))).size,6);
});

test('score card contains real run data, chosen character and escaped user input',()=>{
 const svg=scoreCardSVG({score:12345.9,coins:87,name:'A<&"',characterId:'cosmic',url:'https://example.com/?a=1&b=2'});
 assert.match(svg,/12,345/);assert.match(svg,/87 COINS/);assert.match(svg,/>ORBIT<\/text>/);
 assert.match(svg,/A&lt;&amp;&quot;/);assert.match(svg,/a=1&amp;b=2/);
 assert.doesNotMatch(svg,/<script|<image|<foreignObject/);
 assert.match(svg,/width="1080" height="1350"/);
});

test('PNG export waits for image loading and releases its temporary SVG URL',async()=>{
 const original={Image:globalThis.Image,document:globalThis.document};
 const revoke=URL.revokeObjectURL;
 let released,drawn=false,canvas;
 URL.revokeObjectURL=url=>{released=url;revoke(url)};
 globalThis.Image=class {set src(value){this.source=value;queueMicrotask(()=>this.onload());}};
 globalThis.document={createElement:()=>canvas={getContext:()=>({drawImage(image,x,y,w,h){assert.equal(w,1080);assert.equal(h,1350);drawn=true;}}),toBlob(cb,type){assert.equal(type,'image/png');cb(new Blob(['PNG'],{type}));}}};
 try {
  const blob=await renderScoreCard({score:10,coins:2});
  assert.equal(blob.type,'image/png');assert.equal(canvas.width,1080);assert.equal(canvas.height,1350);
  assert.equal(drawn,true);assert.match(released,/^blob:/);
 } finally {Object.assign(globalThis,original);URL.revokeObjectURL=revoke;}
});

test('failed image decoding and failed PNG encoding reject cleanly',async()=>{
 const original={Image:globalThis.Image,document:globalThis.document};
 try {
  globalThis.Image=class {set src(value){queueMicrotask(()=>this.onerror());}};
  await assert.rejects(renderScoreCard({}),/Could not render/);
  globalThis.Image=class {set src(value){queueMicrotask(()=>this.onload());}};
  globalThis.document={createElement:()=>({getContext:()=>({drawImage(){}}),toBlob(cb){cb(null)}})};
  await assert.rejects(renderScoreCard({}),/PNG export failed/);
 } finally {Object.assign(globalThis,original);}
});

test('outfits change portraits and run cards without changing the character identity',()=>{
 const character=CHARACTERS[0],outfit={id:'night',color:0x25263b,trim:0x62ff8a};
 const original=portraitSVG(character),dressed=portraitSVG(character,outfit);
 assert.notEqual(dressed,original);assert.match(dressed,/#62ff8a/);assert.match(dressed,/#21f14f/);
 const card=scoreCardSVG({score:50,coins:2,characterId:'default',outfit});
 assert.match(card,/#62ff8a/);assert.match(card,/>HOP<\/text>/);
});
