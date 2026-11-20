// Cosmetic police animation, isolated from collisions and reward logic.
export const CHASE_TICKS = 420;
export const CAPTURE_TICKS = 54;
export function createOfficer(THREE, geometries) {
 const group=new THREE.Group(),geo=geometries,blue=new THREE.MeshStandardMaterial({color:0x284a8b}),skin=new THREE.MeshStandardMaterial({color:0xffd4a9}),dark=new THREE.MeshStandardMaterial({color:0x1f2945}),white=new THREE.MeshBasicMaterial({color:0xfff4da});
 const part=(g,m,x,y,z,sx,sy,sz)=>{const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);group.add(mesh);return mesh;};
 part(geo.characterBody,blue,0,0.55,0,1.1,1.1,1);
 part(geo.rounded,skin,0,1.04,0,0.34,0.33,0.3);part(geo.unitBox,blue,0,1.31,0,0.7,0.13,0.6);part(geo.unitBox,dark,0,1.26,0.27,0.65,0.06,0.28);
 // White back patch and gold badge make the uniform readable from the chase camera.
 part(geo.unitBox,white,0,0.63,-0.31,0.45,0.13,0.025);part(geo.rounded,new THREE.MeshBasicMaterial({color:0xffd85c}),-0.17,0.64,0.31,0.06,0.08,0.025);
 const limbs=[];for(const side of [-1,1]){const arm=part(geo.rounded,blue,side*0.42,0.5,0,0.12,0.28,0.12),leg=part(geo.rounded,dark,side*0.17,0.16,0,0.13,0.22,0.13);limbs.push({arm,leg,side});}
 group.userData.limbs=limbs;group.rotation.y=Math.PI;group.scale.setScalar(0.9);group.position.set(-0.65,0,1.8);
 return group;
}
export function animateOfficer(officer,elapsed,laneX,reducedMotion=false,capture=false) {
 const t=capture?Math.min(1,elapsed/CAPTURE_TICKS):Math.min(1,elapsed/CHASE_TICKS);
 const ease=t*t*(3-2*t);
 officer.position.x+=(laneX-0.65-officer.position.x)*0.08;
 officer.position.z=capture?4.5-ease*3:1.8+Math.pow(Math.max(0,(t-0.3)/0.7),2)*10;
 officer.position.y=reducedMotion?0:Math.abs(Math.sin(elapsed*0.28))*0.07;
 for(const {arm,leg,side} of officer.userData.limbs){arm.rotation.x=reducedMotion?0:Math.sin(elapsed*0.3)*side*0.8;leg.rotation.x=-arm.rotation.x;}
 // Fade the distant officer out instead of popping out of the scene.
 const opacity=capture?1:Math.min(1,(1-t)*6);
 officer.traverse(part=>{if(part.material){part.material.transparent=opacity<1;part.material.opacity=opacity;}});
}
