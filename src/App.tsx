import { useRef } from 'react';
import './App.css';
import { CameraView, useCamera, useWakeLock } from './camera';
import { DetectorDebugHud, useDropDetector } from './detector';

export default function App() {
  const camera = useCamera();
  useWakeLock(camera.state === 'active');

  const stageRef = useRef<HTMLElement>(null);
  const detector = useDropDetector(camera.videoRef, stageRef, {
    enabled: camera.state === 'active',
  });

  const debug = isDebugEnabled();

  return (
    <div className="app">
      <header className="disclaimer" role="note">
        <strong>PLACEHOLDER — replaced by IV Clinical Safety.</strong>
        <span>
          {' '}
          Not a medical device. Prototype only — verify with a manual count before
          acting.
        </span>
      </header>

      <main className="stage" aria-label="Camera view" ref={stageRef}>
        <CameraView
          ref={camera.videoRef}
          state={camera.state}
          error={camera.error}
          onStart={camera.start}
        />
        {debug && camera.state === 'active' && (
          <DetectorDebugHud state={detector} />
        )}
      </main>

      <footer className="stats" aria-label="Live drip statistics">
        <Stat label="drops/min" value="—" />
        <Stat label="mL/hr" value="—" />
        <Stat label="factor" value="—" hint="gtt/mL" />
      </footer>
    </div>
  );
}

function isDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('debug') === '1';
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="stat" role="group" aria-label={label}>
      <div className="stat__value" aria-live="polite">
        {value}
      </div>
      <div className="stat__label">
        {label}
        {hint ? <span className="stat__hint"> ({hint})</span> : null}
      </div>
    </div>
  );
}
