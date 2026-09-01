import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DROP_FACTOR,
  HOLD_MEAN_MULT,
  HOLD_MS_MIN,
  MAX_INTERVAL_MS,
  MIN_INTERVAL_MS,
} from './constants';
import {
  createState,
  onDrop,
  recordLiveIfNeeded,
  snapshot,
  type EstimatorState,
  type Snapshot,
  type SnapshotInput,
} from './core';

const activeCamera: SnapshotInput = {
  factor: DEFAULT_DROP_FACTOR,
  cameraActive: true,
  baselineValid: true,
};

function driveStream(
  ratePerMin: number,
  count: number,
  startAt = 1000,
  jitterMs = 0,
): number[] {
  const intervalMs = 60_000 / ratePerMin;
  const ts: number[] = [];
  let t = startAt;
  for (let i = 0; i < count; i++) {
    ts.push(t);
    t += intervalMs + (Math.random() * 2 - 1) * jitterMs;
  }
  return ts;
}

function feed(state: EstimatorState, ts: number[]): EstimatorState {
  let s = state;
  for (const t of ts) {
    s = onDrop(s, t);
    const snap = snapshot(s, t, activeCamera);
    s = recordLiveIfNeeded(s, snap);
  }
  return s;
}

function finalSnap(state: EstimatorState, now: number, input = activeCamera): Snapshot {
  return snapshot(state, now, input);
}

describe('fail-closed contract', () => {
  it('starts as unknown before any drops', () => {
    expect(finalSnap(createState(), 0)).toEqual({
      dropsPerMin: null,
      mLPerHr: null,
      state: 'unknown',
    });
  });

  it('is unknown while camera inactive even if drops exist', () => {
    const state = feed(createState(), driveStream(30, 6));
    const s = snapshot(state, 12_000, { ...activeCamera, cameraActive: false });
    expect(s.state).toBe('unknown');
    expect(s.dropsPerMin).toBeNull();
    expect(s.mLPerHr).toBeNull();
  });

  it('is unknown when baseline_valid is false (solid stream / dark camera)', () => {
    const state = feed(createState(), driveStream(30, 6));
    const s = snapshot(state, 12_000, { ...activeCamera, baselineValid: false });
    expect(s.state).toBe('unknown');
    expect(s.dropsPerMin).toBeNull();
  });

  it('never emits 0 as a value — always null + unknown', () => {
    const cases: Snapshot[] = [
      finalSnap(createState(), 0),
      snapshot(feed(createState(), driveStream(30, 6)), 12_000, {
        ...activeCamera,
        cameraActive: false,
      }),
      snapshot(feed(createState(), driveStream(30, 6)), 12_000, {
        ...activeCamera,
        baselineValid: false,
      }),
    ];
    for (const c of cases) {
      expect(c.dropsPerMin).not.toBe(0);
      expect(c.mLPerHr).not.toBe(0);
    }
  });
});

describe('settling → live transitions on synthetic streams', () => {
  const scenarios = [10, 20, 60, 100];

  for (const rate of scenarios) {
    it(`${rate} gtt/min: reaches live within a few intervals, matches ground truth`, () => {
      const ts = driveStream(rate, 6);
      let s = createState();
      // First drop: unknown (no interval yet).
      s = onDrop(s, ts[0]);
      expect(snapshot(s, ts[0], activeCamera).state).toBe('unknown');
      // Second drop: at least one interval → settling.
      s = onDrop(s, ts[1]);
      expect(snapshot(s, ts[1], activeCamera).state).toBe('settling');
      // By the fourth drop (3 intervals), if all agree, we are live.
      s = onDrop(s, ts[2]);
      s = onDrop(s, ts[3]);
      const snap = snapshot(s, ts[3], activeCamera);
      expect(snap.state).toBe('live');
      expect(snap.dropsPerMin).not.toBeNull();
      // Tolerance 10% for perfect synthetic streams.
      expect(Math.abs(snap.dropsPerMin! - rate)).toBeLessThan(rate * 0.1);
      expect(snap.mLPerHr).toBeCloseTo((rate * 60) / DEFAULT_DROP_FACTOR, 1);
    });
  }

  it('accepts realistic jitter (±10%) without dropping out of live', () => {
    const ts = driveStream(60, 8, 1000, (60_000 / 60) * 0.08); // 8% jitter
    let s = createState();
    for (const t of ts) s = onDrop(s, t);
    const snap = snapshot(s, ts[ts.length - 1], activeCamera);
    expect(snap.state).toBe('live');
    expect(snap.dropsPerMin).toBeGreaterThan(60 * 0.85);
    expect(snap.dropsPerMin).toBeLessThan(60 * 1.15);
  });

  it('rejects a wildly inconsistent stream — stays settling', () => {
    // Alternating 300 ms and 2 s → mean ≈ 1.15 s but every interval is
    // >25% away from the mean, so it should stay settling.
    let s = createState();
    const ts = [1000, 1300, 3300, 3600, 5600, 5900];
    for (const t of ts) s = onDrop(s, t);
    const snap = snapshot(s, 5900, activeCamera);
    expect(snap.state).toBe('settling');
    expect(snap.dropsPerMin).toBeNull();
  });
});

