#!/usr/bin/env python3
"""Capture three approved-for-review studies, not a replacement long film.
Requires the local HTTP server and Playwright CLI session v7-export.
Intermediate frames stay in ignored build/v7; no robot connection.
"""
from pathlib import Path
import hashlib,json,subprocess,time,shutil
import imageio_ffmpeg
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'presentation/v7-media';OUT.mkdir(exist_ok=True)
cli=['npx','--yes','--package','@playwright/cli@0.1.20','playwright-cli','--session','v7-export','run-code']
def run(code):
 r=subprocess.run(cli+[code],cwd=ROOT,capture_output=True,text=True)
 with (ROOT/'build/v7/capture.log').open('a') as f:f.write(r.stdout+r.stderr+'\n')
 if r.returncode or '### Error' in r.stdout:raise RuntimeError(r.stdout+r.stderr)
def hashes():
 paths=[ROOT/'presentation/v7.html',*sorted((ROOT/'presentation/v7').glob('*')),*sorted((ROOT/'presentation/scene').glob('*.js')),*sorted((ROOT/'presentation/effects').glob('*.js')),ROOT/'presentation/story/timeline.js',ROOT/'presentation/assets/cad/carerover.glb']
 return {p.relative_to(ROOT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in paths if p.is_file()}
source=hashes();manifest={'status':'REVIEW CANDIDATE','sourceHashes':source,'simulation':True,'audio':'silent visual studies','longFilmProduced':False,'clips':[]}
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
for shot,poster in [('structure',150),('scan',96),('echo',156)]:
 frames=ROOT/f'build/v7/frames-{shot}';frames.mkdir(exist_ok=True)
 run(f"async page=>{{await page.setViewportSize({{width:1920,height:1080}});await page.goto('http://127.0.0.1:8765/presentation/v7.html?export=1&shot={shot}');await page.waitForFunction(()=>window.__v7);}}")
 for start in range(0,300,60):
  end=start+60;began=time.monotonic()
  run(f'''async page=>{{for(let i={start};i<{end};i++){{await page.evaluate(t=>__v7.seek(t),i/30);await page.screenshot({{path:`build/v7/frames-{shot}/${{String(i).padStart(4,'0')}}.jpg`,type:'jpeg',quality:97}});}}return {{shot:'{shot}',frames:{end}}};}}''')
  print(shot,end,'/300',round(time.monotonic()-began,1),'s',flush=True)
 assert hashes()==source,'Sources changed during capture'
 path=OUT/f'{shot}.mp4'
 r=subprocess.run([ffmpeg,'-y','-framerate','30','-i',str(frames/'%04d.jpg'),'-frames:v','300','-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(path)],capture_output=True,text=True);(ROOT/f'build/v7/{shot}-encode.txt').write_text(r.stderr);r.check_returncode()
 check=subprocess.run([ffmpeg,'-v','error','-i',str(path),'-f','null','-'],capture_output=True,text=True);check.check_returncode();assert not check.stderr,check.stderr
 count,seconds=imageio_ffmpeg.count_frames_and_secs(str(path));assert count==300 and abs(seconds-10)<.05,(count,seconds)
 shutil.copyfile(frames/f'{poster:04d}.jpg',OUT/f'{shot}.jpg')
 manifest['clips'].append({'file':path.name,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'frames':count,'seconds':seconds,'width':1920,'height':1080,'fps':30,'fullDecode':'PASS'})
 (OUT/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('All three samples encoded and fully decoded.',flush=True)
