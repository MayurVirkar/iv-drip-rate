import { useEffect, useRef } from 'react';

// navigator.wakeLock is not in older lib.dom typings.
type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
};

/**
 * Keeps the screen awake while `active` is true. Re-requests on
 * visibilitychange (browsers auto-release the sentinel on tab hide).
 * No-ops silently on browsers without the Wake Lock API.
 */
export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    let cancelled = false;
    const nav = navigator as NavigatorWithWakeLock;
    if (!nav.wakeLock) return;

    const request = async () => {
      if (!activeRef.current) return;
      if (document.visibilityState !== 'visible') return;
      if (sentinelRef.current && !sentinelRef.current.released) return;
      try {
        const sentinel = await nav.wakeLock!.request('screen');
        if (cancelled || !activeRef.current) {
          await sentinel.release().catch(() => undefined);
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener('release', () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null;
        });
      } catch {
        // Wake lock is best-effort — never block the app on it.
      }
    };

    const release = async () => {
      const s = sentinelRef.current;
      sentinelRef.current = null;
      if (s && !s.released) {
        await s.release().catch(() => undefined);
      }
    };

    if (active) {
      request();
    } else {
      release();
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && activeRef.current) {
        request();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      release();
    };
  }, [active]);
}
