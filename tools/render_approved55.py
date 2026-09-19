#!/usr/bin/env python3
"""Export the user-approved 55s browser cut with its supplied soundtrack.
Requires the local preview and a Playwright CLI session named final55-export.
Keeps historical repository movies intact; delivers into the supplied CAD folder.
"""
from pathlib import Path
import hashlib, json, subprocess, time, shutil
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / 'build/final55'
FRAMES = ROOT / 'output/playwright/final55/frames'
DEST = Path('/Users/eddysiangz/Downloads/3D建模/CareRover_Final_55s_1080p.mp4')
AUDIO = ROOT / 'presentation/assets/music-local/review.m4a'
CLI = ['npx', '--yes', '--package', '@playwright/cli@0.1.20', 'playwright-cli', '--session', 'final55-export', 'run-code']
FF = imageio_ffmpeg.get_ffmpeg_exe()
for p in [BUILD, FRAMES]:
    p.mkdir(parents=True, exist_ok=True)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def sources():
    paths = [ROOT / ('presentation/' + x) for x in ['app.js', 'index.html', 'style.css', 'parts.js', 'story/timeline.js', 'assets/cad/carerover.glb', 'assets/hand/hand_demo.glb', 'assets/film/console-demo.mp4']]
    for folder, suffix in [('v7', '*.js'), ('scene', '*.js'), ('effects', '*.js'), ('assets/interaction', '*.glb')]:
        paths += sorted((ROOT / 'presentation' / folder).glob(suffix))
    paths.append(AUDIO)
    return {p.relative_to(ROOT).as_posix(): sha(p) for p in paths}

def browser(code):
    r = subprocess.run(CLI + [code], cwd=ROOT, capture_output=True, text=True)
    with (BUILD / 'capture.txt').open('a') as f:
        f.write(r.stdout + r.stderr + '\n')
    if r.returncode or '### Error' in r.stdout:
        raise RuntimeError(r.stdout + r.stderr)

source = sources()
assert sha(AUDIO) == json.loads((ROOT / 'evidence/v7/music-cue.json').read_text())['sha256']
browser("async page=>{await page.route('**/*',r=>r.continue());await page.setViewportSize({width:1920,height:1080});await page.goto('http://127.0.0.1:8765/presentation/?review=55&export=1');await page.waitForFunction(()=>window.__careRover?.snapshot().ready);await page.evaluate(()=>document.fonts.ready);return await page.evaluate(()=>__careRover.snapshot().duration);}")
for start in range(0, 1650, 60):
    end = min(start + 60, 1650)
    began = time.monotonic()
    browser(f"""async page=>{{for(let i={start};i<{end};i++){{await page.evaluate(t=>__careRover.seek(t),i/30);await page.screenshot({{path:`output/playwright/final55/frames/${{String(i).padStart(5,'0')}}.jpg`,type:'jpeg',quality:97}});}}return {{frames:{end}}};}}""")
    assert sources() == source, 'Source changed during render'
    print(f'Captured {end}/1650 frames ({time.monotonic()-began:.1f}s batch)', flush=True)

film = BUILD / DEST.name
command = [FF, '-y', '-framerate', '30', '-i', str(FRAMES / '%05d.jpg'), '-ss', '7.372', '-i', str(AUDIO), '-t', '55', '-map', '0:v:0', '-map', '1:a:0', '-vf', 'scale=out_color_matrix=bt709', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-af', 'volume=0.7,afade=t=in:st=0:d=0.5,afade=t=out:st=53.5:d=1.5', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(film)]
r = subprocess.run(command, capture_output=True, text=True)
(BUILD / 'encode.txt').write_text(r.stderr)
r.check_returncode()
print('Encoded. Decoding full video and audio for verification.', flush=True)
r = subprocess.run([FF, '-v', 'error', '-i', str(film), '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-'], capture_output=True, text=True)
r.check_returncode()
assert not r.stderr, r.stderr
frames, duration = imageio_ffmpeg.count_frames_and_secs(str(film))
reader = imageio_ffmpeg.read_frames(str(film))
meta = next(reader)
reader.close()
assert frames == 1650 and abs(duration-55) < .05
assert meta['size'] == (1920, 1080) and meta['fps'] == 30
assert sources() == source
shutil.copy2(film, DEST)
assert sha(DEST) == sha(film)
manifest = {'status': 'USER APPROVED / EXPORTED', 'file': str(DEST), 'bytes': DEST.stat().st_size, 'sha256': sha(DEST), 'durationSeconds': duration, 'frames': frames, 'width': 1920, 'height': 1080, 'fps': 30, 'videoCodec': meta['codec'], 'audioCodec': 'AAC stereo 192k', 'audioStartSeconds': 7.372, 'audioVolume': .7, 'fadeInSeconds': .5, 'fadeOutSeconds': 1.5, 'fullAudioVideoDecode': 'PASS', 'renderSourceHashes': source}
(ROOT / 'evidence/v7/final55-export.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k:v for k,v in manifest.items() if k != 'renderSourceHashes'}, ensure_ascii=False), flush=True)
