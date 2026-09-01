import { useState } from 'react';
import './DropFactorSelector.css';

const FACTORS = [10, 15, 20, 60] as const;
type Factor = (typeof FACTORS)[number];

export function DropFactorSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (factor: number) => void;
}) {
  const [pendingFactor, setPendingFactor] = useState<Factor | null>(null);

  const handleSelect = (newFactor: Factor) => {
    if (newFactor === value) {
      // Still show modal even for same value (per requirements)
      setPendingFactor(newFactor);
    } else {
      setPendingFactor(newFactor);
    }
  };

  const handleConfirm = () => {
    if (pendingFactor !== null) {
      onChange(pendingFactor);
      setPendingFactor(null);
    }
  };

  const handleCancel = () => {
    setPendingFactor(null);
  };

  const ratio = pendingFactor && value ? (pendingFactor / value).toFixed(1) : '';

  return (
    <>
      <div className="drop-factor-selector" role="group" aria-label="Drop factor">
        <label htmlFor="factor-select" className="drop-factor-selector__label">
          Factor:
        </label>
        <select
          id="factor-select"
          className="drop-factor-selector__select"
          value={value}
          onChange={(e) => handleSelect(Number(e.target.value) as Factor)}
          aria-label="Select drop factor in drops per milliliter"
        >
          {FACTORS.map((f) => (
            <option key={f} value={f}>
              {f} gtt/mL{f === 20 ? ' (default)' : ''}
            </option>
          ))}
        </select>
      </div>

      {pendingFactor !== null && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="modal">
            <h2 id="modal-title" className="modal__title">
              Confirm drop factor change
            </h2>
            <div className="modal__body">
              <p>
                <strong>Current factor:</strong> {value} gtt/mL
              </p>
              <p>
                <strong>New factor:</strong> {pendingFactor} gtt/mL
              </p>
              {ratio !== '1.0' && (
                <p className="modal__warning">
                  ⚠️ Changing from {value} → {pendingFactor} will report values ~{ratio}
                  × {ratio > '1' ? 'larger' : 'smaller'} for the same drops/min.
                </p>
              )}
              <p className="modal__guidance">
                Wrong drop factor changes reported volume by up to 3×. Verify the
                factor printed on your IV set packet before confirming.
              </p>
            </div>
            <div className="modal__actions">
              <button
                type="button"
                className="modal__button modal__button--cancel"
                onClick={handleCancel}
                autoFocus
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal__button modal__button--confirm"
                onClick={handleConfirm}
              >
                Confirm change to {pendingFactor} gtt/mL
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
