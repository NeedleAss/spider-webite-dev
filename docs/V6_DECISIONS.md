# V6 current decisions and execution record

Baseline: `7e3a091125028a68a292df645dfe2512e489d4c9`. User approved development, Git push and PR update. Hardware is remote; no flashing or physical motion is authorized by a document alone.

## Authoritative changes after the V6 review

- Direct gesture interaction is the default. No browser, mode click, or browser heartbeat is required to start a qualified gesture while the robot is ready. The camera, IMU, calibration, network and safety conditions still apply.
- Merely viewing video/telemetry never takes motion ownership. Active manual input takes priority. Normal release zeros the target and releases ownership; a fresh gesture after release may take over. A timeout/fault is not a normal handoff and cannot replay a held gesture.
- Gesture labels, action admission, device targets and physical motion are separate evidence. DISLIKE is ordinary stop, never emergency reset.
- The old GESTURE_CONTROL mode may remain for protocol compatibility; it is not the required entry. Health mode inhibits gesture starts during contact measurement.
- Passive page lifecycle/video events release only that page's own operation; explicit Stop remains available. Emergency stop remains globally available. Old repeated zero releases must not cancel a later independent gesture.
- V6's 150-second film supersedes V5's 96-second length. V5's common time evaluator, actual-scale room/person/hand, three explosion layouts, default-assembled Inspect and contact/OLED shared event remain requirements.
- Software completion does not close G01, physical/mobile/Windows acceptance, or qualify compile-only binaries for flashing.

## Work order

1. Regression fixtures and input/gesture/video/freshness corrections.
2. Production console hierarchy and all failure states; early firmware/Web candidate for field testing.
3. Director, Deck/Scroll/Film, Inspect and visual sample gates.
4. Complete 150-second film, offline MP4/captions/posters, visual QA.
5. Same-version evidence, source/asset/media manifest, handoff package and GitHub PR.

## Source materials

V5/V6 report Markdown, V6 Goal and field runbook are preserved in `docs/v6/source-briefs/` as historical inputs. Their instructions do not override the above user decisions. The downloaded folder did not contain the reported V6 ZIP, reference director, JSON storyboard or reproduction source. New tests must be identified as this repository's tests, not a rerun of unavailable attachments.

## Progress

- Baseline repository clean and equal to fetched remote. Baseline Node/Python/C++ logs saved under `evidence/v6/`.
- Production code, 150-second MP4, 51 Node / 38 Python / 12 C++ suites and 42 browser checks: PASS. Final clean-source builds, release ZIP and remote PR checks: IN PROGRESS. Field hardware, G01 and actual mobile devices: NOT RUN.
