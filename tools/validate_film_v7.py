#!/usr/bin/env python3
"""Validate V7 render provenance/media and extract encoded review frames."""
from pathlib import Path
import json,hashlib,subprocess
import imageio_ffmpeg
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'presentation/assets/film-v7';EV=ROOT/'evidence/v7';(EV/'visual').mkdir(parents=True,exist_ok=True)
m=json.loads((OUT/'FILM_MANIFEST.json').read_text());h=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for name,sha in m['renderSourceHashes'].items():assert h(ROOT/name)==sha,name
for name,r in m['files'].items():assert h(ROOT/name)==r['sha256'],name
for name in ['CareRover-film.srt','CareRover-film.vtt','TIMELINE.json']:
 p=OUT/name;m['files'][p.relative_to(ROOT).as_posix()]={'sha256':h(p),'bytes':p.stat().st_size}
(OUT/'FILM_MANIFEST.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
film=OUT/'CareRover-film.mp4';reader=imageio_ffmpeg.read_frames(str(film));meta=next(reader);reader.close();assert meta['size']==(1920,1080) and meta['fps']==30,meta
r=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-i',str(film),'-f','null','-'],capture_output=True,text=True);r.check_returncode();assert not r.stderr,r.stderr
frames,seconds=imageio_ffmpeg.count_frames_and_secs(str(film));assert frames==3360 and abs(seconds-112)<.05
thumbs=ROOT/'build/v7-production/encoded-review';thumbs.mkdir(exist_ok=True)
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-y','-i',str(film),'-vf','fps=1/4,scale=384:216','-q:v','2',str(thumbs/'%03d.jpg')],capture_output=True,check=True)
shots=sorted(thumbs.glob('*.jpg'))
for page,start in enumerate(range(0,len(shots),16),1):
 grid=Image.new('RGB',(1536,960),'#1b2026');d=ImageDraw.Draw(grid)
 for i,p in enumerate(shots[start:start+16]):
  x=(i%4)*384;y=(i//4)*240;grid.paste(Image.open(p),(x,y));d.text((x+8,y+220),f'{(start+i)*4:03d}-{(start+i+1)*4:03d}s',fill='white')
 grid.save(EV/f'visual/encoded-contact-{page}.jpg',quality=92)
report={'status':'PASS','frames':frames,'durationSeconds':seconds,'size':meta['size'],'fps':meta['fps'],'codec':meta['codec'],'fullAudioVideoDecode':'PASS','sourceHashesVerified':len(m['renderSourceHashes']),'sha256':h(film),'visualReview':'Encoded four-second sample sheets plus browser/hand close-ups; final user visual acceptance pending.','hardware':'NOT RUN'}
(EV/'film-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report))
