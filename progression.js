// Local-only progression. Prices, mission targets and district patterns live here.
export const RESCUE_COST = 30;
export const BOARDS = [
 { id:'street', name:'STREET DECK', cost:0, color:0x21f14f, accent:0xff70b8 },
 { id:'neon', name:'NEON RUSH', cost:150, color:0x62e9ff, accent:0xa48aff },
 { id:'cosmic', name:'COSMIC CRUISE', cost:300, color:0xff70b8, accent:0xffe448 }
];
export const MISSION_POOL = [
 {id:'coins',metric:'coins',label:'Pocket 30 coins',target:30,reward:35},
 {id:'near',metric:'near',label:'Make 5 near misses',target:5,reward:40},
 {id:'tricks',metric:'tricks',label:'Land 4 skate tricks',target:4,reward:30},
 {id:'distance',metric:'distance',label:'Travel 800 metres',target:800,reward:45},
 {id:'runs',metric:'runs',label:'Start 3 runs',target:3,reward:25},
 {id:'districts',metric:'districts',label:'Enter 2 new districts',target:2,reward:40},
 {id:'boards',metric:'boards',label:'Ride 2 skateboards',target:2,reward:25},
 {id:'jumps',metric:'jumps',label:'Make 15 jumps',target:15,reward:30}
];
export function localDay(date=new Date()) {
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function missionsForDay(day=localDay()) {
 const hash=[...day].reduce((sum,ch)=>(Math.imul(sum,31)+ch.charCodeAt(0))>>>0,0)>>>0;
 return [0,3,6].map(offset=>MISSION_POOL[(hash+offset)%MISSION_POOL.length]);
}
export function dailyProgress(saved,day=localDay()) {
 if (!saved || saved.date!==day) return {date:day,metrics:{},claimed:[]};
 const metrics={};
 for(const m of MISSION_POOL) metrics[m.metric]=Math.max(0,Math.floor(Number(saved.metrics?.[m.metric])||0));
 return {date:day,metrics,claimed:Array.isArray(saved.claimed)?saved.claimed.filter(id=>missionsForDay(day).some(m=>m.id===id)):[]};
}
export function dangerMultiplier(chain) { return Math.min(4,1+Math.floor(Math.max(0,chain)/2)); }
export const DISTRICTS = [
 {name:'COLOUR CITY',sky:0xbfeaff,ground:0x33344d,obstacle:0xff6540,decor:0x21f14f,pattern:'city',description:'Find your rhythm.'},
 {name:'NEON UNDERPASS',sky:0x18152e,ground:0x25233b,obstacle:0xff70b8,decor:0x62e9ff,pattern:'tunnel',description:'Two lanes blocked. Read the gap.'},
 {name:'SKYLINE ROOFTOPS',sky:0xadcfff,ground:0x677797,obstacle:0xffd83f,decor:0xb797ff,pattern:'roof',description:'Jump the rooftop barriers.'},
 {name:'SUNSET BOARDWALK',sky:0xffbc9b,ground:0x80625c,obstacle:0xff6540,decor:0x7ed5af,pattern:'pier',description:'Barrels ahead. Keep rolling.'}
];
export function boardSVG(board) {
 const color='#'+board.color.toString(16).padStart(6,'0'),accent='#'+board.accent.toString(16).padStart(6,'0');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 140"><g transform="rotate(-14 120 70)" stroke="#202437" stroke-width="5"><circle cx="63" cy="99" r="13" fill="${accent}"/><circle cx="177" cy="99" r="13" fill="${accent}"/><rect x="23" y="42" width="194" height="46" rx="23" fill="${color}"/><path d="M99 44l-15 42m58-42-15 42" stroke="${accent}" stroke-width="14"/><path d="M47 63h13m120 0h13" stroke-linecap="round"/></g></svg>`;
}
