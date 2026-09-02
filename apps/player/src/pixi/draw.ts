/** Isometric cartoon bible, locked to Kenney Miniature Farm (30°×45°, CC0). */

export const BIBLE = {
  outline: "#3d2a16",
  sky: "#7ec8f0",
  skyDeep: "#4ea6d8",
  grass: "#6dcc52",
  grassDark: "#3f8a32",
  soil: "#8a5634",
  soilDark: "#4a2a16",
  wood: "#c9892a",
  woodDark: "#6b3f12",
  sun: "#ffe56a",
};

export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  return [c, ctx];
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

export function imageCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const [c, ctx] = canvas(img.naturalWidth || img.width, img.naturalHeight || img.height);
  ctx.drawImage(img, 0, 0);
  return c;
}

export function fitImage(img: CanvasImageSource, dw: number, dh: number): HTMLCanvasElement {
  const [c, ctx] = canvas(dw, dh);
  ctx.drawImage(img, 0, 0, dw, dh);
  return c;
}
