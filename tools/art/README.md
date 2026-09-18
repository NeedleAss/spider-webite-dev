# Adult scene asset

`adult.glb` is a dressed, rigged **1.70 m adult**, used at metre scale beside the original robot CAD. It is a synthetic character, not a scan of a team member. Runtime poses in `presentation/scene/actor.js` are deterministic two-link IK and authored finger poses; the original rest rig is restored before every evaluation.

Sources are MakeHuman core mesh, rig and skin weights (pinned commit in `adult-source.json`), plus the CC0 system asset pack: `male_casualsuit01`, `shoes04`, `short02`, `young_asian_male`. Core helper geometry is not exported. Clothing deletion masks are parsed as lists of individual vertex IDs and inclusive ranges. The derived GLB includes only the dressed body, clothes, eyes and skeleton.

- Core asset license: https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md
- Licensing explanation: https://static.makehumancommunity.org/about/license.html
- System pack: https://static.makehumancommunity.org/assets/assetpacks/makehuman_system_assets.html
- Pack URL and SHA-256: `presentation/assets/actors/BUILD_INPUTS.json`

Rebuild with Blender 4.5 LTS:

1. Place `base.obj`, `default.mhskel`, `default_weights.mhw`, `LICENSE.ASSETS.md`, and `SOURCE.json` under `build/art-source/makehuman/`, using the recorded core commit.
2. Extract the recorded CC0 system pack to `build/art-source/system/`; reject archive paths outside that directory.
3. Run `blender --background --factory-startup --python tools/art/build_actor.py`.
4. Inspect both the rest asset and runtime contact/gesture poses. A successful export is not visual acceptance.

The script writes a local editable Blender scene under `build/art-source/` and the distributable GLB/provenance/license under `presentation/assets/actors/`. Original downloads and Blender itself are build inputs and are not shipped as application dependencies. Textures are downsampled to 2048 px for skin and 1024 px for clothing; glTF export uses JPEG quality 88 where alpha is not required. No network request is made while rebuilding or viewing.
