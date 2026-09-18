# Final sprint — 2026-09-17

Approved scope: retain the existing robot and framework, close motion failure
boundaries, make telemetry truthful, polish the console, and add a separate
offline presentation using the team's actual CAD assets.

Source baseline: `058ce89bd1aa5b5da0dbf89101f4625df70ca6df` on
`feat/main-wireless`. Development branch: `codex/final-polish`.
Original handoff directories are immutable references. Review-v2 prose has
been read; its separately linked scripts/report attachments were not available.
Regression tests in this sprint are independently written against production code.

## Work and acceptance

1. Inputs: keyboard/pointer transitions cannot retain abandoned axes; stop,
   cancellation, capture loss, blur, and hidden immediately release all axes.
2. Safety: expired manual commands zero output while retaining MANUAL; owner
   disconnect/network loss cancel motion; ping never renews manual commands.
   Ordinary stop cancels gesture actions. Gesture deadlines run in `tick()`.
3. Follow: missing/rejected/expired person measurements zero output and expose
   WAIT_TARGET; only a new accepted real measurement restores tracking. The
   30-second wait expires in the periodic controller even without sensor packets.
   Owner heartbeat and computation leases remain independent. Bypass cancels
   on lost inputs instead of retaining its lateral/forward output.
4. IMU: preserve +X mounting and 55°/400 ms tilt detection, 42°/1 s recovery.
   Unknown/rejected data cannot clear a latched fault or prove recovery.
   Motion admission requires calibrated, fresh IMU and verified NVS when installed.
5. Console: state, protocol, simulators, tests and current parameters agree;
   preserve explicit ESTOP recovery, read-only observers and replay isolation.
6. Presentation: actual CAD, stable part identity, assembled/exploded/selected
   states, accessible controls, reduced motion, offline assets. No motion commands.
7. Release: test/build evidence and an explicit physical acceptance handoff.

## Evidence boundary

Host/Mock/browser/build PASS never means physical PASS. No device is connected or
authorized for unattended movement by this development request. GPIO, calibration,
power, stopping distance and live device versions require field confirmation.
In particular, loss of the safety task itself must be measured at PWM and wheels;
the existing 240 ms drive lease checked by that same task is not independent proof.

CAD input: `/Users/eddysiangz/Downloads/3D建模/` (15 SLDPRT, one SLDASM).
Saved display meshes and exact assembly transforms exported: 15 meshes, 20 visible instances, one hidden servo. Native SolidWorks references/constraints remain NOT RUN.
Do not upload the CAD to a third-party conversion service without authorization.

## Status

- Baseline checked; remote fetched; clean worktree switched to development branch.
- Software implementation and verification complete; results and physical gates are in FINAL_ACCEPTANCE.md and FINAL_RESULTS.json.
- Final source package and integrity check are part of the candidate handoff.
- No firmware flashing, physical motion, native CAD validation, or remote publication performed.
