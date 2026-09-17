async page => {
  const results=[],check=(name,value,detail)=>{if(!value)throw Error(name+': '+JSON.stringify(detail));results.push({name,status:'PASS',detail});};
  await page.addInitScript({path:'tests/browser/tracking_ws_fixture.js'});
  await page.addInitScript(()=>{const Base=window.WebSocket;window.suppressStop=true;window.WebSocket=class extends Base{constructor(...args){super(...args);window.fixtureSocket=this;}send(raw){const msg=JSON.parse(raw);if(msg.type==='estop'&&window.suppressStop){window.trackingFixture.messages.push(msg);return;}return super.send(raw);}};});
  await page.goto('http://127.0.0.1:8765/?transport=ws&video=canvas');
  await page.waitForFunction(()=>window.trackingFixture?.seq>2);
  await page.locator('#estopBtn').click();await page.waitForTimeout(150);
  let title=await page.locator('#sessionTitle').textContent();check('sent stop is locally locked and awaiting device, never physical confirmation',title.includes('本地')&&title.includes('等待'),title);
  await page.evaluate(()=>{trackingFixture.estop=true;trackingFixture.mode='ESTOP';});await page.waitForTimeout(150);
  title=await page.locator('#sessionTitle').textContent();check('fresh device telemetry is labelled device-reported',title.includes('设备已上报'),title);
  await page.evaluate(()=>{trackingFixture.silent=true;});await page.waitForTimeout(1600);
  title=await page.locator('#sessionTitle').textContent();check('stale telemetry loses device-confirmed wording',!title.includes('设备已上报'),title);
  await page.evaluate(()=>{fixtureSocket.readyState=3;});await page.locator('#estopBtn').click();await page.waitForTimeout(100);
  title=await page.locator('#sessionTitle').textContent();check('failed send retains local latch and says unconfirmed',title.includes('本地')&&title.includes('未确认'),title);
  await page.evaluate(()=>{fixtureSocket.readyState=1;trackingFixture.silent=false;fixtureSocket.emit({type:'ppg_batch',ts:Date.now()-800,sample_rate_hz:25,samples:[10,20,30,20,10]});});
  const ppg=await page.evaluate(async()=>{const s=(await import('/js/state.js')).getState();return {basis:s.ppg.timeBasis,latency:s.ppg.receivedTs-s.ppg.lastTs,latch:s.ui.estopLatch};});
  check('live PPG preserves source time through network delay',ppg.basis==='source-batch'&&ppg.latency>=790&&ppg.latch,ppg);
  const messages=[
    {at:1000000,raw:JSON.stringify({type:'telemetry',ts:1000000,robot:{mode:'ESTOP',state:'READY',estop:true},health:{finger_detected:true}})},
    {at:1000000,raw:JSON.stringify({type:'ppg_batch',ts:999800,sample_rate_hz:25,samples:[10,20,30,20,10]})},
    {at:1000650,raw:JSON.stringify({type:'ppg_batch',ts:1000500,sample_rate_hz:25,samples:[11,21,31,21,11]})}
  ];
  await page.evaluate(messages=>{const input=document.getElementById('dbgReplayInput'),transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify({version:1,messages})],'timebase-test.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));},messages);
  await page.waitForTimeout(100);const count=await page.evaluate(()=>trackingFixture.messages.length);await page.waitForTimeout(850);
  title=await page.locator('#sessionTitle').textContent();check('replay title wins over disconnected transport and recorded ESTOP',title==='会话回放',title);
  const replay=await page.evaluate(async()=>{const s=(await import('/js/state.js')).getState();const times=[];s.ppg.ring.each(-Infinity,(v,t)=>times.push(t));return {replaying:s.ui.replaying,basis:s.ppg.timeBasis,gap:times[5]-times[4],messages:trackingFixture.messages.length};});
  check('replay preserves source-time gap and sends no commands',replay.replaying&&replay.basis==='source-batch'&&Math.abs(replay.gap-540)<2&&replay.messages===count,replay);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'output/playwright/v4/console-replay-mobile.png',fullPage:true});
  check('console has no mobile horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>document.getElementById('debugPanel').open=true);await page.locator('#dbgResume').click();await page.waitForTimeout(250);
  check('return to live preserves original emergency latch',await page.evaluate(async()=>(await import('/js/state.js')).getState().ui.estopLatch));
  return results;
}
