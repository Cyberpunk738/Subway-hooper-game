// Distances are world units; timing is measured in fixed 60Hz simulation ticks.
export const TRACK_SPAWN_Z = -92;
export const OPENING_ROWS = [-44, -68, -92];
export function rowSpacing(speed) {
 return Math.max(24, speed * 2 * 36);
}

// Every row has an empty lane, at most one lane away from the previous route.
export function planObstacleRow(previousSafe, district, distance, random = Math.random) {
 const lanes = [-1, 0, 1];
 if (random() < 0.2) return {safeLane:previousSafe, blocked:[]};
 const choices = lanes.filter(lane => Math.abs(lane - previousSafe) <= 1);
 const safeLane = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
 const hazards = lanes.filter(lane => lane !== safeLane);
 const blocked = district === 1 && distance >= 200 ? hazards : [hazards[Math.min(1, Math.floor(random() * 2))]];
 return {safeLane, blocked};
}

// Sweep relative movement through the expanded obstacle box. This catches a
// narrow obstacle crossed between ticks, but still allows a jump above it.
export function sweptObstacleHit(from, to, hitbox) {
 let enter = 0, exit = 1;
 const intervals = [['x', -hitbox.halfWidth, hitbox.halfWidth], ['z', -hitbox.halfDepth, hitbox.halfDepth], ['y', -100, hitbox.height]];
 for (const [axis, min, max] of intervals) {
  const delta = to[axis] - from[axis];
  if (Math.abs(delta) < 1e-9) {
   if (from[axis] <= min || from[axis] >= max) return false;
  } else {
   const a = (min - from[axis]) / delta, b = (max - from[axis]) / delta;
   enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
   if (enter >= exit) return false;
  }
 }
 return enter < exit;
}

export const FIRST_BOX_DISTANCE = 800;
export function nextMysteryDistance(distance, random = Math.random) {
 return distance + 1500 + Math.floor(Math.max(0, Math.min(1, random())) * 500);
}
