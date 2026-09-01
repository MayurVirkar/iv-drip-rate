// Invariant checks for the detector. Run with:
//   node --experimental-strip-types bench/detector-invariants.ts
//
// Each check exits with code 1 on failure. Assertions cover the contract
// TEST-5 will build on: baseline_valid flips correctly for dark / bright
// scenes, no drops emitted while invalid, refractory period holds, and
// state getters never crash pre-warmup.

import { createDetector } from '../src/detector/dropDetector.ts';

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail === undefined ? '' : ' — ' + JSON.stringify(detail)}`);
  }
}

function feedFlat(d: ReturnType<typeof createDetector>, luma: number, frames: number, startT = 0, dt = 33) {
  for (let i = 0; i < frames; i += 1) {
    d.ingest(luma, startT + i * dt);
  }
}

console.log('invariant: fresh detector reports null baseline, invalid');
{
  const d = createDetector();
  const s = d.state();
  check('baseline is null', s.baseline === null);
  check('std is null', s.std === null);
  check('baseline_valid is false', s.baseline_valid === false);
  check('dropCount is 0', s.dropCount === 0);
}

console.log('invariant: baseline_valid flips true after warmup on stable luma');
{
  const d = createDetector({ warmupFrames: 30 });
  feedFlat(d, 180, 29);
  check('still invalid at frame 29', d.state().baseline_valid === false, d.state());
  feedFlat(d, 180, 5, 29 * 33);
  check('valid after ≥ warmup frames', d.state().baseline_valid === true, d.state());
}

console.log('invariant: dark scene (below minLuma) keeps baseline_valid=false');
{
  const d = createDetector();
  feedFlat(d, 180, 60);
  check('valid after warmup on well-lit scene', d.state().baseline_valid === true);
  feedFlat(d, 5, 5, 60 * 33);
  check('invalid on dark frame', d.state().baseline_valid === false, d.state());
}

console.log('invariant: no drops emitted before baseline_valid');
{
  const d = createDetector({ warmupFrames: 100 });
  let count = 0;
  d.onDrop(() => (count += 1));
  // Feed a dip while still in warmup
  for (let i = 0; i < 20; i += 1) d.ingest(180, i * 33);
  for (let i = 20; i < 25; i += 1) d.ingest(140, i * 33); // sharp dip
  for (let i = 25; i < 30; i += 1) d.ingest(180, i * 33);
  check('no drops during warmup', count === 0, { count });
}

console.log('invariant: refractory period suppresses double-count');
{
  const d = createDetector({ refractoryMs: 200, warmupFrames: 30 });
  const emitted: number[] = [];
  d.onDrop((e) => emitted.push(e.t));
  feedFlat(d, 180, 60);
  // Two dips 100 ms apart trough-to-trough — closer than refractory
  const t0 = 60 * 33;
  d.ingest(140, t0);
  d.ingest(140, t0 + 33);
  d.ingest(180, t0 + 66);
  d.ingest(140, t0 + 99);
  d.ingest(140, t0 + 132);
  d.ingest(180, t0 + 165);
  check('only one drop counted within refractory window', emitted.length === 1, { emitted });
}

console.log('invariant: reset clears all state');
{
  const d = createDetector();
  feedFlat(d, 180, 60);
  d.reset();
  const s = d.state();
  check('baseline null after reset', s.baseline === null);
  check('dropCount 0 after reset', s.dropCount === 0);
  check('frameCount 0 after reset', s.frameCount === 0);
}

console.log('');
if (failures > 0) {
  console.log(`FAILED: ${failures} check(s) did not pass`);
  process.exit(1);
} else {
  console.log('All invariants passed.');
}
