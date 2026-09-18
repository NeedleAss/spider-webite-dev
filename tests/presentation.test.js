import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {storyState,partOffset,wheelTargets,motionPose,sonarCycle,shots,wheelAngles} from '../presentation/story/timeline.js';

test('story seeks are deterministic and cannot accumulate displacement over 100 assembly cycles',()=>{
  const reference=storyState(0,0);
  for(let pass=0;pass<100;pass++){
    for(let i=0;i<7;i++)for(const p of [0,.12,.4,.67,1]){const first=storyState(i,p);storyState(6,1);assert.deepEqual(storyState(i,p),first);}
    assert.deepEqual(storyState(0,0),reference);assert.deepEqual(partOffset('lid',reference),[0,0,0]);
  }
});
test('lid and OLED share the same reversible displacement, and final shot returns to the original front',()=>{
  for(let p=0;p<=1;p+=.05){const s=storyState(1,p);assert.deepEqual(partOffset('lid',s),partOffset('display',s));}
  assert.deepEqual(storyState(6,1).eye,shots[0].eye);assert.deepEqual(storyState(6,1).target,shots[0].target);
  assert.ok(shots[0].eye[0]<0);assert.ok(shots[0].eye[1]>shots[0].target[1]);
});
test('camera chapter widens to a complete response before transitioning to sonar',()=>{
  assert.equal(storyState(2,.4).focus,'camera');
  const end=storyState(2,1),next=storyState(3,0);
  assert.equal(end.response,1);assert.equal(end.open,0);assert.equal(end.focus,null);
  assert.deepEqual(end.eye,next.eye);assert.deepEqual(end.target,next.target);
});
test('reduced motion has deterministic readable chapter poses',()=>{
  for(let i=0;i<7;i++){const a=storyState(i,0,true),b=storyState(i,.9,true);assert.deepEqual(a.eye,b.eye);assert.equal(a.effect,true);}
});
test('normalised orthogonal mixing preserves longitudinal/transverse pairs and bounded rotation',()=>{
  assert.deepEqual(wheelTargets(1,0,0),[1,0,0,1]);assert.deepEqual(wheelTargets(0,1,0),[0,1,1,0]);
  assert.deepEqual(wheelTargets(0,0,1),[1,1,-1,-1]);
  for(const x of [-1,0,1])for(const y of [-1,0,1])for(const w of [-1,0,1])assert.ok(wheelTargets(x,y,w).every(v=>Math.abs(v)<=1));
});
test('in-place turning really holds translation fixed; trajectory closes and sonar returns to the emitting plane',()=>{
  for(const t of [8,9,10,11.9])assert.deepEqual(motionPose(t).position,[-.060,0,-.060]);
  assert.ok(motionPose(16).position.every(v=>Math.abs(v)<1e-12));
  assert.equal(sonarCycle(0).distance,0);assert.equal(sonarCycle(2).distance,1);assert.equal(sonarCycle(4).distance,0);assert.equal(sonarCycle(3).returning,true);
});
test('saved source CAD fixes both module forward axes at world -X; original manifest has not been rewritten',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../presentation/assets/cad/cad-manifest.json',import.meta.url)));
  assert.equal(manifest.glbSha256,'2310e2bd46a6940497349d1acf00ef70bd8279881a637424b2764c136229d61b');
  for(const part of ['camera','ultrasonic']){const m=manifest.instances.find(n=>n.part===part).matrix;assert.ok(Math.abs(m[8]+1)<1e-10);assert.ok(Math.abs(m[9])+Math.abs(m[10])<1e-10);}
});

test('CAD wheel instances have the physical axes and geometric rotation signs required by the orthogonal layout',()=>{
  assert.deepEqual(wheelAngles(.012,0,0),{'wheel-5':-1,'wheel-6':0,'wheel-1':0,'wheel-7':1});
  const turn=wheelAngles(0,0,1);assert.ok(Object.values(turn).every(v=>v<0));
  const slide=wheelAngles(0,.012,0);assert.equal(slide['wheel-5'],0);assert.equal(slide['wheel-7'],0);assert.equal(slide['wheel-6'],-1);assert.equal(slide['wheel-1'],1);
});
