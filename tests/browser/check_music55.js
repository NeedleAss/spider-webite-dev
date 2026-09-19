async page=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('http://127.0.0.1:8765/presentation/?review=55&revision=cut55-2');
 await page.waitForFunction(()=>window.__careRover&&document.querySelector('.review-audio audio')?.readyState>=1);
 await page.evaluate(()=>{
  window.musicPlayback={chapters:[],samples:[],errors:[]};
  window.addEventListener('error',e=>musicPlayback.errors.push(e.message));
  musicPlayback.timer=setInterval(()=>{const s=__careRover.snapshot(),a=document.querySelector('.review-audio audio');if(musicPlayback.chapters.at(-1)!==s.state){musicPlayback.chapters.push(s.state);musicPlayback.samples.push({time:s.time,audio:a.currentTime,paused:a.paused,volume:a.volume});}},100);
 });
 await page.locator('#pause').click();
 await page.waitForFunction(()=>__careRover.snapshot().time===55,{},{timeout:60000});
 const result=await page.evaluate(()=>{clearInterval(musicPlayback.timer);const a=document.querySelector('.review-audio audio');return {...musicPlayback,time:__careRover.snapshot().time,audio:a.currentTime,audioPaused:a.paused};});
 if(result.errors.length||result.chapters.length!==9||!result.audioPaused||result.time!==55)throw Error(JSON.stringify(result));
 for(const s of result.samples.slice(1))if(s.paused||Math.abs(s.audio-s.time-7.372)>.3)throw Error('Music drift: '+JSON.stringify(s));
 return result;
}
