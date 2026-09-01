import type { DetectorState } from './dropDetector';
import './debug-hud.css';

// Opt-in HUD for verifying the detector in a real browser without shipping
// dev instrumentation to production users. Activate with ?debug=1 in the URL.
// TEST-5 owns the user-visible drops/min and mL/hr — this HUD is engineer-only.

export interface DetectorDebugHudProps {
  state: DetectorState;
  estimatorState?: 'unknown' | 'settling' | 'live';
}

export function DetectorDebugHud({ state, estimatorState }: DetectorDebugHudProps) {
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
    </div>
  );
}

function formatNum(v: number, digits: number): string {
  return v.toFixed(digits);
}
