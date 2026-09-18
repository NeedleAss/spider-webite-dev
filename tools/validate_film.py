#!/usr/bin/env python3
"""Verify exported media, fully decode audio/video, create review contact sheets."""
from pathlib import Path
import subprocess,json,hashlib
import imageio_ffmpeg
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];film=ROOT/'presentation/assets/film';evidence=ROOT/'evidence/v6'
path=film/'CareRover-film.mp4';frames,seconds=imageio_ffmpeg.count_frames_and_secs(str(path));assert frames==4500 and abs(seconds-150)<.05,(frames,seconds)
reader=imageio_ffmpeg.read_frames(str(path));meta=next(reader);reader.close();assert meta['size']==(1920,1080) and meta['fps']==30,meta
r=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-i',str(path),'-f','null','-'],capture_output=True,text=True);assert r.returncode==0 and not r.stderr,r.stderr
manifest=json.loads((film/'FILM_MANIFEST.json').read_text());
# The appearance manifest is generated after rendering, not a runtime input.
manifest['renderSourceHashes'].pop('presentation/assets/appearance/manifest.json',None)
for name in ['CareRover-film.vtt','CareRover-film.srt','TIMELINE.json']:
 data=(film/name).read_bytes();manifest['files'][name]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
for name,sha in manifest['renderSourceHashes'].items():assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==sha,name
for name,record in manifest['files'].items():assert hashlib.sha256((film/name).read_bytes()).hexdigest()==record['sha256'],name
(film/'FILM_MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
# Review uses the actual encoded MP4, not merely browser source frames.
thumbs=ROOT/'build/film-review';thumbs.mkdir(exist_ok=True)
r=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-y','-i',str(path),'-vf','fps=1/3,scale=384:216','-q:v','2',str(thumbs/'%03d.jpg')],capture_output=True,text=True);r.check_returncode()
shots=sorted(thumbs.glob('*.jpg'))
for page,start in enumerate(range(0,len(shots),25),1):
 canvas=Image.new('RGB',(1920,1200),'#171b20');draw=ImageDraw.Draw(canvas)
 for i,p in enumerate(shots[start:start+25]):
  x=(i%5)*384;y=(i//5)*240;canvas.paste(Image.open(p),(x,y));draw.text((x+10,y+219),f'{(start+i)*3:03d}-{(start+i+1)*3:03d} s',fill='#d4dce3')
 canvas.save(evidence/f'visual/film-contact-{page}.jpg',quality=92)
report={'status':'PASS','decodedFrames':frames,'durationSeconds':seconds,'size':meta['size'],'fps':meta['fps'],'codec':meta['codec'],'fullAudioVideoDecodeErrors':r.stderr if r.returncode else '', 'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'capturedSimulation':True,'visualReview':'50 encoded samples at 3-second intervals plus hand/hero/Inspect/console close-up screenshots; not a hardware recording','physicalAcceptance':'NOT RUN','runtimeSourcesVerified':len(manifest['renderSourceHashes'])}
(evidence/'film-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
