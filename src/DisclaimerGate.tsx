import { useState, useEffect } from 'react';
import './DisclaimerGate.css';

const STORAGE_KEY = 'ivDripRate_disclaimerAcknowledged';

export function DisclaimerGate({ children }: { children: React.ReactNode }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        setAcknowledged(stored === 'true');
      } catch {
        // localStorage unavailable
      }
    }
    setLoading(false);
  }, []);

  const handleAcknowledge = () => {
    setAcknowledged(true);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, 'true');
      } catch {
        // localStorage unavailable - continue anyway
      }
    }
  };

  if (loading) {
    return null;
  }

  if (!acknowledged) {
    return (
      <div className="disclaimer-gate" role="dialog" aria-modal="true" aria-labelledby="disclaimer-title">
        <div className="disclaimer-gate__content">
          <h1 id="disclaimer-title" className="disclaimer-gate__title">
            Important Safety Notice
          </h1>
          
          <div className="disclaimer-gate__body">
            <p className="disclaimer-gate__warning">
              <strong>This is not a medical device.</strong>
            </p>
            
            <p>
              This application is a prototype tool for educational and reference purposes only.
              It is <strong>not intended for treatment decisions</strong> or clinical use.
            </p>
            
            <ul className="disclaimer-gate__list">
              <li>
                <strong>Always verify</strong> the displayed drops/min with a manual count 
                using a stopwatch before making any adjustments to the IV flow rate.
              </li>
              <li>
                <strong>Do not rely</strong> on this app as a substitute for proper medical 
                equipment or clinical judgment.
              </li>
              <li>
                <strong>Check the drop factor</strong> printed on your IV administration set 
                packet and verify it matches the factor shown in the app.
              </li>
              <li>
                <strong>All video processing</strong> happens on your device. No frames are 
                uploaded or transmitted.
              </li>
            </ul>
            
            <p className="disclaimer-gate__responsibility">
              By continuing, you acknowledge that you understand these limitations and will 
              verify all readings manually before adjusting any infusion.
            </p>
          </div>
          
          <button
            type="button"
            className="disclaimer-gate__button"
            onClick={handleAcknowledge}
          >
            I understand — Continue to app
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function DisclaimerStrip() {
  return (
    <div className="disclaimer-strip" role="note" aria-label="Safety reminder">
      <strong>Not a medical device.</strong> Always verify with manual count before adjusting infusion.
    </div>
  );
}
