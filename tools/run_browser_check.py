#!/usr/bin/env python3
"""Run a repository Playwright CLI scenario; no @playwright/test dependency.
Existing local servers are required by the selected scenario. Logs include raw results.
"""
import argparse,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('script');p.add_argument('--session',default='v6-check');p.add_argument('--log');a=p.parse_args()
source=(ROOT/a.script).read_text()
r=subprocess.run(['npx','--yes','--package','@playwright/cli@0.1.20','playwright-cli','--session',a.session,'run-code',source],cwd=ROOT,text=True,capture_output=True)
output=r.stdout+r.stderr
if a.log:
 path=ROOT/a.log;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(output)
print(output);raise SystemExit(r.returncode or (1 if '### Error' in output else 0))
