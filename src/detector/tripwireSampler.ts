import { computeVideoTripwire } from '../overlay/tripwire';

// Samples mean rec709 luma along the TRIPWIRE band from the given <video>.
// Uses one persistent offscreen canvas sized to the current band width,
// resized only when the band width changes. The band is `bandHeight` rows
// tall centered on the tripwire y, which averages away single-row noise
// without blurring across the drop's leading edge (a drop is ~5-15 rows in
// 720p at typical framing).

export interface Sampler {
  sample: (
    video: HTMLVideoElement,
    container: { width: number; height: number },
  ) => number | null;
  readonly bandHeight: number;
}

export function createSampler(bandHeight = 3): Sampler {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = bandHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('detector: 2d canvas context unavailable');
  }

  return {
    bandHeight,
    sample(video, container) {
      const region = computeVideoTripwire(video, container);
      if (!region) return null;
      const width = region.xEnd - region.xStart;
      if (width <= 0) return null;

      const halfBand = Math.floor(bandHeight / 2);
      const sy = Math.max(0, region.y - halfBand);

      if (canvas.width !== width) {
        canvas.width = width;
      }

      ctx.drawImage(
        video,
        region.xStart,
        sy,
        width,
        bandHeight,
        0,
        0,
        width,
        bandHeight,
      );

      const data = ctx.getImageData(0, 0, width, bandHeight).data;
      const pixelCount = data.length / 4;
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        // Rec.709 luma. Alpha is ignored — camera frames are always opaque.
        sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      }
      return sum / pixelCount;
    },
  };
}
