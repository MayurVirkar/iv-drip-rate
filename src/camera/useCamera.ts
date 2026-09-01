import { useCallback, useEffect, useRef, useState } from 'react';
import type { CameraError, CameraErrorKind, CameraState } from './types';

const VIDEO_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280 },
    height: { ideal: 720 },
  },
};

function classify(err: unknown): CameraError {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return {
          kind: 'permission-denied',
          message:
            'Camera permission is blocked. Open browser site settings, allow camera, then retry.',
        };
      case 'NotFoundError':
      case 'OverconstrainedError':
        return {
          kind: 'no-device',
          message:
            'No rear camera was found on this device.',
        };
      case 'NotReadableError':
      case 'AbortError':
        return {
          kind: 'in-use',
          message:
            'Camera is unavailable right now. Close other apps using the camera and retry.',
        };
    }
  }
  return {
    kind: 'unknown',
    message:
      err instanceof Error && err.message
        ? err.message
        : 'Could not start the camera.',
  };
}

export interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  state: CameraState;
  error: CameraError | null;
  start: () => Promise<void>;
  stop: () => void;
}

export function useCamera(): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>(() =>
    supportsCamera() ? 'idle' : 'unsupported',
  );
  const [error, setError] = useState<CameraError | null>(() =>
    supportsCamera() ? null : unsupportedError(),
  );

  const stop = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => {
        t.onended = null;
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
  }, []);

  const attachStream = useCallback(
    async (stream: MediaStream) => {
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        // Component unmounted between request and resolve — release.
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        return;
      }
      video.srcObject = stream;
      // iOS Safari needs an explicit play() after srcObject; ignore AbortError
      // if the tab hides before play resolves.
      try {
        await video.play();
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        throw err;
      }
    },
    [],
  );

  const start = useCallback(async () => {
    if (!supportsCamera()) {
      setError(unsupportedError());
      setState('unsupported');
      return;
    }
    setError(null);
    setState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        VIDEO_CONSTRAINTS,
      );

      // Wire per-track ended handler BEFORE attach so an immediate end still
      // flips to error.
      stream.getTracks().forEach((track) => {
        track.onended = () => {
          const active = streamRef.current;
          if (!active) return;
          if (active.getTracks().every((t) => t.readyState === 'ended')) {
            stop();
            setError({
              kind: 'stream-ended',
              message:
                'Camera stream ended unexpectedly. Tap retry to start again.',
            });
            setState('error');
          }
        };
      });

      await attachStream(stream);
      setState('active');
    } catch (err) {
      stop();
      const classified = classify(err);
      setError(classified);
      setState(
        classified.kind === 'insecure-context' || classified.kind === 'unsupported'
          ? 'unsupported'
          : 'error',
      );
    }
  }, [attachStream, stop]);

  // visibilitychange: stop when hidden so the OS reclaims the camera; on
  // return we go to `paused` and require a fresh gesture to resume (Safari
  // policy allows resume without a fresh tap only if the tab stayed alive,
  // but a nurse-facing app should be explicit either way).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && streamRef.current) {
        stop();
        setState('paused');
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [stop]);

  // Teardown on unmount.
  useEffect(() => stop, [stop]);

  return { videoRef, state, error, start, stop };
}

function supportsCamera(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (!navigator.mediaDevices?.getUserMedia) return false;
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return false;
  }
  return true;
}

function unsupportedError(): CameraError {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return {
      kind: 'insecure-context' satisfies CameraErrorKind,
      message:
        'Camera capture requires HTTPS. Open the production URL over HTTPS to continue.',
    };
  }
  return {
    kind: 'unsupported',
    message: 'This browser does not support camera capture.',
  };
}
