// Cosmetic silhouettes share the same collision rig and movement abilities.
export function dressRunner(THREE, group, geo, skin, materials, part) {
 const {coat,accent,ink,cream}=materials;
 const details=[];
 const box=(material,x,y,z,sx,sy,sz,parent=group)=>part(geo.unitBox,material,x,y,z,sx,sy,sz,parent);
 if(skin.id==='gold'){
  // Racing vest and a broad tail stripe, readable from the chase camera.
  for(const x of [-.2,.2])box(cream,x,.53,-.275,.07,.34,.03);
 }else if(skin.id==='neon'){
  box(accent,0,.57,-.32,.42,.32,.12);
  for(const y of [.5,.6])box(cream,0,y,-.39,.25,.035,.025);
 }else if(skin.id==='ruby'){
  for(const side of [-1,1])part(geo.rounded,ink,side*.42,1.05,0,.1,.18,.18);
  const arch=part(geo.powerupRing,accent,0,1.12,0,.78,.78,.78);arch.rotation.x=Math.PI/2;
  for(const x of [-.2,.2])box(accent,x,.5,-.28,.055,.36,.025);
 }else if(skin.id==='cosmic'){
  for(const side of [-1,1]){
   box(cream,side*.36,.7,-.1,.2,.15,.4);
   box(accent,side*.17,.53,-.43,.12,.25,.09);
  }
 }else if(skin.id==='nova'){
  // An aviator's ear covers, cropped flight jacket and two trailing scarf tails.
  for(const side of [-1,1])part(geo.rounded,ink,side*.4,1.02,0,.095,.15,.15);
  box(cream,0,.7,0,.68,.11,.55);
  const scarf=new THREE.Group();scarf.position.set(.18,.72,-.25);group.add(scarf);
  for(const [x,z,length] of [[0,-.3,.62],[-.15,-.23,.46]]){const tail=box(accent,x,-.08,z,.14,.055,length,scarf);tail.rotation.x=.3;}
  details.push({kind:'scarf',object:scarf});
 }else if(skin.id==='titan'){
  // A broad, box-shaped exosuit, twin exhausts and a recessed power cell.
  box(coat,0,.48,0,.7,.56,.52);
  for(const side of [-1,1]){
   const shoulder=box(accent,side*.43,.7,0,.27,.24,.42);shoulder.rotation.z=side*.15;
   box(ink,side*.22,.72,-.38,.18,.32,.17);
   box(cream,side*.22,.9,-.38,.17,.04,.16);
  }
  box(ink,0,.5,-.3,.32,.34,.1);
  for(const y of [.4,.5,.6])box(accent,0,y,-.365,.22,.035,.04);
  for(const {arm,leg} of group.userData.limbs){box(accent,0,-.24,.01,.25,.15,.25,arm);box(coat,0,-.09,0,.25,.22,.25,leg);}
 }else if(skin.id==='sol'){
  // Sun-ray halo and a short split cape, visible from every preview angle.
  const halo=new THREE.Group();halo.position.set(0,1.12,-.2);group.add(halo);
  const ring=part(geo.powerupRing,accent,0,0,0,1.08,1.08,1.08,halo);
  for(let i=0;i<8;i++){const angle=i*Math.PI/4;const ray=box(accent,Math.sin(angle)*.68,Math.cos(angle)*.68,0,.08,.19,.08,halo);ray.rotation.z=-angle;}
  details.push({kind:'halo',object:halo});
  for(const x of [-.22,0,.22]){const cape=box(accent,x,.46,-.37,.2,.55,.045);cape.rotation.x=-.18;}
  for(const side of [-1,1])part(geo.rounded,cream,side*.37,.68,0,.17,.11,.2);
 }
 group.userData.cosmeticDetails=details;
}
export function animateRunnerDetails(group,time,reducedMotion=false) {
 for(const detail of group.userData.cosmeticDetails||[]){
  if(detail.kind==='scarf')detail.object.rotation.y=reducedMotion?0:Math.sin(time*.012)*.12;
  if(detail.kind==='halo')detail.object.rotation.z=reducedMotion?0:Math.sin(time*.0007)*.12;
 }
}
