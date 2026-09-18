#!/usr/bin/env python3
"""V7 review candidate, 112s/1080p/30fps; uses production deterministic seek.
Independent hand contact clip is a 5s retiming of the same authored event.
"""
from pathlib import Path
import hashlib,json,subprocess,time,shutil
import imageio_ffmpeg
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'presentation/assets/film-v7';OUT.mkdir(exist_ok=True);BUILD=ROOT/'build/v7-production';FRAMES=BUILD/'frames';FRAMES.mkdir(exist_ok=True)
CLI=['npx','--yes','--package','@playwright/cli@0.1.20','playwright-cli','--session','v7-export','run-code'];FF=imageio_ffmpeg.get_ffmpeg_exe()
def run(code):
 r=subprocess.run(CLI+[code],cwd=ROOT,capture_output=True,text=True)
 with (BUILD/'capture.txt').open('a') as f:f.write(r.stdout+r.stderr+'\n')
 if r.returncode or '### Error' in r.stdout:raise RuntimeError(r.stdout+r.stderr)
def hashes():
 paths=[ROOT/'presentation/app.js',ROOT/'presentation/index.html',ROOT/'presentation/style.css',*sorted((ROOT/'presentation/v7').glob('*.js')),*sorted((ROOT/'presentation/scene').glob('*.js')),*sorted((ROOT/'presentation/effects').glob('*.js')),ROOT/'presentation/story/timeline.js',ROOT/'presentation/parts.js',ROOT/'presentation/assets/cad/carerover.glb',ROOT/'presentation/assets/hand/hand_demo.glb',ROOT/'presentation/assets/film/console-demo.mp4']
 return {p.relative_to(ROOT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
source=hashes()
run("async page=>{await page.route('**/*',route=>route.continue());await page.setViewportSize({width:1920,height:1080});await page.goto('http://127.0.0.1:8765/presentation/?export=1');await page.waitForFunction(()=>window.__careRover);}")
for start in range(0,3360,90):
 end=min(start+90,3360);began=time.monotonic()
 run(f'''async page=>{{for(let i={start};i<{end};i++){{await page.evaluate(t=>__careRover.seek(t),i/30);await page.screenshot({{path:`build/v7-production/frames/${{String(i).padStart(5,'0')}}.jpg`,type:'jpeg',quality:97}});}}return {{frames:{end}}};}}''')
 assert hashes()==source,'Source changed during capture'
 print('Film',end,'/3360',round(time.monotonic()-began,1),'s',flush=True)
r=subprocess.run([FF,'-y','-framerate','30','-i',str(FRAMES/'%05d.jpg'),'-i',str(BUILD/'score.wav'),'-t','112','-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart',str(OUT/'CareRover-film.mp4')],capture_output=True,text=True);(BUILD/'encode.txt').write_text(r.stderr);r.check_returncode()
shutil.copyfile(FRAMES/'00090.jpg',OUT/'poster.jpg')
# 5-second independent contact review, retimed from 80..95 seconds (no new pose engine).
hand=ROOT/'presentation/assets/hand'
r=subprocess.run([FF,'-y','-ss','80','-i',str(OUT/'CareRover-film.mp4'),'-an','-vf','setpts=PTS/3','-t','5','-r','30','-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(hand/'contact.mp4')],capture_output=True,text=True);r.check_returncode();shutil.copyfile(FRAMES/'02550.jpg',hand/'contact.jpg')
manifest={'status':'REVIEW CANDIDATE','durationSeconds':112,'width':1920,'height':1080,'fps':30,'frames':3360,'simulation':True,'renderSourceHashes':source,'audio':'Original oscillator-only ambient score; tools/film_score_v7.py','handReview':'independent user visual review pending','files':{}}
for p,expected in [(OUT/'CareRover-film.mp4',3360),(hand/'contact.mp4',150)]:
 r=subprocess.run([FF,'-v','error','-i',str(p),'-f','null','-'],capture_output=True,text=True);r.check_returncode();assert not r.stderr,r.stderr
 frames,seconds=imageio_ffmpeg.count_frames_and_secs(str(p));assert frames==expected,(frames,expected)
 manifest['files'][p.relative_to(ROOT).as_posix()]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'frames':frames,'seconds':seconds,'fullDecode':'PASS'}
manifest['files']['presentation/assets/film-v7/poster.jpg']={'sha256':hashlib.sha256((OUT/'poster.jpg').read_bytes()).hexdigest()}
(OUT/'FILM_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print('Film and independent contact study encoded and fully decoded.',flush=True)
