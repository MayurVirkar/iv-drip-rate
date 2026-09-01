// Synthetic drop-detector bench. Run with:
//   node --experimental-strip-types bench/detector-bench.ts
//
// The detector is pure JS/TS (no DOM), so we import it directly and feed it
// synthetic (luma, t) samples. This lets us score precision / recall / FPR
// without a browser and without a real camera.

import { createDetector, DEFAULT_OPTIONS } from '../src/detector/dropDetector.ts';

type Scenario = {
  name: string;
  fps: number;
  durationSec: number;
  baselineLuma: number;
  sensorNoiseStd: number;
  dropRatePerMin: number;
  dropDepth: number;
  dropDurationFrames: number;
  baselineDriftAmp?: number;
  baselineDriftPeriodSec?: number;
};

type GroundTruth = { troughT: number };

// Build a synthetic luma trace + ground-truth drop timestamps.
function synth(scenario: Scenario): {
  samples: Array<{ t: number; luma: number }>;
  truth: GroundTruth[];
} {
  const {
    fps,
    durationSec,
    baselineLuma,
    sensorNoiseStd,
    dropRatePerMin,
    dropDepth,
    dropDurationFrames,
    baselineDriftAmp = 0,
    baselineDriftPeriodSec = 0,
  } = scenario;
  const frameCount = Math.floor(fps * durationSec);
  const frameMs = 1000 / fps;

  const truth: GroundTruth[] = [];
  if (dropRatePerMin > 0) {
    const intervalSec = 60 / dropRatePerMin;
    // Start first drop after warmup so the detector's baseline is stable.
    for (let t = 1.5; t < durationSec - 0.5; t += intervalSec) {
      const startFrame = Math.floor(t * fps);
      const troughFrame = startFrame + Math.floor(dropDurationFrames / 2);
      truth.push({ troughT: troughFrame * frameMs });
    }
  }

  const dropStartFrames = new Set(
    truth.map((g) => Math.floor(g.troughT / frameMs) - Math.floor(dropDurationFrames / 2)),
  );

  const samples: Array<{ t: number; luma: number }> = new Array(frameCount);
  for (let f = 0; f < frameCount; f += 1) {
    const t = f * frameMs;
    let luma = baselineLuma;
    if (baselineDriftAmp > 0 && baselineDriftPeriodSec > 0) {
      luma += baselineDriftAmp * Math.sin((2 * Math.PI * t) / (baselineDriftPeriodSec * 1000));
    }
    luma += gaussian() * sensorNoiseStd;
    samples[f] = { t, luma };
  }

  // Overlay drops. Half-sine dip so leading edge is soft and trough is sharp
  // — realistic for a chamber drop crossing a horizontal tripwire.
  for (const startFrame of dropStartFrames) {
    for (let i = 0; i < dropDurationFrames; i += 1) {
      const idx = startFrame + i;
      if (idx < 0 || idx >= frameCount) continue;
      const phase = (i / (dropDurationFrames - 1)) * Math.PI;
      samples[idx].luma -= dropDepth * Math.sin(phase);
    }
  }

  return { samples, truth };
}

// Box-Muller Gaussian.
let g_spare: number | null = null;
function gaussian(): number {
  if (g_spare !== null) {
    const v = g_spare;
    g_spare = null;
    return v;
  }
  let u1 = 0;
  let u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  const mag = Math.sqrt(-2 * Math.log(u1));
  const z0 = mag * Math.cos(2 * Math.PI * u2);
  g_spare = mag * Math.sin(2 * Math.PI * u2);
  return z0;
}

function runScenario(scenario: Scenario, matchWindowMs = 200) {
  const { samples, truth } = synth(scenario);
  const detector = createDetector();
  const emitted: number[] = [];
  detector.onDrop((e) => {
    emitted.push(e.t);
  });
  for (const s of samples) detector.ingest(s.luma, s.t);

  // Match emitted → truth (greedy, nearest, within window).
  const matchedTruth = new Set<number>();
  const matchedEmit = new Set<number>();
  for (let i = 0; i < emitted.length; i += 1) {
    let bestJ = -1;
    let bestDelta = Infinity;
    for (let j = 0; j < truth.length; j += 1) {
      if (matchedTruth.has(j)) continue;
      const d = Math.abs(emitted[i] - truth[j].troughT);
      if (d < bestDelta) {
        bestDelta = d;
        bestJ = j;
      }
    }
    if (bestJ !== -1 && bestDelta <= matchWindowMs) {
      matchedTruth.add(bestJ);
      matchedEmit.add(i);
    }
  }

  const tp = matchedTruth.size;
  const fp = emitted.length - matchedEmit.size;
  const fn = truth.length - matchedTruth.size;
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const durationMin = scenario.durationSec / 60;
  const fpPerMin = fp / durationMin;

  // Timing offset stats on matched pairs.
  const offsets: number[] = [];
  for (let i = 0; i < emitted.length; i += 1) {
    if (!matchedEmit.has(i)) continue;
    let bestJ = -1;
    let bestDelta = Infinity;
    for (let j = 0; j < truth.length; j += 1) {
      if (!matchedTruth.has(j)) continue;
      const d = Math.abs(emitted[i] - truth[j].troughT);
      if (d < bestDelta) {
        bestDelta = d;
        bestJ = j;
      }
    }
    if (bestJ !== -1) offsets.push(emitted[i] - truth[bestJ].troughT);
  }
  const meanOffset = offsets.length ? offsets.reduce((a, b) => a + b, 0) / offsets.length : 0;
  const rmseOffset = offsets.length
    ? Math.sqrt(offsets.reduce((a, b) => a + b * b, 0) / offsets.length)
    : 0;

  return {
    scenario: scenario.name,
    truthCount: truth.length,
    emittedCount: emitted.length,
    tp,
    fp,
    fn,
    precision,
    recall,
    fpPerMin,
    meanOffsetMs: meanOffset,
    rmseOffsetMs: rmseOffset,
  };
}

