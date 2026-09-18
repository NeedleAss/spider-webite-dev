// Approved structure study: one framing and clock for every presentation entry.
export const STRUCTURE_EYE=Object.freeze([-.49,.30,.55]);
export const STRUCTURE_TARGET=Object.freeze([.004,.125,0]);
export const ASSEMBLY_SECONDS=3.6;
export const clamp=x=>Math.max(0,Math.min(1,x));
export const ease=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10);};
export function openingAt(t){if(t<.8)return 0;if(t<4.4)return ease((t-.8)/ASSEMBLY_SECONDS);if(t<5.6)return 1;if(t<9.2)return 1-ease((t-5.6)/ASSEMBLY_SECONDS);return 0;}
export function structureShot(aspect=1.4){const target=[...STRUCTURE_TARGET],fit=Math.max(1,1.4/aspect);return {eye:STRUCTURE_EYE.map((v,i)=>target[i]+(v-target[i])*fit),target};}
// Linear phase is reversible mid-flight; easing is applied only to the pose.
export function advanceAssembly(phase,goal,dt){return phase+Math.sign(goal-phase)*Math.min(Math.abs(goal-phase),Math.max(0,dt)/ASSEMBLY_SECONDS);}
