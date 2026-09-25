from pathlib import Path

engine = Path(r"C:\Users\theha\Documents\GIT\FarmHand\apps\player\src\pixi\engine.ts")
text = engine.read_text(encoding="utf-8")
old = """    await app.init({
      background: 0x3d8a32,
      backgroundAlpha: 1,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      powerPreference: \"high-performance\",
      preference: \"webgl\",
      width: 800,
      height: 600,
    });"""
new = """    // Firefox Android PWAs often fail to present textures with
    // powerPreference \"high-performance\" — you get the clear color (green)
    // while hit-testing still works. Prefer default GPU + allow WebGL1.
    await app.init({
      background: 0x3d8a32,
      backgroundAlpha: 1,
      antialias: false,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      powerPreference: \"default\",
      preference: \"webgl\",
      preferWebGLVersion: 1,
      width: 800,
      height: 600,
    });"""
if old not in text:
    raise SystemExit("engine init block not found")
engine.write_text(text.replace(old, new), encoding="utf-8", newline="\n")
print("engine patched")

draw = Path(r"C:\Users\theha\Documents\GIT\FarmHand\apps\player\src\pixi\draw.ts")
d = draw.read_text(encoding="utf-8")
old2 = """export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = \"anonymous\";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}"""
new2 = """export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Only set CORS for cross-origin URLs. Same-origin + anonymous without
    // ACAO headers can blank canvas-packed textures in Firefox.
    if (/^https?:\\/\\//i.test(src) && !src.startsWith(location.origin)) {
      img.crossOrigin = \"anonymous\";
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}"""
if old2 not in d:
    raise SystemExit("loadImage not found")
draw.write_text(d.replace(old2, new2), encoding="utf-8", newline="\n")
print("draw patched")
