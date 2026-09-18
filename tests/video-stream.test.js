import test from 'node:test';
import assert from 'node:assert/strict';
import {MjpegParser,MjpegStream,MAX_JPEG_BYTES,streamBoundary} from '../js/mjpeg.js';
const enc=new TextEncoder();
const jpeg=n=>new Uint8Array([255,216,n,255,217]);
function part(n){const data=jpeg(n);return Buffer.concat([Buffer.from('--camera\r\nContent-Type: image/jpeg\r\nContent-Length: '+data.length+'\r\n\r\n'),data,Buffer.from('\r\n')]);}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(opts={}) {
  let sink,time=0;const states=[],images=[],closed=[];
  const body=new ReadableStream({start(c){sink=c;}});
  const stream=new MjpegStream({fetcher:async()=>({ok:true,status:200,headers:new Headers({'content-type':'multipart/x-mixed-replace; boundary=camera'}),body}),
    now:()=>time,onState:s=>states.push(s.status),onFrame:b=>images.push(b.id),decode:async blob=>({width:320,height:240,id:new Uint8Array(await blob.arrayBuffer())[2],close(){closed.push(this.id);}}),...opts});
  return {stream,states,images,closed,send:n=>sink.enqueue(part(n)),at:t=>time=t};
}
test('CAM multipart parser survives every byte split and returns only the latest complete frame',()=>{
  assert.equal(streamBoundary('multipart/x-mixed-replace; boundary="camera"'),'camera');
  assert.throws(()=>streamBoundary('image/jpeg'));assert.throws(()=>streamBoundary('multipart/x-mixed-replace; boundary='+ 'x'.repeat(71)));
  const all=Buffer.concat([part(1),part(2),part(3)]);
  for(let size=1;size<all.length;size++) {
    const p=new MjpegParser('camera');let result;
    for(let i=0;i<all.length;i+=size){const r=p.push(all.subarray(i,i+size));if(r)result=r;}
    assert.deepEqual(result,jpeg(3));assert.equal(p.frames,3);assert.ok(p.buffer.length<=2);
  }
  const p=new MjpegParser('camera');assert.deepEqual(p.push(all),jpeg(3));
});
test('malformed, duplicate and oversized JPEG framing is rejected within fixed buffer limits',()=>{
  const bad=[
    '--camera\r\nContent-Type: image/jpeg\r\nContent-Length: '+(MAX_JPEG_BYTES+1)+'\r\n\r\n',
    '--camera\r\nContent-Type: image/jpeg\r\nContent-Length: 5\r\nContent-Length: 5\r\n\r\n',
    '--camera\r\nContent-Type: image/png\r\nContent-Length: 5\r\n\r\n',
    'x'.repeat(4096)];
  for(const data of bad)assert.throws(()=>new MjpegParser('camera').push(enc.encode(data)));
  const data=part(1);data[data.length-3]=0;assert.throws(()=>new MjpegParser('camera').push(data));
});
test('decoded arrivals authorize LIVE; a retained frame expires independently of metadata',async()=>{
  const f=fixture();const job=f.stream.start('/stream');await flush();assert.deepEqual(f.states,['connecting']);
  f.send(7);await flush();assert.deepEqual(f.images,[7]);assert.equal(f.stream.status,'live');assert.deepEqual(f.closed,[7]);
  f.at(2001);f.stream.checkAge();assert.equal(f.stream.status,'stale');assert.equal(f.stream.controller,null);await flush();f.stream.stop();
  // Pending read is not allowed to publish after an abort, even if a fixture ignores AbortSignal.
  f.send(8);await job;assert.deepEqual(f.images,[7]);
});
test('source switch discards late decode and closes its bitmap',async()=>{
  let resolve;const f=fixture({decode:()=>new Promise(r=>resolve=r)});const job=f.stream.start('/stream');await flush();f.send(1);await flush();
  f.stream.stop();resolve({width:320,height:240,id:1,close(){f.closed.push(1);}});await flush();
  assert.deepEqual(f.images,[]);assert.deepEqual(f.closed,[1]);f.send(2);await job;
});
test('one decoding frame and one latest pending frame bound backlog',async()=>{
  const resolvers=[];const f=fixture({decode:()=>new Promise(r=>resolvers.push(r))});const job=f.stream.start('/stream');await flush();
  f.send(1);await flush();f.send(2);f.send(3);await flush();assert.equal(resolvers.length,1);assert.equal(f.stream.pending.jpeg[2],3);
  resolvers.shift()({width:320,height:240,id:1,close(){}});await flush();assert.deepEqual(f.images,[1]);assert.equal(resolvers.length,1);
  resolvers.shift()({width:320,height:240,id:3,close(){}});await flush();assert.deepEqual(f.images,[1,3]);f.stream.stop();f.send(4);await job;
});
test('busy HTTP response does not open reader or retry; first-frame timeout is bounded',async()=>{
  let calls=0;const f=fixture({fetcher:async()=>{calls++;return {status:503};}});await f.stream.start('/stream');assert.equal(f.stream.status,'busy');assert.equal(calls,1);assert.equal(f.stream.timer,null);
  const g=fixture();const job=g.stream.start('/stream');await flush();g.at(5001);g.stream.checkAge();assert.equal(g.stream.status,'stale');g.send(1);await job;
});
test('continuous arrivals do not starve display when decoding is slower than the source',async()=>{
  const resolvers=[];const f=fixture({decode:()=>new Promise(r=>resolvers.push(r))});const job=f.stream.start('/stream');await flush();f.send(1);await flush();
  try {
    for(let i=1;i<=6;i++){f.at(i*150);f.send(i+1);await flush();resolvers.shift()({width:320,height:240,id:i,close(){}});await flush();assert.equal(f.images.at(-1),i);assert.equal(resolvers.length,1);}
    assert.equal(f.stream.status,'live');assert.ok(f.stream.frameAt>=750);
  }finally{f.stream.stop();resolvers.shift()?.({width:320,height:240,id:99,close(){}});f.send(99);await job;}
});
