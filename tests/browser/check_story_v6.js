async page=>{
 const results=[],errors=[],check=(name,value,detail)=>{if(!value)throw Error(name+': '+JSON.stringify(detail));results.push({name,status:'PASS',detail});};
 page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:8765/presentation/');await page.waitForFunction(()=>window.__careRover);
 const seek=t=>page.evaluate(t=>window.__careRover.seek(t),t),snap=()=>page.evaluate(()=>window.__careRover.snapshot());
 await seek(3);const original=await snap();check('hero sensor face points to CAD -X',original.sensors.camera.forward[0]<-.999&&original.sensors.ultrasonic.forward[0]<-.999);
 check('four wheels and four saved servo instances',original.instances.filter(n=>n.id==='wheel').length===4&&original.instances.filter(n=>n.id==='servo').length===4);
 await seek(16);const open=await snap();await seek(145);await seek(16);check('seek forwards/backwards restores exact CAD-derived transforms',JSON.stringify((await snap()).instances)===JSON.stringify(open.instances));
 await seek(117);let s=await snap();const distance=Math.hypot(...s.indexTip.map((v,i)=>v-s.contact[i]));check('anatomical fingertip within 10 mm of sensor contact anchor',distance<.01,{metres:distance});
 await seek(124);check('shared contact event renders simulated OLED result',(await page.locator('#beat').textContent()).includes('72 BPM'));await seek(128);check('release clears simulated readings',!(await page.locator('#beat').textContent()).includes('72'));
 await page.evaluate(()=>window.__careRover.enterInspect());await page.waitForTimeout(120);s=await snap();check('Inspect enters assembled and paused',s.open===0&&s.mode==='inspect'&&!s.playing);
 await page.mouse.move(1050,430);await page.waitForTimeout(1200);s=await snap();check('desktop hover expands',s.open>.99);
 check('exploded groups have no positive-volume AABB penetration',!s.partBounds.some((a,i)=>s.partBounds.slice(i+1).some(b=>a.min.every((v,k)=>Math.min(a.max[k],b.max[k])-Math.max(v,b.min[k])>.0005))));
 await page.screenshot({path:'output/playwright/v6/inspect-labelled.png'});
 await page.locator('#parts [data-part="controller"]').click();await page.waitForTimeout(850);await page.mouse.move(180,620);await page.waitForTimeout(450);s=await snap();check('selection locks expanded while pointer reads explanation',s.selected==='controller-1'&&s.open===1&&s.partBounds.filter(b=>b.visible).length===1);
 check('focused part fits viewport',s.partBounds.filter(b=>b.visible).every(b=>b.projected.every(p=>Math.abs(p[0])<1&&Math.abs(p[1])<1)));
 const cameraBefore=s.camera;await page.mouse.move(900,400);await page.mouse.down();await page.mouse.move(1250,770,{steps:12});await page.mouse.up();s=await snap();check('drag rotates selected component, including underneath',JSON.stringify(s.camera)!==JSON.stringify(cameraBefore));
 await page.locator('#inspectReset').click();await page.waitForTimeout(850);check('reset restores full assembly', (await snap()).open===0&&(await snap()).instances.every(n=>n.visible));
 await page.locator('#leaveInspect').click();await page.waitForTimeout(100);check('Inspect returns to saved semantic time',Math.abs((await snap()).time-128)<.05);
 await page.locator('[data-mode="deck"]').click();await page.locator('#previous').click();await page.waitForTimeout(250);s=await snap();check('Deck owns clock and advances without scroll',s.mode==='deck'&&s.playing);
 await page.locator('#pause').click();const held=(await snap()).time;await page.waitForTimeout(250);check('pause holds timeline',Math.abs((await snap()).time-held)<.001);
 await page.setViewportSize({width:390,height:844});await seek(3);await page.screenshot({path:'output/playwright/v6/story-mobile-final.png'});check('390px story has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.evaluate(()=>window.__careRover.enterInspect());await page.locator('#expand').click();await page.waitForTimeout(950);check('explicit touch-compatible button expands', (await snap()).open>.99);await page.screenshot({path:'output/playwright/v6/inspect-mobile.png'});
 await page.locator('#leaveInspect').click();await page.setViewportSize({width:1440,height:900});await seek(3);
 check('no uncaught page exceptions',errors.length===0,errors);return results;
}
