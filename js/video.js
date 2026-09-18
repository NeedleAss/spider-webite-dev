import { VideoOverlay, computeContainFit, roundRect } from './video-overlay.js';
import { streamUrl } from './protocol.js';
import { defaultStreamUrl } from './transport.js';
import { MjpegStream } from './mjpeg.js';
/** Direct CAM stream. Decoded frame arrival is independent of UART metadata. */
export class VideoPanel {
  constructor({stage,source,overlay,image,video,select,input,openFile,retry,notice,onState}) {
    Object.assign(this,{stage,source,image,video,select,input,openFile,retry,notice,onState});
    this.overlay=new VideoOverlay(overlay,stage);this.ctx=source.getContext('2d');
    this.lastFrame=document.createElement('canvas');this.frameCtx=this.lastFrame.getContext('2d');
    this.streamUrl=null;this.streamConnected=false;this.kind='none';this.ready=false;this.objectUrl=null;
    this.generation=0;this.status='idle';this.retryCount=0;this.retryTimer=null;this.fileAbort=null;
    this.abort=new AbortController();const signal=this.abort.signal;
    this.stream=new MjpegStream({onFrame:bitmap=>{
      if(this.lastFrame.width!==bitmap.width||this.lastFrame.height!==bitmap.height){this.lastFrame.width=bitmap.width;this.lastFrame.height=bitmap.height;}
      this.frameCtx.drawImage(bitmap,0,0);
    },onState:state=>{
      this.ready=state.status==='live';this.setStatus(state.status);
      if(this.ready)this.retryCount=0;
      else if(['error','stale','decode-error'].includes(state.status))this.scheduleRetry();
    }});
    select.addEventListener('change',()=>this.setSource(select.value),{signal});
    retry?.addEventListener('click',()=>{this.retryCount=0;this.connectStream();},{signal});
    openFile.addEventListener('click',()=>input.click(),{signal});
    input.addEventListener('change',()=>{const file=input.files[0];input.value='';if(file)this.openClip(file);},{signal});
    this.setSource('none');
  }
  setStatus(status) {
    const changed=this.status!==status;this.status=status;this.stage.dataset.videoStatus=status;
    if(this.retry){this.retry.hidden=this.kind!=='mjpeg'||['live','connecting'].includes(status);this.retry.disabled=!this.streamConnected;}
    if(changed)this.onState?.({status,kind:this.kind});
  }
  setSource(kind) {
    if(!['none','canvas','mjpeg','file'].includes(kind))kind='none';
    ++this.generation;this.fileAbort?.abort();this.fileAbort=null;
    clearTimeout(this.retryTimer);this.retryTimer=null;this.retryCount=0;this.stream.stop();
    this.video.pause();this.video.removeAttribute('src');this.video.load();this.image.removeAttribute('src');
    if(this.objectUrl){URL.revokeObjectURL(this.objectUrl);this.objectUrl=null;}
    this.kind=kind;this.ready=kind==='canvas';this.select.value=kind;
    this.lastFrame.width=1;this.lastFrame.height=1;
    this.openFile.hidden=kind!=='file';this.source.hidden=kind==='file';this.image.hidden=true;this.video.hidden=kind!=='file';
    this.stage.dataset.source=kind;
    this.setStatus(kind==='canvas'?'simulation':kind==='file'?'file-waiting':'idle');
    this.onState?.({status:'source-changed',kind});
    if(kind==='mjpeg')this.connectStream();
  }
  openClip(file) {
    this.setSource('file');const generation=this.generation;
    const url=URL.createObjectURL(file);this.objectUrl=url;
    this.fileAbort=new AbortController();const signal=this.fileAbort.signal;
    const current=()=>generation===this.generation&&this.kind==='file'&&this.objectUrl===url;
    this.video.addEventListener('loadeddata',()=>{if(current()){this.ready=true;this.setStatus('file');}},{signal});
    this.video.addEventListener('error',()=>{if(current()){this.ready=false;this.setStatus('error');}},{signal});
    this.video.src=url;this.video.play().catch(()=>{if(current()){this.ready=false;this.setStatus('error');}});
  }
  setStreamUrl(url) {const next=url||null;if(next===this.streamUrl)return;this.streamUrl=next;if(this.kind==='mjpeg')this.connectStream();}
  scheduleRetry() {
    if(this.retryTimer||this.kind!=='mjpeg'||!this.streamConnected||this.retryCount>=3)return;
    const generation=this.generation;const delay=1000*2**this.retryCount++;
    this.retryTimer=setTimeout(()=>{this.retryTimer=null;if(generation===this.generation)this.connectStream();},delay);
  }
  connectStream() {
    clearTimeout(this.retryTimer);this.retryTimer=null;this.stream.stop();this.ready=false;
    if(this.kind!=='mjpeg')return;
    if(!this.streamConnected){this.setStatus('disconnected');return;}
    const url=streamUrl(new URLSearchParams(location.search).get('stream'),this.streamUrl,defaultStreamUrl());
    void this.stream.start(url);
  }
  connection(connected) {
    if(this.streamConnected===connected)return;this.streamConnected=connected;
    if(this.kind==='mjpeg')this.connectStream();
  }
  render(vision,flags) {
    if(this.kind==='canvas')this.drawScene(vision,flags.personStale);
    else if(this.kind!=='file')this.drawFrame();
    // UART detections have no common frame id with MJPEG. They are explicitly
    // labelled asynchronous estimates, and never survive stale video frames.
    let mapped=vision;
    const width=this.kind==='file'?this.video.videoWidth:this.kind==='mjpeg'?this.lastFrame.width:vision.image_width;
    const height=this.kind==='file'?this.video.videoHeight:this.kind==='mjpeg'?this.lastFrame.height:vision.image_height;
    if(width>1&&height>1){const sx=width/vision.image_width,sy=height/vision.image_height,p=vision.person;
      mapped={...vision,image_width:width,image_height:height,person:p?.found?{...p,x:p.x*sx,y:p.y*sy,w:p.w*sx,h:p.h*sy}:p};}
    this.overlay.render(mapped,{...flags,personStale:flags.personStale||!this.ready||this.kind==='file',gestureStale:flags.gestureStale||!this.ready||this.kind==='file',showGuide:flags.showGuide&&this.ready});
  }
  drawFrame() {
    const box=this.stage.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),ctx=this.ctx;
    const w=Math.round(box.width*dpr),h=Math.round(box.height*dpr);
    if(this.source.width!==w||this.source.height!==h){this.source.width=w;this.source.height=h;}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#111417';ctx.fillRect(0,0,box.width,box.height);
    if(this.lastFrame.width>1){const fit=computeContainFit(this.lastFrame.width,this.lastFrame.height,box.width,box.height);
      ctx.globalAlpha=this.ready?1:.25;ctx.drawImage(this.lastFrame,fit.ox,fit.oy,this.lastFrame.width*fit.scale,this.lastFrame.height*fit.scale);ctx.globalAlpha=1;}
  }
  drawScene(vision, stale) {
    const { source: canvas, ctx, stage } = this;
    const box = stage.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(box.width * dpr) || canvas.height !== Math.round(box.height * dpr)) {
      canvas.width = Math.round(box.width * dpr); canvas.height = Math.round(box.height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = box.width, H = box.height, iw = vision.image_width, ih = vision.image_height;
    ctx.fillStyle = '#171a1b'; ctx.fillRect(0, 0, W, H);
    const f = computeContainFit(iw, ih, W, H);
    ctx.save(); ctx.translate(f.ox, f.oy); ctx.scale(f.scale, f.scale);
    ctx.beginPath(); ctx.rect(0, 0, iw, ih); ctx.clip();
    const wall = ctx.createLinearGradient(0, 0, iw, ih); wall.addColorStop(0, '#777c7b'); wall.addColorStop(.65, '#42494a'); wall.addColorStop(1, '#242d30');
    ctx.fillStyle = wall; ctx.fillRect(0, 0, iw, ih);
    // Architectural room: a broad light aperture and a quiet receding floor.
    ctx.fillStyle = '#9ba5a1'; ctx.fillRect(iw * .09, ih * .1, iw * .18, ih * .48);
    const light = ctx.createLinearGradient(0, 0, iw * .4, 0); light.addColorStop(0, '#c2c8c0'); light.addColorStop(1, '#929e98');
    ctx.fillStyle = light; ctx.fillRect(iw * .10, ih * .11, iw * .16, ih * .46);
    ctx.strokeStyle = 'rgba(29,39,37,.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(iw * .18, ih * .11); ctx.lineTo(iw * .18, ih * .57); ctx.stroke();
    ctx.fillStyle = '#434c4c'; ctx.beginPath(); ctx.moveTo(0, ih * .72); ctx.lineTo(iw, ih * .67); ctx.lineTo(iw, ih); ctx.lineTo(0, ih); ctx.fill();
    ctx.strokeStyle = 'rgba(200,215,210,.10)'; ctx.lineWidth = .5;
    for (let n = -3; n < 8; n++) { ctx.beginPath(); ctx.moveTo(iw * .55, ih * .66); ctx.lineTo(n * iw / 4, ih); ctx.stroke(); }
    ctx.fillStyle = '#303839'; roundRect(ctx, iw * .77, ih * .54, iw * .15, ih * .13, 2); ctx.fill();
    ctx.fillStyle = '#8c9690'; ctx.fillRect(iw * .76, ih * .53, iw * .17, ih * .012);
    const p = vision.person;
    if (p?.found && !stale) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(p.w / 100, p.h / 220);
      ctx.fillStyle = 'rgba(5,12,14,.25)'; ctx.beginPath(); ctx.ellipse(50, 216, 46, 4, 0, 0, Math.PI * 2); ctx.fill();
      const suit = ctx.createLinearGradient(15, 0, 85, 0); suit.addColorStop(0, '#27343b'); suit.addColorStop(.55, '#48585d'); suit.addColorStop(1, '#26353c');
      ctx.fillStyle = suit;
      roundRect(ctx, 28, 47, 44, 97, 17); ctx.fill();
      roundRect(ctx, 11, 54, 15, 82, 7); ctx.fill(); roundRect(ctx, 74, 54, 15, 82, 7); ctx.fill();
      roundRect(ctx, 29, 132, 19, 83, 7); ctx.fill(); roundRect(ctx, 53, 132, 19, 83, 7); ctx.fill();
      ctx.fillStyle = '#acaaa0'; ctx.beginPath(); ctx.ellipse(50, 24, 16, 21, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#263137'; ctx.beginPath(); ctx.ellipse(50, 15, 16, 13, 0, Math.PI, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    const shade = ctx.createLinearGradient(0, 0, 0, ih); shade.addColorStop(0, 'rgba(5,10,12,.12)'); shade.addColorStop(.7, 'rgba(5,10,12,0)'); shade.addColorStop(1, 'rgba(5,10,12,.35)');
    ctx.fillStyle = shade; ctx.fillRect(0, 0, iw, ih); ctx.restore();
  }
  destroy(){++this.generation;clearTimeout(this.retryTimer);this.fileAbort?.abort();this.stream.stop();this.abort.abort();this.overlay.destroy();this.video.pause();this.image.removeAttribute('src');if(this.objectUrl)URL.revokeObjectURL(this.objectUrl);}
}
