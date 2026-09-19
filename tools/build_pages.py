#!/usr/bin/env python3
"""Build the public static site from an explicit allowlist of tracked files."""
from pathlib import Path
import subprocess, shutil
root=Path(__file__).resolve().parents[1]
out=root/'build/pages'
if out.exists(): shutil.rmtree(out)
out.mkdir(parents=True)
for name in subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0'):
    if not name: continue
    allowed=name=='index.html' or name.startswith(('css/','js/','presentation/')) or name=='docs/protocol.md'
    if not allowed or name.startswith('presentation/assets/music-local/'): continue
    src=root/name
    if src.is_symlink(): raise RuntimeError('Refusing symlink: '+name)
    if src.is_file():
        dst=out/name;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
(out/'.nojekyll').touch()
print('Static site:',out)
