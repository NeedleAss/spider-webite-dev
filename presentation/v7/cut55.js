// 55-second review cut. Lateral movement now lives in obstacle avoidance;
// skip its duplicate source interval 54..60 in the independent motion chapter.
import {evaluate as sourceEvaluate,scenes as sourceScenes,Director as SourceDirector} from './director.js';
export const CUT_DURATION=55;
const lengths=[1,6,11,8,4,8,9,5,3];
let cursor=0;
export const cutScenes=sourceScenes.map((s,i)=>{const start=cursor;cursor+=lengths[i];return {...s,start,end:cursor,sourceStart:s.start,sourceEnd:s.end};});
export function sourceTimeAt(time){const t=Math.max(0,Math.min(CUT_DURATION,time)),s=cutScenes.find(s=>t<s.end)||cutScenes.at(-1);if(s.id==='motion')return t<28?48+(t-26)*3:60+(t-28)*3;return s.sourceStart+(s.sourceEnd-s.sourceStart)*(t-s.start)/(s.end-s.start);}
export function cutTimeAt(source){if(source>=48&&source<66)return source<54?26+(source-48)/3:source<60?28:28+(source-60)/3;const s=cutScenes.find(s=>source<s.sourceEnd)||cutScenes.at(-1);return s.start+(s.end-s.start)*(source-s.sourceStart)/(s.sourceEnd-s.sourceStart);}
export function evaluateCut(t,options){const sourceTime=sourceTimeAt(t),s=sourceEvaluate(sourceTime,options);return {...s,t:Math.max(0,Math.min(CUT_DURATION,t)),sourceTime,copy:cutScenes[s.index]};}
export class CutDirector extends SourceDirector{
 constructor(){super();this.hold=CUT_DURATION;}
 seek(t){this.time=Math.max(0,Math.min(CUT_DURATION,t));this.last=null;return this.time;}
 chapter(i){const s=cutScenes[Math.max(0,Math.min(cutScenes.length-1,i))];this.seek(s.start);this.hold=s.end;this.playing=this.mode==='deck';}
 tick(now){if(this.last!==null&&this.playing){const end=this.mode==='deck'?this.hold:CUT_DURATION;this.time=Math.min(end,this.time+Math.max(0,now-this.last));if(this.time>=end)this.playing=false;}this.last=now;return this.time;}
}
