import './overlay.css';

export default function ChamberGuideOverlay() {
  return (
    <div className="overlay" aria-hidden="true">
      <div className="overlay__rect">
        <div className="overlay__tripwire" />
      </div>
      <div className="overlay__hint">Frame the drip chamber inside the box</div>
    </div>
  );
}

export { TRIPWIRE, computeVideoTripwire } from './tripwire';
