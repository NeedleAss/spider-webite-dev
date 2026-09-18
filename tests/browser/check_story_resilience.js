async page => {
  const results=[],check=(name,ok,detail)=>{if(!ok)throw Error(name+': '+JSON.stringify(detail));results.push({name,status:'PASS',detail});};
  const cdp=await page.context().newCDPSession(page);await cdp.send('Network.clearBrowserCache');
  await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:1440,height:900});
  await page.goto('http://127.0.0.1:8765/presentation/#vision');await page.waitForFunction(()=>window.__careRover?.snapshot().ready);
  await page.evaluate(()=>{const s=document.getElementById('vision');scrollTo({top:s.offsetTop+s.offsetHeight*.81,behavior:'instant'});});await page.waitForTimeout(350);
  const before=await page.evaluate(()=>window.__careRover.snapshot());
  await page.reload();await page.waitForFunction(()=>window.__careRover?.snapshot().ready);await page.waitForTimeout(350);
  const reloaded=await page.evaluate(()=>window.__careRover.snapshot());check('reload restores exact chapter progress',reloaded.index===before.index&&Math.abs(reloaded.progress-before.progress)<.003,{before:before.progress,after:reloaded.progress});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);const resized=await page.evaluate(()=>window.__careRover.snapshot());check('resize preserves chapter progress',resized.index===before.index&&Math.abs(resized.progress-before.progress)<.003,resized.progress);
  await page.locator('#inspect').click();await page.locator('[data-part=wheel]').click();const selected=await page.locator('#instanceLabel').textContent();
  await page.evaluate(()=>{const c=document.querySelector('canvas');for(const [type,id,x] of [['pointerdown',1,180],['pointerdown',2,230],['pointercancel',2,230],['pointerup',1,180]])c.dispatchEvent(new PointerEvent(type,{pointerId:id,clientX:x,clientY:250,bubbles:true,pointerType:'touch'}));});
  check('multi-pointer cancellation does not select a different instance',await page.locator('#instanceLabel').textContent()===selected);
  await page.keyboard.press('Escape');
  const perf=[];
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:width===1440?900:844});
    await page.evaluate(()=>{const s=document.getElementById('motion');scrollTo({top:s.offsetTop+s.offsetHeight*.4,behavior:'instant'});});await page.waitForTimeout(400);await page.locator('#restart').click();
    const measurement=await page.evaluate(async()=>{const samples=[],begin=performance.now(),first=window.__careRover.snapshot().draws;let last=begin;await new Promise(resolve=>{function tick(t){samples.push(t-last);last=t;if(t-begin<3000)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});const elapsed=performance.now()-begin,s=window.__careRover.snapshot();samples.sort((a,b)=>a-b);return {fps:1000*(s.draws-first)/elapsed,p95FrameMs:samples[Math.floor(samples.length*.95)],render:s.render};});
    perf.push({width,...measurement});check('emulated '+width+' viewport renders above 30 FPS on this Mac',measurement.fps>=30,measurement);
  }
  await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(350);
  for(const [id,p] of [['vision',.85],['care',.85]]){await page.evaluate(([id,p])=>{const s=document.getElementById(id);scrollTo({top:s.offsetTop+s.offsetHeight*p,behavior:'instant'});},[id,p]);await page.waitForTimeout(800);check(id+' late shot chapter',await page.evaluate(()=>document.body.dataset.chapter)===id);await page.screenshot({path:'output/playwright/v4/'+id+'-late.png'});}
  // Warm all focus materials/geometries, then verify repeated traversal does not leak renderer resources.
  const cycle=()=>page.evaluate(async()=>{for(const id of ['meet','inside','vision','range','motion','care','whole']){const s=document.getElementById(id);scrollTo({top:s.offsetTop+s.offsetHeight*.4,behavior:'instant'});await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);}return window.__careRover.snapshot().render;});
  await cycle();const warm=await cycle();for(let i=0;i<8;i++)await cycle();const end=await cycle();check('renderer resources stabilize after warm-up',warm.geometries===end.geometries&&warm.textures===end.textures,{warm,end});
  for(const failure of ['static','glb','three','webgl']){
    const ctx=await page.context().browser().newContext({viewport:{width:390,height:844}});const p=await ctx.newPage();
    if(failure==='glb')await p.route('**/carerover.glb',r=>r.abort());
    if(failure==='three')await p.route('**/three.module.js',r=>r.abort());
    if(failure==='webgl')await p.addInitScript(()=>{const base=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:base.call(this,type,...args);};});
    await p.goto('http://127.0.0.1:8765/presentation/'+(failure==='static'?'?static=1':''));await p.waitForFunction(()=>document.body.dataset.viewer==='fallback');
    await p.evaluate(()=>{const s=document.getElementById('range');scrollTo({top:s.offsetTop+s.offsetHeight*.4,behavior:'instant'});});await p.waitForTimeout(400);
    const state=await p.evaluate(()=>({chapter:document.body.dataset.chapter,loaded:document.getElementById('poster').naturalWidth>0,copy:getComputedStyle(document.querySelector('[data-active] .copy')).visibility,canvasPointer:getComputedStyle(document.getElementById('stage')).pointerEvents}));
    check(failure+' failure retains real chapter poster and readable DOM',state.chapter==='range'&&state.loaded&&state.copy==='visible'&&state.canvasPointer==='none',state);
    await p.screenshot({path:'output/playwright/v4/fallback-'+failure+'.png'});await ctx.close();
  }
  const ctx=await page.context().browser().newContext({javaScriptEnabled:false,viewport:{width:390,height:844}}),p=await ctx.newPage();await p.goto('http://127.0.0.1:8765/presentation/');check('JavaScript disabled leaves all seven headings readable',await p.locator('.copy').count()===7&&await p.locator('#whole h2').isVisible());await ctx.close();
  return {results,perf};
}
