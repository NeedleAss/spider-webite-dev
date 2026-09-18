async page=>{
 const checks=[],errors=[],warnings=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));page.on('console',m=>{if(m.type()==='warning')warnings.push(m.text());});
 const ok=(name,value,detail)=>{checks.push({name,pass:!!value,detail});if(!value)throw Error(name+' '+JSON.stringify(detail));};
 await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:8765/presentation/');await page.waitForFunction(()=>window.__careRover);
 const api=(method,...args)=>page.evaluate(([m,a])=>__careRover[m](...a),[method,args]),snap=()=>api('snapshot');
 await api('seek',12);const story=(await snap()).instances;
 await api('enterInspect');ok('Inspect enters assembled',(await snap()).open===0);
 await api('expand',1);await page.waitForFunction(()=>__careRover.snapshot().open===1&&!__careRover.snapshot().flight);
 const expanded=(await snap()).instances;ok('Story and Inspect use exactly the same complete assembly pose',JSON.stringify(story)===JSON.stringify(expanded));
 await api('expand',0);await page.waitForFunction(()=>__careRover.snapshot().open===0&&!__careRover.snapshot().flight);const closed=(await snap()).instances;
 await api('expand',1);await page.waitForFunction(()=>__careRover.snapshot().open===1);await api('expand',0);await page.waitForFunction(()=>__careRover.snapshot().open===0);ok('Repeated assembly returns to exact rest',JSON.stringify((await snap()).instances)===JSON.stringify(closed));
 const canvas=page.locator('#stage canvas'),b=await canvas.boundingBox();await page.mouse.move(10,10);await page.mouse.move(b.x+b.width*.6,b.y+b.height*.3);await page.waitForFunction(()=>__careRover.snapshot().open>.9);ok('Fine pointer hover opens structure',true);
 await api('selectPart','camera');await page.waitForFunction(()=>!__careRover.snapshot().flight);let s=await snap();ok('Camera retains mount context',s.instances.some(i=>i.id==='camera-mount'&&i.visible));
 await api('isolate');s=await snap();ok('Explicit isolate shows only selected instance',s.instances.filter(i=>i.visible).length===1);
 await api('isolate');await page.mouse.move(120,300);await page.waitForTimeout(600);s=await snap();ok('Selected part stays pinned over panel',s.open===1&&s.selected==='camera-1');
 await api('selectPart','health');await page.mouse.move(b.x+b.width*.6,b.y+b.height*.4);await page.mouse.down();await page.mouse.move(b.x+b.width*.6+80,b.y+b.height*.4+90,{steps:8});await page.mouse.up();ok('Drag interrupts automatic camera flight',!(await snap()).flight);
 await api('clearSelection');await page.waitForFunction(()=>!__careRover.snapshot().flight);await page.screenshot({path:'output/playwright/v7/inspect-overview-final.png'});
 await api('leaveInspect');s=await snap();ok('Exit restores prior story time paused',s.time===12&&!s.playing);
 for(const t of [0,9,12,16,22,24,33,35,41,48,53,59,64,69,76,78,81,85,91,94,109]){
  await api('seek',t);const a=(await snap()).instances;await api('seek',111-t);await api('seek',t);ok('Deterministic assembly/rotation at '+t,JSON.stringify((await snap()).instances)===JSON.stringify(a));
 }
 for(const t of [22,33,85,91]){await api('seek',t);const a=await canvas.screenshot();await api('seek',109);await api('seek',t);ok('Reverse seek reproduces rendered sensor/hand frame '+t,a.equals(await canvas.screenshot()));}
 for(const t of [83,84.25,87,90,92.9]){await api('seek',t);s=await snap();ok('Baked pad holds sensor surface at '+t,Math.hypot(...s.hand.pad.map((v,i)=>v-s.contact[i]))<.00001);}
 await api('seek',59);ok('One gesture symbol at a time',await page.locator('.gesture-symbols svg:visible').count()===1);
 await api('setMode','deck');await api('seek',22);await page.locator('#next').click();await page.waitForFunction(()=>__careRover.snapshot().time>28);ok('Deck next chapter plays correct segment',(await snap()).time<38);
 await page.locator('#pause').click();const before=(await snap()).time;await page.waitForTimeout(300);ok('Pause holds exact time',(await snap()).time===before);
 await page.keyboard.press('ArrowDown');ok('Keyboard down advances from a focused transport button',(await snap()).time>=38);await page.locator('#pause').click();
 await api('seek',100);await page.frameLocator('#consolePreview').locator('#sessionTitle').waitFor({state:'attached',timeout:8000});await page.waitForTimeout(700);ok('Production console iframe uses mock transport',await page.locator('#consolePreview').getAttribute('src')==='../?transport=mock&video=canvas');ok('Embedded production console is visibly scaled',(await page.locator('#consolePreview').boundingBox()).width>400);await page.screenshot({path:'output/playwright/v7/console-live.png'});
 await api('seek',109);ok('Leaving console stops embedded simulation',await page.locator('#consolePreview').getAttribute('src')==='about:blank');
 await page.setViewportSize({width:390,height:844});await api('seek',0);ok('Mobile has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'output/playwright/v7/mobile-main.png'});
 await api('enterInspect');await page.locator('#expand').click();await page.waitForFunction(()=>__careRover.snapshot().open===1);ok('Mobile explicit expand works',true);await page.screenshot({path:'output/playwright/v7/mobile-inspect.png'});
 await api('reset');await page.waitForFunction(()=>__careRover.snapshot().open===0);await api('selectPart','health');await page.waitForFunction(()=>!__careRover.snapshot().flight);ok('Direct selection from assembled state labels collapse correctly',await page.locator('#expand').textContent()==='收拢整机');ok('Mobile selection gives detail priority',await page.locator('#parts').isHidden()&&await page.locator('#partDescription').isVisible());await page.screenshot({path:'output/playwright/v7/mobile-detail.png'});
 await api('leaveInspect');await api('loseContext');await page.waitForFunction(()=>document.body.dataset.viewer==='fallback');ok('Context failure offers new offline film',await page.locator('#loadStatus a').getAttribute('href')==='assets/film-v7/CareRover-film.mp4');await api('restoreContext');await page.waitForFunction(()=>document.body.dataset.viewer==='ready');ok('Context recovers',true);ok('Restoration does not delete resources from old context',!warnings.some(s=>s.includes('INVALID_OPERATION')),warnings);
 ok('No legacy person / room / old film loaded',!requests.some(u=>/adult\.glb|actor\.js|studio\.js|assets\/film\/CareRover-film/.test(u)));ok('No uncaught browser errors',errors.length===0,errors);
 return {checks,total:checks.length,errors};
}
