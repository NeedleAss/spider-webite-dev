async page => {
  const results=[],chapters=['meet','inside','vision','range','motion','care','whole'];
  const c=await page.context().newCDPSession(page);await c.send('Network.clearBrowserCache');
  await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('http://127.0.0.1:8765/presentation/');await page.waitForFunction(()=>window.__careRover?.snapshot().ready);
  await page.locator('#pause').click();
  for(const viewport of [{width:1440,height:900},{width:1366,height:768},{width:390,height:844},{width:844,height:390}]){
    await page.setViewportSize(viewport);await page.waitForTimeout(350);
    for(const [i,id] of chapters.entries())for(const [label,p] of [['start',.01],['middle',.4],['end',.9]]){
      await page.evaluate(([id,p])=>{const s=document.getElementById(id);scrollTo({top:s.offsetTop+s.offsetHeight*p,behavior:'instant'});},[id,p]);await page.waitForTimeout(300);
      const state=await page.evaluate(()=>window.__careRover.snapshot());if(state.index!==i)throw Error('Wrong milestone '+id);
      const file=`milestone-${viewport.width}-${id}-${label}.png`;await page.screenshot({path:'output/playwright/v4/'+file});results.push({viewport,id,label,progress:state.progress,file,render:state.render});
    }
  }
  return results;
}
