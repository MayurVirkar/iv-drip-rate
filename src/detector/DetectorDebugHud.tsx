import type { DetectorState } from './dropDetector';
import './debug-hud.css';

// Opt-in HUD for verifying the detector in a real browser without shipping
// dev instrumentation to production users. Activate with ?debug=1 in the URL.
// TEST-5 owns the user-visible drops/min and mL/hr — this HUD is engineer-only.

export interface DetectorDebugHudProps {
  state: DetectorState;
  kThreshold: number;
  estimatorState?: 'unknown' | 'settling' | 'live';
  estimatorIntervals?: number[];
}

export function DetectorDebugHud({ state, kThreshold, estimatorState, estimatorIntervals }: DetectorDebugHudProps) {
  // Compute dips/min from recent entries
  const dipsPerMin = state.recentDipEntries.length > 0
    ? (state.recentDipEntries.length / 
       ((state.recentDipEntries[state.recentDipEntries.length - 1] - 
         state.recentDipEntries[0]) / 60000)) || 0
    : 0;

  // Format last 3 intervals for display
  const lastIntervals = (estimatorIntervals || []).slice(-3);
  const intervalsDisplay = lastIntervals.length > 0
    ? lastIntervals.map(iv => Math.round(iv)).join(', ')
    : '—';

  return (
    <div className="detector-hud" aria-hidden="true">
      <span className={`detector-hud__pip detector-hud__pip--${state.baseline_valid ? 'ok' : 'bad'}`} />
      {estimatorState && <span>state: {estimatorState}</span>}
      <span>luma {formatNum(state.luma, 1)}</span>
      <span>base {state.baseline === null ? '—' : formatNum(state.baseline, 1)}</span>
      <span>σ {state.std === null ? '—' : formatNum(state.std, 2)}</span>
      <span>valid: {state.baseline_valid ? 'Y' : 'N'}</span>
      <span>frames {state.frameCount}</span>
      <span>drops {state.dropCount}</span>
      <span>{state.inDip ? 'DIP' : ''}</span>
      <span>k {formatNum(kThreshold, 1)}</span>
      <span>dips/min {formatNum(dipsPerMin, 1)}</span>
      <span>est intervals [{intervalsDisplay}]</span>
    </div>
  );
}

function formatNum(v: number, digits: number): string {
  return v.toFixed(digits);
}