describe('drop-factor math', () => {
  const rate = 60; // gtt/min
  const cases: Array<[number, number]> = [
    [10, 360],
    [15, 240],
    [20, 180],
    [60, 60],
  ];

  for (const [factor, expected] of cases) {
    it(`factor ${factor} gtt/mL → mL/hr = ${expected} at 60 gtt/min`, () => {
      const ts = driveStream(rate, 6);
      let s = createState();
      for (const t of ts) s = onDrop(s, t);
      const snap = snapshot(s, ts[ts.length - 1], { ...activeCamera, factor });
      expect(snap.mLPerHr).toBeCloseTo(expected, 1);
    });
  }
});

describe('slow-drip realistic gravity IVs', () => {
  it('5 gtt/min (12 s interval) reaches live and reports ~5 drops/min', () => {
    const ts = driveStream(5, 6); // 12 s between drops
    let s = createState();
    for (const t of ts) s = onDrop(s, t);
    const snap = snapshot(s, ts[ts.length - 1], activeCamera);
    expect(snap.state).toBe('live');
    expect(snap.dropsPerMin).toBeGreaterThan(4.5);
    expect(snap.dropsPerMin).toBeLessThan(5.5);
  });

  it('at MAX_INTERVAL_MS boundary (20 s) still credits', () => {
    // 3 gtt/min → 20 s interval. Right at the boundary.
    const rate = 3;
    const ts = driveStream(rate, 6);
    let s = createState();
    for (const t of ts) s = onDrop(s, t);
    const snap = snapshot(s, ts[ts.length - 1], activeCamera);
    expect(snap.state).toBe('live');
  });
});

describe('kill-camera & solid-stream recovery', () => {
  it('kill camera mid-run → state returns to unknown, values null', () => {
    const ts = driveStream(60, 6);
    let s = createState();
    for (const t of ts) s = onDrop(s, t);
    expect(snapshot(s, ts[ts.length - 1], activeCamera).state).toBe('live');
    // Camera goes away.
    const dead = snapshot(s, ts[ts.length - 1] + 100, {
      ...activeCamera,
      cameraActive: false,
    });
    expect(dead).toEqual({ dropsPerMin: null, mLPerHr: null, state: 'unknown' });
  });

  it('baseline_valid flips false (solid stream) → unknown immediately', () => {
    const ts = driveStream(60, 6);
    let s = createState();
    for (const t of ts) s = onDrop(s, t);
    const solid = snapshot(s, ts[ts.length - 1] + 100, {
      ...activeCamera,
      baselineValid: false,
    });
    expect(solid.state).toBe('unknown');
    expect(solid.dropsPerMin).toBeNull();
  });

  it('no drops for a long time after live → holds briefly, then unknown', () => {
    const ts = driveStream(60, 6); // 1 s intervals → HOLD_MS = max(15s, 2.5s) = 15s
    let s = createState();
    for (const t of ts) {
      s = onDrop(s, t);
      s = recordLiveIfNeeded(s, snapshot(s, t, activeCamera));
    }
    const lastDrop = ts[ts.length - 1];
    // Inside hold window: still live with age set.
    const inside = snapshot(s, lastDrop + 5_000, activeCamera);
    expect(inside.state).toBe('live');
    expect(inside.age).toBe(5_000);
    // Past hold window: unknown.
    const outside = snapshot(s, lastDrop + HOLD_MS_MIN + 1_000, activeCamera);
    expect(outside.state).toBe('unknown');
    expect(outside.dropsPerMin).toBeNull();
  });

  it('slow drip live-hold scales with rate (5 gtt/min holds > HOLD_MS_MIN)', () => {
    const ts = driveStream(5, 6); // 12s intervals → HOLD_MS = max(15s, 30s) = 30s
    let s = createState();
    for (const t of ts) {
      s = onDrop(s, t);
      s = recordLiveIfNeeded(s, snapshot(s, t, activeCamera));
    }
    const lastDrop = ts[ts.length - 1];
    const holdMs = Math.max(HOLD_MS_MIN, HOLD_MEAN_MULT * 12_000);
    // Just inside the scaled hold window.
    const inside = snapshot(s, lastDrop + holdMs - 1_000, activeCamera);
    expect(inside.state).toBe('live');
    // Past scaled hold window.
    const outside = snapshot(s, lastDrop + holdMs + 1_000, activeCamera);
    expect(outside.state).toBe('unknown');
  });

  it('a single drop after MAX_INTERVAL_MS gap resets — no held value', () => {
    // Established live at 60 gtt/min.
    const first = driveStream(60, 6);
    let s = createState();
    for (const t of first) {
      s = onDrop(s, t);
      s = recordLiveIfNeeded(s, snapshot(s, t, activeCamera));
    }
    const late = first[first.length - 1] + MAX_INTERVAL_MS + 5_000;
    s = onDrop(s, late);
    const snap = snapshot(s, late, activeCamera);
    expect(snap.state).toBe('unknown');
  });
});

describe('double-count guard', () => {
  it('drops closer than MIN_INTERVAL_MS are ignored', () => {
    let s = createState();
    s = onDrop(s, 1000);
    s = onDrop(s, 1000 + MIN_INTERVAL_MS - 10);
    expect(s.intervals).toHaveLength(0);
    expect(s.lastDropAt).toBe(1000);
  });
});
