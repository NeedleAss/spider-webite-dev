# V6 control and firmware increment — software checkpoint

Baseline: `7e3a091`. This is the first V6 implementation checkpoint, not the completed film/presentation or physical release. The user's later direct-gesture decision in `V6_DECISIONS.md` supersedes mandatory webpage gesture authorization in the source review.

## What changed

- Qualified gestures start on the device without selecting a webpage mode. Manual/Follow owners still block competing starts; idle/health/compatibility gesture selections release ownership. Health inhibits starts, while DISLIKE remains ordinary stop.
- Normal release zeros input and releases the owner's operation. Automatic page releases carry `release_only:true`, advertised by `device.scoped_release`. Delayed repeat releases cannot cancel a later ownerless gesture. Explicit Stop remains ordinary zero; ESTOP remains a separate latch.
- Observers do not send supervising Follow heartbeats. Hidden pages, source changes and video failures release only their own operation. Reconnect clears local input and ownership assumptions.
- Hand kept through manual input, cancellation or a fault cannot automatically restart an action. Rearming requires three raw neutral/no-hand observations, followed by the existing qualified action confirmation. Safety thresholds, command/source timeouts, tilt protection and NVS calibration remain in place.
- Recognition labels and device action admission are separate. The OLED shows a bounded action result for four seconds, with emergency/fault priority; neither OLED nor the console certifies physical movement.
- Robot freshness is tied to a valid robot mode/estop block. Health/IMU/PPG messages cannot keep old robot targets, modes or emergency confirmation fresh.
- Video defaults to closed for a real WebSocket session. Direct CAM multipart bytes are parsed in bounded memory and decoded one frame at a time, retaining only the newest pending frame. First frame timeout is 5 seconds; decoded frame age expires after 2 seconds. Three consecutive connection retries maximum, then manual retry. HTTP 503 never starts a retry loop. The existing CAM console-only CORS header now covers errors as well as live video.
- The production root console has a larger view, control column, gesture-result distinction, visible source/owner status, independent health region and folded diagnostics. The old mandatory gesture-mode button is removed; protocol compatibility remains.

## Verification at this checkpoint

Raw logs are in `evidence/v6/`. Node tests cover protocol, independent freshness, bounded MJPEG, delayed decoding and input behavior. C++ host tests exercise the actual safety/gesture headers under SAFE_BASELINE and DEMO_BALANCED. Python tests exercise the mock WebSocket ownership boundary. `console-browser.json` contains 16 production-page checks, using an explicitly isolated loopback JPEG fixture and synthetic WebSocket telemetry; no robot is contacted.

Browser checks include: passive viewing, independent gesture Follow, manual release, delayed release, explicit Stop, real JPEG decoding, accepted versus recognized feedback, video freeze while telemetry continues, 503 no-retry, robot-only freshness, unknown stale mode/target, mobile width and touch sizes. A browser-specific unbound-fetch error was found and fixed before this checkpoint passed.

Main follow SAFE_BASELINE and DEMO_BALANCED and CAM stream SAFE_BASELINE compile on this Mac. Compile-only package manifests and raw logs remain under `build/`; they contain placeholder network credentials and are NOT flashable field packages. Main firmware source changes and OLED additions require building the correct field configuration. Web changes also require FFat update; firmware-only flashing leaves an incompatible old page behind.

## Field work remains independent

Hardware, current PWM/physical stop, G01 independent withdrawal when the safety task stalls, real iPhone/iPad/Safari, Windows builds and wireless endurance: **NOT RUN**. Before motion, use the existing field prerequisites, backups and staged CAM → observe → raised-wheel calibration → manual → Follow sequence. Record target, PWM and physical motion separately. No guessed COM ports, GPIOs or calibration values. Keep existing private Wi-Fi/NVS/servo/front configuration.

The later V6 handoff will freeze source, Web, main, CAM, media and acceptance tables together. Until then PR #1 remains a work-in-progress draft. The new deterministic 150-second director is only a tested module at this checkpoint; a complete exported film has not yet been produced.

Final V6 follow-up: a slow-decoder/continuous-arrival test exposed display starvation when every completed frame was discarded merely because a newer one was pending. Fresh completed frames now paint while the single pending slot remains latest-only; stale/previous-generation bitmaps are still discarded. See `evidence/v6/video-backlog-before.txt` and the final 51-test Node result.
