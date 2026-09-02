/** Shared 3/4 painted-cartoon drawing helpers. Light from upper-right, shadows lower-left. */

export const BIBLE = {
  outline: "#3d2a16",
  sky: "#6ec8f0",
  grass: "#5fbe4a",
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

export function ellipseShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.28) {
  ctx.save();
  ctx.fillStyle = `rgba(26, 36, 16, ${a})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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

export function fitImage(img: HTMLImageElement, size: number): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  const s = Math.min(size / img.width, size / img.height);
  const w = img.width * s;
  const h = img.height * s;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  return c;
}
