// Direct CAM MJPEG, no proxy and no connection to the robot command transport.
// Frame cap matches firmware/cam_tracking/main/latest_frame.h (96 KiB).
export const MAX_JPEG_BYTES=96*1024;
const MAX_HEADER_BYTES=2048;
const encoder=new TextEncoder(),decoder=new TextDecoder('ascii');
function find(haystack,needle) {
  outer:for(let i=0;i<=haystack.length-needle.length;i++) {
    for(let j=0;j<needle.length;j++)if(haystack[i+j]!==needle[j])continue outer;
    return i;
  }
  return -1;
}
export function streamBoundary(contentType='') {
  if(!/^multipart\/x-mixed-replace\s*;/i.test(contentType))throw Error('Unsupported video content type');
  const value=contentType.match(/(?:^|;)\s*boundary=(?:"([^"\r\n]+)"|([^;\s]+))/i);
  const boundary=value?.[1]||value?.[2];
  if(!boundary||boundary.length>70||!/^[\x21-\x7e]+$/.test(boundary))throw Error('Invalid video boundary');
  return boundary;
}
export class MjpegParser {
  constructor(boundary) {
    if(!boundary||boundary.length>70||/[\r\n]/.test(boundary))throw Error('Invalid video boundary');
    this.marker=encoder.encode('--'+boundary);this.separator=encoder.encode('\r\n\r\n');
    this.buffer=new Uint8Array(0);this.length=null;this.frames=0;this.ended=false;
  }
  // A network read may contain many frames. Incremental slices bound retained
  // memory, and only the newest complete JPEG is returned to the decoder.
  push(chunk) {
    let latest=null;
    for(let offset=0;offset<chunk.length;offset+=4096) {
      const slice=chunk.subarray(offset,offset+4096),joined=new Uint8Array(this.buffer.length+slice.length);
      joined.set(this.buffer);joined.set(slice,this.buffer.length);this.buffer=joined;
      if(this.buffer.length>MAX_JPEG_BYTES+MAX_HEADER_BYTES+4096)throw Error('Video buffer limit');
      while(!this.ended) {
        if(this.length===null) {
          const start=find(this.buffer,this.marker);
          if(start<0) {if(this.buffer.length>MAX_HEADER_BYTES)throw Error('Video boundary missing');break;}
          if(start>2)throw Error('Unexpected video preamble');
          const after=start+this.marker.length;
          if(this.buffer.length>=after+2&&this.buffer[after]===45&&this.buffer[after+1]===45){this.ended=true;break;}
          const end=find(this.buffer,this.separator);
          if(end<0) {if(this.buffer.length>MAX_HEADER_BYTES)throw Error('Video headers too large');break;}
          const headers=decoder.decode(this.buffer.subarray(after,end));
          const lengths=[...headers.matchAll(/\r\nContent-Length:\s*(\d+)\s*(?=\r\n|$)/ig)];
          if(lengths.length!==1||!/\r\nContent-Type:\s*image\/jpeg\s*(?:\r\n|$)/i.test(headers))throw Error('Invalid JPEG headers');
          const length=Number(lengths[0][1]);
          if(!Number.isSafeInteger(length)||length<4||length>MAX_JPEG_BYTES)throw Error('JPEG size limit');
          this.length=length;this.buffer=this.buffer.slice(end+4);
        }
        if(this.buffer.length<this.length)break;
        const jpeg=this.buffer.slice(0,this.length);
        if(jpeg[0]!==255||jpeg[1]!==216||jpeg.at(-2)!==255||jpeg.at(-1)!==217)throw Error('Invalid JPEG markers');
        latest=jpeg;this.frames++;this.buffer=this.buffer.slice(this.length);this.length=null;
      }
    }
    return latest;
  }
}

export class MjpegStream {
  constructor({onFrame,onState,fetcher=(...args)=>globalThis.fetch(...args),decode=blob=>createImageBitmap(blob),now=()=>performance.now(),freshMs=2000}) {
    Object.assign(this,{onFrame,onState,fetcher,decode,now,freshMs});this.generation=0;
    this.controller=null;this.pending=null;this.decoding=false;this.frameAt=null;this.frames=0;this.timer=null;this.status='idle';
  }
  emit(status,detail='') {this.status=status;this.detail=detail;this.onState?.({status,detail,frameAt:this.frameAt,frames:this.frames});}
  stop() {++this.generation;this.controller?.abort();this.controller=null;clearInterval(this.timer);this.timer=null;this.pending=null;this.frameAt=null;}
  checkAge(generation=this.generation) {
    if(generation!==this.generation||!this.controller)return;
    if(this.now()-(this.frameAt??this.startedAt)>(this.frameAt===null?5000:this.freshMs))this.fail('stale','No fresh decoded frame',generation);
  }
  fail(status,detail,generation) {if(generation!==this.generation)return;this.stop();this.emit(status,detail);}
  async start(url) {
    this.stop();const generation=this.generation;this.controller=new AbortController();const signal=this.controller.signal;
    this.startedAt=this.now();this.frames=0;this.emit('connecting');
    this.timer=setInterval(()=>this.checkAge(generation),100);
    let reader;
    try {
      const response=await this.fetcher(url,{signal,cache:'no-store',credentials:'omit'});
      if(generation!==this.generation){await response.body?.cancel();return;}
      if(response.status===503){await response.body?.cancel();this.fail('busy','Video viewer unavailable',generation);return;}
      if(!response.ok||!response.body)throw Error('Video HTTP '+response.status);
      const parser=new MjpegParser(streamBoundary(response.headers.get('content-type')));
      reader=response.body.getReader();
      while(generation===this.generation) {
        const {done,value}=await reader.read();if(done)throw Error('Video stream ended');
        if(generation!==this.generation)break;
        const jpeg=parser.push(value);
        if(jpeg){this.pending={jpeg,receivedAt:this.now(),generation};void this.drain();}
        if(parser.ended)throw Error('Video stream ended');
      }
    }catch(error){if(generation===this.generation&&!signal.aborted)this.fail('error',String(error.message||error),generation);}
    finally {try{await reader?.cancel();}catch{}try{reader?.releaseLock();}catch{}}
  }
  async drain() {
    if(this.decoding)return;this.decoding=true;
    try {
      while(this.pending) {
        const frame=this.pending;this.pending=null;let bitmap;
        try {
          bitmap=await this.decode(new Blob([frame.jpeg],{type:'image/jpeg'}));
          if(frame.generation!==this.generation||this.now()-frame.receivedAt>this.freshMs)continue;
          if(!bitmap.width||!bitmap.height||bitmap.width>8192||bitmap.height>8192)throw Error('Invalid decoded dimensions');
          // Present the newest completed decode while it is still fresh.
          // Dropping it merely because another frame is pending starves the
          // display whenever network arrivals outrun decoding. The pending
          // slot still keeps only the latest frame, so no backlog accumulates.
          this.onFrame(bitmap);this.frameAt=frame.receivedAt;++this.frames;this.emit('live');
        }catch(error){this.fail('decode-error',String(error.message||error),frame.generation);}
        finally {bitmap?.close?.();}
      }
    } finally {this.decoding=false;}
  }
}
