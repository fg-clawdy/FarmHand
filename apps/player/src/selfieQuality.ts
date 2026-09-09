export type SelfieQuality = { ok: true } | { ok: false; message: string };

type DetectedFace = { boundingBox: { x: number; y: number; width: number; height: number } };

function lumaStats(data: Uint8ClampedArray) {
  let sum = 0;
  let sumSq = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const y = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    sum += y;
    sumSq += y * y;
  }
  const mean = sum / pixels;
  const variance = sumSq / pixels - mean * mean;
  return { mean, variance };
}

function centerContrast(data: Uint8ClampedArray, width: number, height: number) {
  const x0 = Math.floor(width * 0.3);
  const x1 = Math.floor(width * 0.7);
  const y0 = Math.floor(height * 0.25);
  const y1 = Math.floor(height * 0.75);
  let sum = 0;
  let n = 0;
  for (let y = y0; y < y1; y += 2) {
    for (let x = x0; x < x1; x += 2) {
      const i = (y * width + x) * 4;
      sum += 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      n += 1;
    }
  }
  return n ? sum / n : 0;
}

async function detectFaces(canvas: HTMLCanvasElement): Promise<DetectedFace[] | null> {
  const Detector = (window as unknown as { FaceDetector?: new (opts: { fastMode: boolean }) => {
    detect: (src: HTMLCanvasElement) => Promise<DetectedFace[]>;
  } }).FaceDetector;
  if (!Detector) return null;
  try {
    const detector = new Detector({ fastMode: true });
    return await detector.detect(canvas);
  } catch {
    return null;
  }
}

export async function assessSelfieCanvas(canvas: HTMLCanvasElement): Promise<SelfieQuality> {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { ok: false, message: "The camera hiccuped. Try again." };
  const { width, height } = canvas;
  if (width < 64 || height < 64) {
    return { ok: false, message: "Scoot back so we can see your whole face." };
  }
  const data = ctx.getImageData(0, 0, width, height).data;
  const { mean, variance } = lumaStats(data);
  if (mean < 28) return { ok: false, message: "Too dark — find a brighter spot." };
  if (mean > 248) return { ok: false, message: "Too bright — turn away from the light." };
  if (variance < 80) return { ok: false, message: "Hold still — that one was blurry." };

  const faces = await detectFaces(canvas);
  if (faces) {
    if (!faces.length) {
      return { ok: false, message: "We couldn't see your face. Put it in the middle and try again." };
    }
    const box = faces[0]!.boundingBox;
    const cx = (box.x + box.width / 2) / width;
    const cy = (box.y + box.height / 2) / height;
    if (Math.abs(cx - 0.5) > 0.28 || Math.abs(cy - 0.5) > 0.32) {
      return { ok: false, message: "Move your face to the middle of the picture." };
    }
    return { ok: true };
  }

  const center = centerContrast(data, width, height);
  if (Math.abs(center - mean) < 8) {
    return { ok: false, message: "We couldn't see your face. Put it in the middle and try again." };
  }
  return { ok: true };
}
