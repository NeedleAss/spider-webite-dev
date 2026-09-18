// Pure story coordinates, in metres. Every pose is derived from rest, never accumulated.
export const chapters = ['meet', 'inside', 'vision', 'range', 'motion', 'care', 'whole'];
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export const mix = (a, b, t) => a + (b - a) * t;
const vectorMix = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
// Front is CAD -X, up +Y. Each lens has a generous near plane for true close-ups.
export const shots = [
  {eye:[-.350,.163,.130], target:[0,.047,0], open:0, focus:null},
  {eye:[-.420,.270,.260], target:[0,.080,0], open:1, focus:null},
  {eye:[-.245,.116,.140], target:[-.094,.052,0], open:1, focus:'camera'},
  {eye:[-.235,.144,.140], target:[-.108,.093,0], open:1, focus:'ultrasonic'},
  {eye:[-.440,.235,.280], target:[-.030,.022,-.030], open:0, focus:null},
  {eye:[-.200,.230,.310], target:[-.006,.046,.018], open:0, focus:'health'},
  {eye:[-.350,.163,.130], target:[0,.047,0], open:0, focus:null},
];
export function storyState(index, progress, reduced = false) {
  index = clamp(Math.floor(index), 0, chapters.length - 1);
  const current = shots[index], previous = index===3&&!reduced
    ? {eye:[-.480,.280,.290],target:[-.060,.044,.008],open:0}
    : index===6&&!reduced?{eye:[-.096,.230,.056],target:[0,.110,0],open:0}
    : shots[Math.max(0, index - 1)];
  const t = reduced ? 1 : ease(progress / .27);
  const state = { index, chapter:chapters[index], progress:clamp(progress), transition:t,
    eye:vectorMix(previous.eye,current.eye,t), target:vectorMix(previous.target,current.target,t),
    open:mix(previous.open,current.open,t), focus:current.focus,
    focusAmount:current.focus ? t : 0, effect:progress >= .27 || reduced,
  };
  // The camera chapter moves from the detector close-up to a complete, visible response.
  if(index===2 && progress>.60 && !reduced) {
    const response=ease((progress-.60)/.18);
    state.eye=vectorMix(state.eye,[-.480,.280,.290],response);
    state.target=vectorMix(state.target,[-.060,.044,.008],response);
    state.open=1-response;state.focusAmount=1-response;state.response=response;
    if(response===1)state.focus=null;
  }
  if(index===5 && progress>.58 && !reduced) {
    const screen=ease((progress-.58)/.18);
    state.eye=vectorMix(state.eye,[-.096,.230,.056],screen);
    state.target=vectorMix(state.target,[0,.110,0],screen);
    state.screen=screen;if(screen>.8){state.focus='display';state.focusAmount=screen;}
  }
  return state;
}
export function partOffset(part, state) {
  const open = state.open;
  // The lid/display move as one assembly. Shell clears the front without scattering electronics.
  const offsets = {lid:[0,.076,0],display:[0,.076,0],shell:[.054,.018,-.062],
    'board-frame':[.052,0,.012]};
  const stagger=['lid','display'].includes(part)?ease(open/.55):ease((open-.28)/.72);
  const result = (offsets[part] || [0,0,0]).map(v => v * stagger);
  if (state.focus === part && ['camera','ultrasonic'].includes(part)) result[0] -= .032 * state.focusAmount;
  return result;
}
export function wheelTargets(vx,vy,wz) {
  const a=[vx+wz,vy+wz,vy-wz,vx-wz], peak=Math.max(1,...a.map(Math.abs));
  return a.map(v=>v/peak);
}
// Demonstration trajectory only: metres, not a firmware command or measured odometry.
export function motionPose(seconds) {
  const t=clamp(seconds,0,16);
  if(t<4) {const s=ease(t/4); return {position:[-.060*s,0,0],yaw:0,label:'向前',phase:0,distance:.060*s};}
  if(t<8) {const s=ease((t-4)/4); return {position:[-.060,0,-.060*s],yaw:0,label:'横移',phase:1,distance:.060*s};}
  if(t<12){const s=ease((t-8)/4);return {position:[-.060,0,-.060],yaw:-Math.PI*2*s,label:'原地转向',phase:2,distance:s};}
  const s=ease((t-12)/4);return {position:[-.060*(1-s),0,-.060*(1-s)],yaw:-Math.PI*2,label:'回到起点',phase:3,distance:s};
}
// CAD front -X, up +Y, robot-right -Z. Source instance positions identify FL/FR/RL/RR.
// Electrical inversion is NOT used: local axle directions determine these rendering signs.
export function wheelAngles(forwardM,rightM,clockwiseRad) {
  const yawTravel=clockwiseRad*.047,r=.012;
  const a={'wheel-5':-(forwardM+yawTravel)/r,'wheel-6':-(rightM+yawTravel)/r,
    'wheel-1':(rightM-yawTravel)/r,'wheel-7':(forwardM-yawTravel)/r};
  return Object.fromEntries(Object.entries(a).map(([k,v])=>[k,v===0?0:v]));
}
export function sonarCycle(seconds) {
  const p=((seconds%4)+4)%4/4;
  return {distance:p<.5 ? p*2 : (1-p)*2, returning:p>=.5};
}
