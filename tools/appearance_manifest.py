#!/usr/bin/env python3
"""Update or check hashes of the authored V7 presentation assets. No CAD modification."""
import argparse
import hashlib
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1] / 'presentation'
MANIFEST = ROOT / 'assets/appearance/manifest.json'

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    data = json.loads(MANIFEST.read_text(encoding='utf-8'))
    files = [ROOT / x for x in ['app.js', 'index.html', 'style.css', 'parts.js', 'v7.html', 'hand.html', 'v7/style.css', 'assets/cad/carerover.glb']]
    for directory, suffix in [('scene', '.js'), ('effects', '.js'), ('story', '.js'), ('v7', '.js'), ('assets/appearance', '.png'), ('assets/reference', '.jpg')]:
        files += sorted((ROOT / directory).glob('*' + suffix))
    files += [p for folder in ['assets/actors','assets/film','assets/film-v7','assets/hand','assets/interaction','v7-media'] for p in (ROOT/folder).rglob('*') if p.is_file()]
    entries = [{'path': p.relative_to(ROOT).as_posix(), 'bytes': p.stat().st_size,
                'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(files)]
    assert hashlib.sha256((ROOT / 'assets/cad/carerover.glb').read_bytes()).hexdigest() == data['originalGLBSha256'], 'Original CAD GLB changed'
    asset_hash = hashlib.sha256(json.dumps(entries, sort_keys=True).encode()).hexdigest()
    if args.check:
        if data.get('files') != entries or data.get('assetHash') != asset_hash:
            raise SystemExit('FAIL: run python3 tools/appearance_manifest.py after updating assets/posters')
        print(f'PASS: {len(entries)} V7 files match {asset_hash}')
    else:
        data['version'] = 'v7.0'
        data['baselineCommit'] = '1d073b5'
        data['film'] = 'assets/film-v7/FILM_MANIFEST.json'
        data['historicalAssets'] = ['assets/actors', 'assets/film', 'story/director.js']
        data['files'] = entries
        data['assetHash'] = asset_hash
        MANIFEST.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(asset_hash)

if __name__ == '__main__':
    main()
