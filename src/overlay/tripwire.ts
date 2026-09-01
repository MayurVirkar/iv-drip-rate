// Published contract for the vision layer (TEST-4).
//
// All values are normalized to the OVERLAY CONTAINER (typically `.stage`) as
// fractions in [0, 1]. The overlay renders a chamber-guide rectangle sized by
// CSS `aspect-ratio`, so its exact pixel width shifts with the container. What
// stays fixed is: the tripwire is horizontal, sits at the vertical middle of
// the container, and always falls inside the chamber-guide rectangle.
//
// TEST-4 should sample brightness along y = TRIPWIRE.y across the horizontal
// band [TRIPWIRE.x1, TRIPWIRE.x2]. That band is deliberately narrower than the
// visible rectangle so a slightly misframed chamber still yields chamber pixels.
export const TRIPWIRE = {
  y: 0.5,
  x1: 0.42,
  x2: 0.58,
} as const;

// Video preview must use `object-fit: cover` for this mapping to hold.
// Returns null if the video has not reported dimensions yet.
export function computeVideoTripwire(
  video: HTMLVideoElement,
  container: { width: number; height: number },
): { xStart: number; xEnd: number; y: number } | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || !container.width || !container.height) return null;

  const containerRatio = container.width / container.height;
  const videoRatio = vw / vh;

  let renderedW: number;
  let renderedH: number;
  if (videoRatio > containerRatio) {
    renderedH = container.height;
    renderedW = renderedH * videoRatio;
  } else {
    renderedW = container.width;
    renderedH = renderedW / videoRatio;
  }
  const scale = vw / renderedW;
  const offsetX = (container.width - renderedW) / 2;
  const offsetY = (container.height - renderedH) / 2;

  const cx1 = TRIPWIRE.x1 * container.width;
  const cx2 = TRIPWIRE.x2 * container.width;
  const cy = TRIPWIRE.y * container.height;

  return {
    xStart: Math.round((cx1 - offsetX) * scale),
    xEnd: Math.round((cx2 - offsetX) * scale),
    y: Math.round((cy - offsetY) * scale),
  };
}
