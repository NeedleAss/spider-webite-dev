async page => {
  const results=[],errors=[],requests=[],sockets=[];
  const check=(name,value,detail=null)=>{if(!value)throw Error(name+': '+JSON.stringify(detail));results.push({name,status:'PASS',detail});};
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('request',r=>requests.push(r.url()));page.on('websocket',ws=>sockets.push(ws.url()));
  const cdp=await page.context().newCDPSession(page);await cdp.send('Network.clearBrowserCache');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('http://127.0.0.1:8765/presentation/');await page.waitForFunction(()=>window.__careRover?.snapshot().ready);
  const seek=async(id,p=.4)=>{await page.evaluate(([id,p])=>{const s=document.getElementById(id);scrollTo({top:s.offsetTop+(id==='meet'?0:s.offsetHeight*p),behavior:'instant'});},[id,p]);await page.waitForTimeout(350);};
  const snapshot=()=>page.evaluate(()=>window.__careRover.snapshot());
  await page.locator('#pause').click();
  const first=await snapshot();check('target assembly has four wheels and four saved-placement servos',first.instances.filter(n=>n.id==='wheel').length===4&&first.instances.filter(n=>n.id==='servo').length===4);
  check('first camera is on CAD -X front',first.camera[0]<0);
  for(const [sensor,data] of Object.entries(first.sensors))check(sensor+' points outward at rest',Math.abs(data.forward[0]+1)<1e-8,data.forward);
  const dims=[{width:1440,height:900},{width:1366,height:768},{width:390,height:844},{width:844,height:390}];
  const chapters=['meet','inside','vision','range','motion','care','whole'];
  for(const viewport of dims){
    await page.setViewportSize(viewport);await page.waitForTimeout(350);
    for(const [i,id] of chapters.entries()){
      await seek(id);
      const facts=await page.evaluate(()=>{const el=document.querySelector('[data-active] .copy'),r=el.getBoundingClientRect();const nav=document.querySelector('.chapter-nav').getBoundingClientRect();const overlaps=r.left<nav.right&&r.right>nav.left&&r.top<nav.bottom&&r.bottom>nav.top;return {overflow:document.documentElement.scrollWidth>innerWidth+1,copy:[r.top,r.bottom],height:innerHeight,overlapsNav:overlaps,index:window.__careRover.snapshot().index};});
      check(`${viewport.width}x${viewport.height} / ${id} chapter, text, overflow`,!facts.overflow&&facts.index===i&&facts.copy[0]>=0&&facts.copy[1]<facts.height-12&&!facts.overlapsNav,facts);
      await page.screenshot({path:`output/playwright/v4/qa-${viewport.width}-${id}.png`});
    }
  }
  await page.setViewportSize({width:1440,height:900});await seek('inside',.5);
  const open=await snapshot();for(const [sensor,data] of Object.entries(open.sensors))check(sensor+' preserves forward when exploded',Math.abs(data.forward[0]+1)<1e-8);
  await page.evaluate(async()=>{for(let i=0;i<100;i++){const s=document.getElementById('inside');scrollTo({top:s.offsetTop+s.offsetHeight*.45,behavior:'instant'});await new Promise(requestAnimationFrame);scrollTo({top:0,behavior:'instant'});await new Promise(requestAnimationFrame);}});
  await seek('meet');const closed=await snapshot();check('100 browser open/close cycles have no rest-pose drift',JSON.stringify(closed.instances.map(n=>n.position))===JSON.stringify(first.instances.map(n=>n.position)));
  await seek('vision',.4);const before=await snapshot(),beforeY=await page.evaluate(()=>scrollY);
  await page.locator('#inspect').click();check('Inspect is explicit', (await snapshot()).mode==='inspect');
  await page.locator('[data-part=wheel]').click();const one=await page.locator('#instanceLabel').textContent();await page.locator('[data-part=wheel]').click();const two=await page.locator('#instanceLabel').textContent();check('wheel instances can be selected independently',one!==two);
  await page.keyboard.press('Escape');const after=await snapshot();check('Inspect exit restores chapter, progress and scroll',after.mode==='story'&&after.index===before.index&&Math.abs((await page.evaluate(()=>scrollY))-beforeY)<1);
  await page.emulateMedia({reducedMotion:'reduce'});await seek('vision',.4);const reduced=await snapshot();await page.waitForTimeout(250);check('reduced motion rests without continuous redraw', (await snapshot()).draws-reduced.draws<=1);
  await page.emulateMedia({reducedMotion:'no-preference'});await seek('meet');const idle=await snapshot();await page.waitForTimeout(250);check('idle hero stops drawing',(await snapshot()).draws-idle.draws<=1);
  await seek('vision',.4);await page.evaluate(()=>window.__careRover.loseContext());await page.waitForFunction(()=>document.body.dataset.viewer==='fallback');
  check('context loss retains current chapter poster',await page.locator('#poster').isVisible());
  await page.evaluate(()=>window.__careRover.restoreContext());await page.waitForFunction(()=>window.__careRover.snapshot().ready);check('context restore keeps chapter', (await snapshot()).index===2);
  await page.setViewportSize({width:390,height:844});await seek('inside',.4);
  const y=await page.evaluate(()=>scrollY);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:195,y:610}]});
  for(const yy of [570,530,490,450,400]){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:195,y:yy}]});await page.waitForTimeout(25);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(200);
  check('emulated touch from canvas centre scrolls Story',await page.evaluate(()=>scrollY)>y+30);
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});
  check('no robot WebSocket opened',sockets.length===0,sockets);
  check('no external runtime requests',requests.every(u=>u.startsWith('http://127.0.0.1:8765/')||u.startsWith('data:')||u.startsWith('blob:')));
  check('no unhandled JavaScript errors',errors.length===0,errors);
  return {browser:await page.evaluate(()=>navigator.userAgent),results,requests:[...new Set(requests)],errors};
}
