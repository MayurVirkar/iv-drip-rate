import { forwardRef } from 'react';
import type { CameraError, CameraState } from './types';

export interface CameraViewProps {
  state: CameraState;
  error: CameraError | null;
  onStart: () => void;
}

/**
 * Renders the camera surface + all pre/failure/paused states. The <video>
 * element is always mounted so the ref stays stable across state changes —
 * the vision layer (TEST-4) subscribes to it via requestVideoFrameCallback.
 */
export const CameraView = forwardRef<HTMLVideoElement, CameraViewProps>(
  function CameraView({ state, error, onStart }, ref) {
    const showingVideo = state === 'active';

    return (
      <div className="camera" data-state={state}>
        <video
          ref={ref}
          className="camera__video"
          autoPlay
          muted
          playsInline
          aria-hidden={!showingVideo}
          style={{ visibility: showingVideo ? 'visible' : 'hidden' }}
        />

        {state === 'idle' && (
          <StartPanel
            title="Point the rear camera at the drip chamber"
            body={
              <>
                We ask the browser for camera permission next.{' '}
                <strong>No video leaves your phone</strong> — every frame stays
                on this device.
              </>
            }
            cta="Start camera"
            onClick={onStart}
          />
        )}

        {state === 'requesting' && (
          <Overlay>
            <Spinner />
            <div className="camera__hint">
              Waiting for camera permission…
            </div>
          </Overlay>
        )}

        {state === 'paused' && (
          <StartPanel
            title="Camera paused"
            body="Screen went away — tap resume to start the preview again."
            cta="Resume camera"
            onClick={onStart}
          />
        )}

        {state === 'error' && error && (
          <StartPanel
            title={errorTitle(error.kind)}
            body={error.message}
            cta="Retry"
            onClick={onStart}
            variant="error"
          />
        )}

        {state === 'unsupported' && error && (
          <Overlay variant="error">
            <div className="camera__title">{errorTitle(error.kind)}</div>
            <p className="camera__body">{error.message}</p>
          </Overlay>
        )}
      </div>
    );
  },
);

function errorTitle(kind: CameraError['kind']): string {
  switch (kind) {
    case 'permission-denied':
      return 'Camera permission blocked';
    case 'no-device':
      return 'No camera found';
    case 'in-use':
      return 'Camera is busy';
    case 'insecure-context':
      return 'HTTPS required';
    case 'unsupported':
      return 'Camera not supported';
    case 'stream-ended':
      return 'Camera stopped';
    default:
      return 'Camera error';
  }
}

interface StartPanelProps {
  title: string;
  body: React.ReactNode;
  cta: string;
  onClick: () => void;
  variant?: 'error';
}

function StartPanel({ title, body, cta, onClick, variant }: StartPanelProps) {
  return (
    <Overlay variant={variant}>
      <div className="camera__title">{title}</div>
      <p className="camera__body">{body}</p>
      <button
        type="button"
        className="camera__cta"
        onClick={onClick}
        data-variant={variant ?? 'primary'}
      >
        {cta}
      </button>
    </Overlay>
  );
}

function Overlay({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant?: 'error';
}) {
  return (
    <div className="camera__overlay" data-variant={variant ?? 'default'}>
      <div className="camera__panel">{children}</div>
    </div>
  );
}

function Spinner() {
  return <div className="camera__spinner" aria-hidden="true" />;
}
