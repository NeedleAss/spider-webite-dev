async page => {
  const seek=async(id,p=.4)=>{await page.evaluate(([id,p])=>{const s=document.getElementById(id);scrollTo({top:s.offsetTop+(id==='meet'?0:s.offsetHeight*p),behavior:'smooth'});},[id,p]);await page.waitForTimeout(1200);await page.waitForFunction(id=>document.body.dataset.chapter===id,id);};
  await page.bringToFront();
  await page.mouse.move(30,860);await seek('meet');await page.waitForTimeout(700);
  await seek('inside');await page.waitForTimeout(1100);
  await seek('vision');await page.locator('#restart').click();await page.mouse.move(30,860);await page.waitForTimeout(3800);
  await seek('vision',.85);await page.waitForTimeout(6500);
  await seek('range');await page.waitForTimeout(4000);
  await seek('motion');await page.waitForTimeout(16500);
  await seek('care');await page.waitForTimeout(2000);await seek('care',.85);await page.waitForTimeout(700);
  await seek('whole');await page.waitForTimeout(900);
  for(const id of ['care','motion','range','vision','inside','meet'])await seek(id);
  return {end:await page.evaluate(()=>window.__careRover.snapshot().index)};
}
