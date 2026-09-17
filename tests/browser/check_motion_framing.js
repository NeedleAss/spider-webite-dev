async page=>{
  const c=await page.context().newCDPSession(page);await c.send('Network.clearBrowserCache');
  await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('http://127.0.0.1:8765/presentation/');await page.waitForFunction(()=>window.__careRover?.snapshot().ready);await page.bringToFront();
  const results=[];
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    await page.setViewportSize(viewport);await page.waitForTimeout(350);
    await page.evaluate(()=>{const s=document.getElementById('motion');scrollTo({top:s.offsetTop+s.offsetHeight*.4,behavior:'instant'});});await page.waitForTimeout(350);await page.locator('#restart').click();
    const bounds=[];
    for(let i=0;i<34;i++){
      await page.waitForTimeout(500);const s=await page.evaluate(()=>window.__careRover.snapshot()),b=s.projectedRobotBounds;
      if(b.min.some(x=>x<-.98)||b.max.some(x=>x>.98)||(viewport.width===1440&&b.min[1]<-.80))throw Error('Motion is cropped: '+JSON.stringify({viewport,time:s.clock,bounds:b}));
      bounds.push({time:s.clock,...b});
      if(i===20)await page.screenshot({path:`output/playwright/v4/motion-turn-${viewport.width}.png`});
    }
    results.push({name:`Full motion stays inside ${viewport.width} viewport`,status:'PASS',viewport,bounds});
  }
  return results;
}
