import test from 'node:test';import assert from 'node:assert/strict';
import {evaluate,independentMotion,careEvent,Director,DURATION,scenes} from '../presentation/story/director.js';
test('150-second director is deterministic under random seeks and reverse scrubbing',()=>{
  const times=Array.from({length:451},(_,i)=>i/3),states=times.map(t=>JSON.stringify(evaluate(t)));
  for(let i=times.length-1;i>=0;i--)assert.equal(JSON.stringify(evaluate(times[i])),states[i]);
  for(let i=0;i<times.length;i++){const s=evaluate(times[i]);assert.ok(s.eye.every(Number.isFinite));assert.ok(s.pose.position.every(Number.isFinite));assert.equal(s.care.simulated,true);}
  assert.equal(scenes.at(-1).end,DURATION);assert.equal(evaluate(150).chapter,'whole');
});
test('independent movement returns each translation, rotates through 360 and holds',()=>{
  assert.equal(independentMotion(4).position[0],-.09);assert.equal(independentMotion(8).position[0],0);
  assert.equal(independentMotion(11).position[2],-.09);assert.equal(independentMotion(14).position[2],0);
  assert.ok(Math.abs(independentMotion(16.5).yaw+Math.PI)<1e-9);assert.equal(independentMotion(20).yaw,-2*Math.PI);
  assert.equal(independentMotion(20).label,'停稳');
});
test('contact and OLED values are one event and clear on release',()=>{
  for(let t=112;t<130;t+=.1){const s=evaluate(t);if(!s.care.contact)assert.equal(s.care.hr,null);if(s.oled.line2.includes('72'))assert.equal(s.care.hr,72);}
  assert.equal(careEvent(126).hr,72);assert.equal(careEvent(127).hr,null);assert.equal(careEvent(127).spo2,null);
});
test('Deck stops at chapter hold; Film, Scroll and paused Inspect use independent authority',()=>{
  const d=new Director();d.setMode('deck');d.chapter(4);d.tick(0);d.tick(25);assert.equal(d.time,60);assert.equal(d.playing,false);
  d.setMode('film');d.seek(40);d.play();d.tick(100);d.tick(110);assert.equal(d.time,50);
  d.pause();d.tick(500);assert.equal(d.time,50);d.setMode('scroll');d.seek(25);d.play();d.tick(1000);assert.equal(d.time,25);
});
test('portrait framing preserves real-world size and pose',()=>{
  for(const t of [0,12,39,64,100,122]){const a=evaluate(t),b=evaluate(t,{aspect:.5});assert.deepEqual(a.pose,b.pose);assert.deepEqual(a.person,b.person);assert.notDeepEqual(a.eye,b.eye);}
});
