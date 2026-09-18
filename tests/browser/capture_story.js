async page => {
  const c=await page.context().newCDPSession(page);await c.send('Network.clearBrowserCache');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('http://127.0.0.1:8765/presentation/');await page.waitForFunction(()=>window.__careRover?.snapshot().ready);
  const chapters=['meet','inside','vision','range','motion','care','whole'];
  const results=[];
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    await page.setViewportSize(viewport);await page.waitForTimeout(350);
    for(const id of chapters){
      await page.evaluate(id=>{const s=document.getElementById(id);scrollTo({top:s.offsetTop+(id==='meet'?0:s.offsetHeight*.4),behavior:'instant'});},id);
      await page.waitForTimeout(200);
      const suffix=viewport.width===390?'-mobile':'';
      const active=await page.evaluate(()=>window.__careRover.snapshot().index);if(active!==chapters.indexOf(id))throw Error('Wrong chapter before capture: '+id);
      const style=await page.addStyleTag({content:'.copy,.scene-note,.header,.chapter-nav,.footer{visibility:hidden!important}'});
      const clip=await page.evaluate(()=>{const r=document.getElementById('stage').getBoundingClientRect();const x=Math.max(0,r.x),y=Math.max(0,r.y);return {x,y,width:Math.min(innerWidth,r.right)-x,height:Math.min(innerHeight,r.bottom)-y};});
      await page.screenshot({path:`presentation/assets/appearance/${id}${suffix}.png`,clip});await style.evaluate(el=>el.remove());
      if(await page.evaluate(()=>window.__careRover.snapshot().index)!==active)throw Error('Capture changed chapter');
      await page.screenshot({path:`output/playwright/v4/${id}${suffix}-poster-frame.png`});
      results.push({id,viewport,state:await page.evaluate(()=>window.__careRover.snapshot())});
    }
  }
  await page.emulateMedia({reducedMotion:'no-preference'});
  return results.map(r=>({id:r.id,viewport:r.viewport,render:r.state.render}));
}
