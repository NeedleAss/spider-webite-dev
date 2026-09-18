# V6 evidence

Production implementation freeze: `40fe1516abfc3b43f6f734bf489d69f04b59b152`. Later delivery commits add evidence/docs/archive only; compare `build-results.json` Git objects to the current checkout.

- `node-progress.txt`, `python-progress.txt`, `firmware-progress.txt`: final local 51 / 38 / 12 passing checks; baseline logs are separately named.
- `console-browser.json`, `presentation-browser.json`, `presentation-resilience.json`: 16 + 19 + 7 new repository scenarios on real production pages, with isolated loopback WS/JPEG fixtures for the console. No hardware connection.
- `video-backlog-before.txt`: intentional regression reproduction before the slow-decode starvation fix; the passing new test is in the final Node log.
- `build-results.json` and `builds/`: clean-source main/CAM SAFE/DEMO compile manifests and logs. Hashes were checked against produced binaries. Compile-only; no flashing.
- `film-validation.json`: complete encoded audio/video decode, 4,500 frames, actual file hash and all 54 rendering sources checked.
- `film-browser-playback.json`: full 150-second Chromium playback at 2x muted, including measured dropped frames. It is not an auditory check or phone playback claim.
- `visual/`: production-page screenshots and two contact sheets sampled from the encoded MP4. Synthetic actor and room, not photos of an assembled robot.
- `film-retouch-scope.json`, `film-assembly-scope.json`: state equality outside bounded recapture intervals during final camera retouching.
- `historical-handoff-check.txt`: old 0915 archive integrity only, not current hardware acceptance.

All physical motion, PWM, real-phone/Windows and independent safety-task-stop gate G01 remain NOT RUN. Field tables are in `docs/V6_FIELD_RUNBOOK.md`. Original V5/V6 review claims are inputs, not silently relabeled as these tests.
