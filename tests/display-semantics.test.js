import test from 'node:test';
import assert from 'node:assert/strict';
import {stopStatus,ppgTimestamp} from '../js/display-semantics.js';
import {decode} from '../js/protocol.js';
test('local latch and successful transmission do not claim device confirmation',()=>{
  assert.equal(stopStatus({local:true,delivery:'failed',stale:true}),'local-only');
  assert.equal(stopStatus({local:true,delivery:'sent',device:false,stale:false}),'awaiting-device');
  assert.equal(stopStatus({local:true,delivery:'sent',device:true,stale:false}),'device-reported');
  assert.notEqual(stopStatus({local:true,device:true,stale:true}),'device-reported');
});
test('recorded emergency telemetry is presented as replay even with a stale live transport',()=>{
  assert.equal(stopStatus({replaying:true,local:true,device:true,stale:true,delivery:'sent'}),'replay');
});
test('source batch time survives delayed network arrival and remains distinct from receipt time',()=>{
  const stamp=ppgTimestamp(1000000,1000900);assert.equal(stamp.time,1000000);assert.equal(stamp.receivedTs,1000900);assert.equal(stamp.basis,'source-batch');
  assert.equal(ppgTimestamp(1000100,1000950).time-stamp.time,100);
});
test('missing, zero, unsynchronised and future clocks are labelled arrival estimates',()=>{
  for(const time of [undefined,0,NaN,1,1020000])assert.equal(ppgTimestamp(time,1000000).basis,'arrival-estimate');
  assert.equal(decode('{"type":"ppg_batch","samples":[1,2]}').msg.sourceTs,undefined);
});
test('replay remaps capture and source clocks by one fixed offset, preserving source gaps',()=>{
  const offset=2000000-1000000;
  const a=ppgTimestamp(999700,2000000,offset),b=ppgTimestamp(1000700,2001300,offset);
  assert.equal(a.time,1999700);assert.equal(b.time-a.time,1000);assert.equal(b.receivedTs-b.time,600);
});