function fmt(n: number, digits = 3): string {
  if (!Number.isFinite(n)) return String(n);
  return n.toFixed(digits);
}

function main(): void {
  // Fixed seed via re-seeding of gaussian? Math.random is non-deterministic;
  // we accept run-to-run jitter. Run multiple times if a metric looks off.

  const scenarios: Scenario[] = [
    {
      name: 'macro adult @ 20 gtt/min, 30 fps, quiet room',
      fps: 30,
      durationSec: 120,
      baselineLuma: 180,
      sensorNoiseStd: 1.5,
      dropRatePerMin: 20,
      dropDepth: 30,
      dropDurationFrames: 5, // ~167 ms dip at 30 fps
    },
    {
      name: 'macro adult @ 60 gtt/min, 30 fps',
      fps: 30,
      durationSec: 120,
      baselineLuma: 180,
      sensorNoiseStd: 1.5,
      dropRatePerMin: 60,
      dropDepth: 30,
      dropDurationFrames: 5,
    },
    {
      name: 'fast infusion @ 100 gtt/min, 60 fps',
      fps: 60,
      durationSec: 60,
      baselineLuma: 180,
      sensorNoiseStd: 1.5,
      dropRatePerMin: 100,
      dropDepth: 30,
      dropDurationFrames: 8, // ~133 ms at 60 fps
    },
    {
      name: 'slow gravity @ 5 gtt/min, 30 fps',
      fps: 30,
      durationSec: 180,
      baselineLuma: 180,
      sensorNoiseStd: 1.5,
      dropRatePerMin: 5,
      dropDepth: 30,
      dropDurationFrames: 6,
    },
    {
      name: 'rest only (no drops), 30 fps, 3 min',
      fps: 30,
      durationSec: 180,
      baselineLuma: 180,
      sensorNoiseStd: 1.5,
      dropRatePerMin: 0,
      dropDepth: 0,
      dropDurationFrames: 0,
    },
    {
      name: 'noisy sensor @ 30 gtt/min, σ=3 luma',
      fps: 30,
      durationSec: 120,
      baselineLuma: 180,
      sensorNoiseStd: 3,
      dropRatePerMin: 30,
      dropDepth: 30,
      dropDurationFrames: 5,
    },
    {
      name: 'drifting light @ 30 gtt/min (±20 luma, 30s period)',
      fps: 30,
      durationSec: 120,
      baselineLuma: 180,
      sensorNoiseStd: 1.5,
      dropRatePerMin: 30,
      dropDepth: 30,
      dropDurationFrames: 5,
      baselineDriftAmp: 20,
      baselineDriftPeriodSec: 30,
    },
    {
      name: 'shallow dips @ 30 gtt/min (12 luma dip, near noise floor)',
      fps: 30,
      durationSec: 120,
      baselineLuma: 180,
      sensorNoiseStd: 1.5,
      dropRatePerMin: 30,
      dropDepth: 12,
      dropDurationFrames: 5,
    },
  ];

  console.log(`Detector: ${JSON.stringify(DEFAULT_OPTIONS)}`);
  console.log('');
  const rows: Array<Record<string, string | number>> = [];
  for (const s of scenarios) {
    const r = runScenario(s);
    rows.push({
      scenario: r.scenario,
      truth: r.truthCount,
      emit: r.emittedCount,
      tp: r.tp,
      fp: r.fp,
      fn: r.fn,
      precision: fmt(r.precision),
      recall: fmt(r.recall),
      fp_per_min: fmt(r.fpPerMin, 2),
      trough_bias_ms: fmt(r.meanOffsetMs, 1),
      trough_rmse_ms: fmt(r.rmseOffsetMs, 1),
    });
  }

  const cols = Object.keys(rows[0]);
  const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c]).length)));
  const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - s.length));
  console.log(cols.map((c, i) => pad(c, widths[i])).join('  '));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of rows) {
    console.log(cols.map((c, i) => pad(String(r[c]), widths[i])).join('  '));
  }
}

main();
