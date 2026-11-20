// Original, self-contained artwork shared by the shop and exported score cards.
// Existing IDs preserve players' previously unlocked skins as owned characters.
export const CHARACTERS = [
 { id: 'default', rarity:'common', name: 'HOP', species: 'bunny', color: 0x21f14f, accent: '#ff70b8', cost: 0, tagline: 'The original street hopper.' },
 { id: 'blue', rarity:'common', name: 'MARINA', species: 'bear', color: 0x4fc3f7, accent: '#ffe448', cost: 50, tagline: 'Cool head. Big bear energy.' },
 { id: 'gold', rarity:'rare', name: 'BOLT', species: 'fox', color: 0xffbd3b, accent: '#fff4da', cost: 100, tagline: 'A fox with a need for speed.' },
 { id: 'neon', rarity:'rare', name: 'GLITCH', species: 'robot', color: 0xb5ff40, accent: '#ac91ff', cost: 200, tagline: 'Built for one more run.' },
 { id: 'ruby', rarity:'epic', name: 'EMBER', species: 'cat', color: 0xff628d, accent: '#ffe448', cost: 300, tagline: 'Nine lives. Endless attitude.' },
 { id: 'cosmic', rarity:'epic', name: 'ORBIT', species: 'astronaut', color: 0xb797ff, accent: '#69e3ed', cost: 500, tagline: 'Out of this world.' },
 {id:'nova',name:'NOVA',species:'fox',variant:'goggles',rarity:'rare',color:0x7e93ff,accent:'#ffad73',cost:750,tagline:'A night-sky explorer with flight goggles.'},
 {id:'titan',name:'TITAN',species:'robot',variant:'armor',rarity:'epic',color:0x63cbd3,accent:'#ffe448',cost:1400,tagline:'Heavy armour. Light on his feet.'},
 {id:'sol',name:'SOL',species:'astronaut',variant:'crown',rarity:'legendary',color:0xffcf4a,accent:'#ff836c',cost:2400,tagline:'The solar champion. Made to shine.'}
];

export function escapeSVG(value) {
 return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
}

export function portraitMarkup(character,appearance=null) {
 const c = character || CHARACTERS[0];
 const color = '#' + c.color.toString(16).padStart(6,'0');
 const ink = '#202437', cream = '#fff4da';
 const hex=v=>typeof v==='number'?'#'+v.toString(16).padStart(6,'0'):v;
 const cloth=appearance?hex(appearance.color):color,trim=appearance?hex(appearance.trim):c.accent;
 const sleeves=appearance?.id==='varsity'?cream:cloth;
 const outfitDetail=appearance?.id&&appearance.id!=='original'?`<path d="M78 158v43m44-43v43M64 207h72" stroke="${trim}" stroke-width="6"/>`:'';
 const accessory=c.variant==='goggles'?`<rect x="58" y="87" width="84" height="28" rx="12" fill="#202437" stroke="${trim}"/><path d="M100 88v24" stroke="${trim}"/>`:c.variant==='armor'?`<path d="M58 154l-23 15 10 26 22-9m75-32 23 15-10 26-22-9" fill="${trim}"/>`:c.variant==='crown'?`<path d="M60 65l-6-40 28 15 18-28 18 28 28-15-6 40z" fill="#ffe448"/>`:'';
 let ears = '';
 if (c.species === 'bunny') ears = `<rect x="58" y="13" width="28" height="77" rx="14" fill="${color}"/><rect x="114" y="13" width="28" height="77" rx="14" fill="${color}"/><path d="M72 29v34m56-34v34" stroke="${trim}" stroke-width="9"/>`;
 if (c.species === 'bear') ears = `<circle cx="58" cy="68" r="24" fill="${color}"/><circle cx="142" cy="68" r="24" fill="${color}"/><circle cx="58" cy="68" r="11" fill="${trim}"/><circle cx="142" cy="68" r="11" fill="${trim}"/>`;
 if (['fox','cat'].includes(c.species)) ears = `<path d="M49 91L42 28 87 66M151 91l7-63-45 38" fill="${color}"/><path d="M55 65l-3-18 18 21m60 0 18-21-3 18" stroke="${trim}" stroke-width="9"/>`;
 let face = `<rect x="46" y="61" width="108" height="91" rx="43" fill="${color}"/><ellipse cx="100" cy="123" rx="31" ry="20" fill="${cream}"/><path d="M94 117q6-8 12 0l-6 6z" fill="${ink}" stroke="none"/><path d="M91 130q9 9 18 0" fill="none"/><ellipse cx="77" cy="101" rx="6" ry="9" fill="${ink}"/><ellipse cx="123" cy="101" rx="6" ry="9" fill="${ink}"/>`;
 if (c.species === 'robot') face = `<path d="M100 52V28"/><circle cx="100" cy="23" r="9" fill="${trim}"/><rect x="39" y="60" width="122" height="92" rx="19" fill="${color}"/><rect x="51" y="79" width="98" height="43" rx="12" fill="${ink}"/><path d="M68 96v12m64-12v12" stroke="${trim}" stroke-width="9"/><path d="M84 137h32"/>`;
 if (c.species === 'astronaut') face = `<circle cx="100" cy="102" r="62" fill="${cream}"/><rect x="43" y="78" width="114" height="60" rx="29" fill="${ink}"/><path d="M62 96q16-13 34-10" stroke="${trim}" stroke-width="9" fill="none"/><circle cx="36" cy="105" r="10" fill="${color}"/><circle cx="164" cy="105" r="10" fill="${color}"/>`;
 return `<g stroke="${ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="100" cy="237" rx="66" ry="9" fill="${ink}" opacity=".15" stroke="none"/><path d="M78 208v21m44-21v21" stroke-width="18"/><rect x="52" y="224" width="39" height="15" rx="7" fill="${trim}"/><rect x="109" y="224" width="39" height="15" rx="7" fill="${trim}"/><path d="M56 166l-15 31m103-31 15 31" stroke="${sleeves}" stroke-width="20"/><rect x="58" y="143" width="84" height="73" rx="27" fill="${cloth}"/><path d="M75 155l49 52" stroke-width="9"/><rect x="100" y="185" width="35" height="23" rx="9" fill="${trim}"/>${outfitDetail}${ears}${face}${accessory}</g>`;
}

