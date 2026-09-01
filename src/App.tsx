import './App.css';

// Phase 1 scaffold. Camera capture (issue #2), overlay (issue #3), detection
// (issue #4), rate math (issue #5), drop-factor UI (issue #6), and clinical
// copy (issue #7) all land in follow-ups. Stats display a dash — never a
// literal "0" — because a nurse reads 0 as "infusion stopped".
export default function App() {
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
        <div className="camera-placeholder" aria-label="Camera area placeholder">
          <div className="camera-placeholder__label">Camera preview</div>
          <div className="camera-placeholder__sub">
            Tap-to-start &amp; rear-camera capture land in TEST-2.
          </div>
        </div>
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
