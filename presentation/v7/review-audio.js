// Review-only local audition. Files remain in this browser; no upload or export.
export function mountReviewAudio(api){
 if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname)){
  const panel=document.createElement('details');panel.className='review-audio';
  panel.innerHTML='<summary>55 秒产品影片</summary><p>交互展示可自由浏览；观看含配乐的最终影片：</p><a href="assets/film-final/CareRover_Final_55s_1080p.mp4" target="_blank" rel="noopener">播放最终影片 ↗</a>';
  document.body.append(panel);return {sync(){}};
 }

 const panel=document.createElement('details');panel.className='review-audio';
 panel.innerHTML='<summary>55 秒审核版 · 配乐试听</summary><p>已载入你提供的配乐。起点可调整，也可更换音频。</p><label>背景音乐<input type="file" accept="audio/*" id="reviewMusic"></label><label>音乐起点（秒）<input id="musicOffset" type="number" min="0" step="0.001" value="7.372"></label><button id="audition" disabled>从头试听</button><p id="musicStatus" role="status">正在载入配乐 · 最终 MP4 待审核</p>';
 document.body.append(panel);
 const audio=new Audio(),file=panel.querySelector('#reviewMusic'),offset=panel.querySelector('#musicOffset'),button=panel.querySelector('#audition'),status=panel.querySelector('#musicStatus');
 audio.hidden=true;panel.append(audio);
 let url=null,wanted=false,loaded=false,failed=false,selection=0;
 file.addEventListener('change',()=>{selection++;audio.pause();wanted=false;loaded=false;failed=false;button.disabled=true;if(url)URL.revokeObjectURL(url);const f=file.files[0];if(!f)return;url=URL.createObjectURL(f);audio.src=url;audio.load();status.textContent=f.name+' · 读取中';});
 audio.addEventListener('loadedmetadata',()=>{loaded=true;button.disabled=false;status.textContent='音频已就绪 · 选择起点后试听';});
 audio.addEventListener('error',()=>{loaded=false;button.disabled=true;status.textContent='配乐未能载入，可选择本地 MP3 / WAV / M4A。';});
 button.addEventListener('click',async()=>{failed=false;await api.seek(0);audio.currentTime=Number(offset.value)||0;try{await audio.play();api.setMode('film');}catch{status.textContent='浏览器未能播放音频，请检查文件或重新试听。';}});
 function sync(time,playing){
  if(!loaded)return;
  const cue=Math.max(0,Number(offset.value)||0),at=cue+time,play=playing&&at<audio.duration;
  if(Math.abs(audio.currentTime-Math.min(at,audio.duration))>.18)audio.currentTime=Math.min(at,audio.duration);
  audio.volume=.7*Math.min(1,time/.5,Math.max(0,(55-time)/1.5));
  if(play&&!wanted&&!failed)audio.play().catch(()=>{failed=true;status.textContent='点击“从头试听”开启配乐。';});
  if(!play)audio.pause();wanted=play;
  if(!failed)status.textContent=audio.duration-cue<55?'所选起点后的音乐不足 55 秒，请前移起点。':'本地试听 · 起点 '+cue.toFixed(1)+' 秒 · 未导出';
 }
 // Blob URLs make seek reliable even on simple local servers without HTTP Range.
 fetch('assets/music-local/review.m4a').then(r=>{if(!r.ok)throw Error('Missing local soundtrack');return r.blob();}).then(blob=>{if(selection)return;url=URL.createObjectURL(blob);audio.dataset.source='provided-m4a';audio.src=url;audio.load();}).catch(()=>{if(!selection)status.textContent='请选择本地音频后试听。';});
 return {sync};
}
