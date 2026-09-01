import './App.css';
import { CameraView, useCamera, useWakeLock } from './camera';

export default function App() {
  const camera = useCamera();
  useWakeLock(camera.state === 'active');

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

      <main className="stage" aria-label="Camera view">
        <CameraView
          ref={camera.videoRef}
          state={camera.state}
          error={camera.error}
          onStart={camera.start}
        />
      </main>

      <footer className="stats" aria-label="Live drip statistics">
        <Stat label="drops/min" value="—" />
        <Stat label="mL/hr" value="—" />
        <Stat label="factor" value="—" hint="gtt/mL" />
      </footer>
    </div>
  );
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
