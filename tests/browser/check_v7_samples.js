async page=>{
 const checks=[],errors=[],requests=[];
 const check=(name,ok,detail)=>{if(!ok)throw Error(name+': '+JSON.stringify(detail));checks.push({name,status:'PASS',detail});};
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>requests.push(r.url()));
 await page.setViewportSize({width:1600,height:1000});await page.goto('http://127.0.0.1:8765/presentation/v7.html');await page.waitForFunction(()=>window.__v7);
 const seek=async t=>{await page.evaluate(t=>__v7.seek(t),t);return await page.evaluate(()=>__v7.snapshot());};
 const rest=await seek(0),expanded=await seek(5);
 check('robot loads without adult, room or V6 movie dependency',!requests.some(u=>/adult\.glb|actor\.js|studio\.js|film\.mp4/.test(u)));
 for(const pair of [['lid-1','display-3'],['camera-1','camera-mount-1'],['controller-1','board-mount-1'],['controller-1','board-frame-2']]){
  const delta=s=>s.objects.find(i=>i.id===pair[0]).position.map((v,k)=>v-s.objects.find(i=>i.id===pair[1]).position[k]);
  check('assembly relationship retained: '+pair.join(' / '),delta(rest).every((v,k)=>Math.abs(v-delta(expanded)[k])<1e-12));
 }
 const forward=[];for(const t of [0,1.7,2.6,3.5,5,6.4,8.1,10]){const s=await seek(t);forward.push([t,JSON.stringify(s.objects)]);check('default structure fits at '+t,s.objects.every(i=>i.box.projected.every(p=>Math.abs(p[0])<1&&Math.abs(p[1])<1)));}
 for(const [t,expected] of forward.reverse())check('reverse seek restores exact pose at '+t,JSON.stringify((await seek(t)).objects)===expected);
 check('close returns to original assembly',JSON.stringify((await seek(10)).objects)===JSON.stringify(rest.objects));
 await page.evaluate(()=>__v7.choose('structure'));
 await page.locator('#watch').click();await page.waitForTimeout(500);check('play advances from frame zero',(await page.evaluate(()=>__v7.snapshot())).time>.2);
 await page.locator('#play').click();const stopped=(await page.evaluate(()=>__v7.snapshot())).time;await page.waitForTimeout(220);check('pause holds exact time',(await page.evaluate(()=>__v7.snapshot())).time===stopped);
 await seek(5);for(const v of ['hero','front','side','top']){await page.evaluate(v=>__v7.view(v),v);await page.waitForTimeout(70);await page.screenshot({path:`output/playwright/v7/structure-${v}.png`});}
 await page.evaluate(()=>__v7.choose('scan'));const scan=await seek(3.2);check('scan is attached to a lit target surface',scan.event.scanActive);await page.screenshot({path:'output/playwright/v7/scan-final.png'});const locked=await seek(6);check('detection follows scan',locked.event.detected&&!locked.event.scanActive);await seek(9);check('scan and detection clear',!(await page.evaluate(()=>__v7.snapshot())).event.detected);
 await page.evaluate(()=>__v7.choose('echo'));const pre=await seek(3.5),hit=await seek(3.8),back=await seek(5.2),received=await seek(7.1);check('return begins only after geometric obstacle hit',!pre.event.hit&&hit.event.hit&&!hit.event.returning&&back.event.returning&&received.event.received);check('obstacle intersection is in front of module',hit.hit[2]>0&&Number.isFinite(hit.hit[2]));await seek(5.2);await page.screenshot({path:'output/playwright/v7/echo-final.png'});
 for(const [id,t] of [['scan',3.2],['echo',5.2]]){await page.evaluate(id=>__v7.choose(id),id);await seek(t);const first=await page.screenshot();await seek(9.5);await seek(t);const second=await page.screenshot();check(id+' identical image after reverse seek',first.equals(second));}
 await page.evaluate(()=>__v7.choose('structure'));await seek(10);await page.locator('#reverse').click();await page.waitForTimeout(350);check('reverse playback advances from last frame',(await page.evaluate(()=>__v7.snapshot())).time<9.9);
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>__v7.choose('structure'));await seek(5);check('mobile page has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));check('mobile primary controls at least 44px',await page.evaluate(()=>['play','reverse','fullscreen'].every(id=>document.getElementById(id).getBoundingClientRect().height>=44)));await page.screenshot({path:'output/playwright/v7/mobile-final.png'});
 check('no browser or shader exception',errors.length===0,errors);return checks;
}