export function portraitSVG(character,appearance=null) {
 return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="250" viewBox="0 0 200 250">${portraitMarkup(character,appearance)}</svg>`;
}

export function scoreCardSVG(run) {
 const character = CHARACTERS.find(c=>c.id===run.characterId) || CHARACTERS[0];
 const score = Math.max(0,Math.floor(Number(run.score)||0)).toLocaleString('en-US');
 const coins = Math.max(0,Math.floor(Number(run.coins)||0)).toLocaleString('en-US');
 const coinSize = Math.min(38, 208 / ((coins.length + 6) * 0.65));
 const name = escapeSVG(String(run.name || 'A player').slice(0,24).toUpperCase());
 const url = escapeSVG(String(run.url || '').replace(/^https?:\/\//,''));
 const scoreSize = Math.min(230, 880 / (score.length * 0.66));
 const footerSize = Math.min(25, 890 / Math.max(1, String(run.url||'').length * 0.62));
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
 <rect width="1080" height="1350" fill="#f7f5ef"/>
 <g font-family="Arial, Helvetica, sans-serif" fill="#202437">
 <rect x="48" y="48" width="984" height="1254" rx="44" fill="#202437"/>
 <rect x="36" y="36" width="984" height="1254" rx="44" fill="#b797ff" stroke="#202437" stroke-width="8"/>
 <text x="85" y="124" font-size="43" font-weight="900" letter-spacing="-2">SUPER HOPPER®</text>
 <rect x="710" y="77" width="254" height="56" rx="28" fill="#ffe448" stroke="#202437" stroke-width="4"/>
 <text x="837" y="114" text-anchor="middle" font-size="24" font-weight="800">ONE MORE RUN.</text>
 <text x="85" y="210" font-size="23" font-weight="800" letter-spacing="5">${name}’S RUN</text>
 <text x="76" y="412" font-size="${scoreSize}" font-weight="900" letter-spacing="-8">${score}</text>
 <text x="90" y="466" font-size="28" font-weight="800" letter-spacing="8">POINTS. PURE CHAOS.</text>
 <path d="M40 610L1016 535V1125H40Z" fill="#21f14f" stroke="#202437" stroke-width="6"/>
 <path d="M40 1090l280-480h440l256 480" fill="#33344d"/>
 <path d="M380 1100l95-470m225 470-95-470" stroke="#fff4da" stroke-width="12" stroke-dasharray="42 40"/>
 <circle cx="840" cy="650" r="70" fill="#ffe448" stroke="#202437" stroke-width="5"/>
 <path d="M798 650h84m-42-42v84" stroke="#202437" stroke-width="14"/>
 <g transform="translate(310 560) scale(2.2)">${portraitMarkup(character,run.outfit)}</g>
 <rect x="80" y="745" width="248" height="117" rx="23" fill="#ffe448" stroke="#202437" stroke-width="5" transform="rotate(-7 80 745)"/>
 <text x="105" y="794" font-size="${coinSize}" font-weight="900" transform="rotate(-7 105 794)">${coins} COINS</text>
 <text x="109" y="833" font-size="20" font-weight="700" transform="rotate(-7 109 833)">POCKETED THIS RUN</text>
 <rect x="718" y="923" width="250" height="71" rx="18" fill="#ff70b8" stroke="#202437" stroke-width="5" transform="rotate(7 718 923)"/>
 <text x="840" y="972" text-anchor="middle" font-size="30" font-weight="900" transform="rotate(7 840 972)">${character.name}</text>
 <rect x="79" y="1128" width="898" height="87" rx="43" fill="#ffe448" stroke="#202437" stroke-width="5"/>
 <text x="528" y="1187" text-anchor="middle" font-size="50" font-weight="900" letter-spacing="-2">THINK YOU CAN BEAT IT?</text>
 <text x="528" y="1260" text-anchor="middle" font-size="${footerSize}" font-weight="700">${url}</text>
 </g></svg>`;
}

export async function renderScoreCard(run) {
 const svg = new Blob([scoreCardSVG(run)], { type:'image/svg+xml;charset=utf-8' });
 const source = URL.createObjectURL(svg);
 try {
  const image = new Image();
  await new Promise((resolve,reject)=> { image.onload=resolve; image.onerror=()=>reject(new Error('Could not render score card')); image.src=source; });
  const canvas = document.createElement('canvas');
  canvas.width=1080; canvas.height=1350;
  const context=canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.drawImage(image,0,0,1080,1350);
  return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob ? resolve(blob) : reject(new Error('PNG export failed')), 'image/png'));
 } finally { URL.revokeObjectURL(source); }
}
