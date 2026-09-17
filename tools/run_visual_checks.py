#!/usr/bin/env python3
"""Run the isolated V4 browser checks with Playwright CLI 0.1.20. No robot connection."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/playwright/v4'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--capture', action='store_true', help='Also refresh posters and 84 milestone screenshots')
    args = parser.parse_args()
    npx = shutil.which('npx') or shutil.which('npx.cmd')
    if not npx:
        raise SystemExit('Node.js/npm with npx is required.')
    OUT.mkdir(parents=True, exist_ok=True)
    server = None
    try:
        try:
            with urllib.request.urlopen('http://127.0.0.1:8765/presentation/', timeout=3) as response:
                if b'CareRover' not in response.read():
                    raise SystemExit('Port 8765 is serving another project. Stop it before running these checks.')
        except urllib.error.URLError:
            server = subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '--bind', '127.0.0.1'], cwd=ROOT,
                                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            for _ in range(30):
                try:
                    urllib.request.urlopen('http://127.0.0.1:8765/presentation/', timeout=1).close()
                    break
                except urllib.error.URLError:
                    time.sleep(.1)
            else:
                raise SystemExit('Could not start the local HTTP server.')
        base = [npx, '--yes', '--package', '@playwright/cli@0.1.20', 'playwright-cli']
        def call(session, *command):
            result = subprocess.run([*base, '--session', session, *command], cwd=ROOT, capture_output=True, text=True)
            if result.returncode or '### Error' in result.stdout:
                raise RuntimeError(result.stdout + result.stderr)
            return result.stdout
        sessions = ['v4-story-check', 'v4-console-check']
        try:
            for session in sessions:
                call(session, 'open', 'http://127.0.0.1:8765/presentation/', '--headed')
            scripts = [('check_story.js', sessions[0]), ('check_story_resilience.js', sessions[0]),
                       ('check_display_semantics.js', sessions[1]), ('check_motion_framing.js', sessions[0])]
            if args.capture:
                scripts += [('capture_story.js', sessions[0]), ('capture_story_milestones.js', sessions[0])]
            for filename, session in scripts:
                output = call(session, 'run-code', (ROOT / 'tests/browser' / filename).read_text(encoding='utf-8'))
                (OUT / (Path(filename).stem + '.txt')).write_text(output, encoding='utf-8')
                result = json.loads(output.split('### Result\n', 1)[1].split('\n###', 1)[0])
                (OUT / (Path(filename).stem + '.json')).write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
                print('PASS:', filename, flush=True)
            if args.capture:
                subprocess.run([sys.executable, 'tools/appearance_manifest.py'], cwd=ROOT, check=True)
        finally:
            for session in sessions:
                subprocess.run([*base, '--session', session, 'close'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    finally:
        if server:
            server.terminate()
            server.wait(timeout=5)

if __name__ == '__main__':
    main()
