// One action per gesture. The release position also handles coalesced events.
export function bindSwipeControls(element,{active,threshold,move,jump,now}) {
 let gesture=null;
 const resolve=event=>{
  const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
  if(Math.max(Math.abs(dx),Math.abs(dy))<threshold())return false;
  gesture.used=true;
  if(Math.abs(dx)>Math.abs(dy))move(Math.sign(dx));else if(dy<0)jump();
  return true;
 };
 const cancel=()=>{gesture=null;};
 element.addEventListener('pointerdown',event=>{
  if(!active()||!event.isPrimary)return;
  gesture={id:event.pointerId,x:event.clientX,y:event.clientY,used:false,started:now()};
  element.setPointerCapture(event.pointerId);
 });
 element.addEventListener('pointermove',event=>{
  if(!gesture||gesture.id!==event.pointerId||gesture.used||!active())return;
  resolve(event);
 });
 element.addEventListener('pointerup',event=>{
  if(!gesture||gesture.id!==event.pointerId)return;
  if(active()&&!gesture.used&&!resolve(event)&&now()-gesture.started<300)jump();
  cancel();
 });
 for(const type of ['pointercancel','lostpointercapture'])element.addEventListener(type,event=>{
  if(!event||gesture?.id===event.pointerId)cancel();
 });
 return cancel;
}
