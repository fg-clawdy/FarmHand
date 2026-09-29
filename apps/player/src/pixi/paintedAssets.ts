import { CROP_KINDS, type CropKind } from "@farmhand/shared";
import { Assets, Rectangle, Texture } from "pixi.js";

export const CROP_STAGE_FRAMES = 4;
/**
 * Approved crop sheets: plant + clumpy soil disc as one unit.
 * Four equal padded cells (480). Heights differ. Packed 392-wide sheets
 * stored left foliage in the previous cell; scraps are restored. Strawberry
 * frames: seed, sprout, 3-flower/green-berry, ripe. Do not mirror-replace
 * the flowering cell — that deletes the third blossom.
 */
export const CROP_SHEET = { width: 1920, frames: 4 } as const;
export const CROP_FRAME_WIDTH = CROP_SHEET.width / CROP_SHEET.frames;
export const CROP_SHEET_HEIGHT: Record<CropKind, number> = {
  corn: 854,
  strawberry: 464,
  cotton: 623,
  /** Placeholders — art not yet painted. Use corn dimensions. */
  tomato: 854,
  pumpkin: 854,
  sunflower: 854,
};

type Disc = { x: number; y: number; d: number };

/**
 * Soil-disc center and diameter in each 480-wide unpacked cell.
 * Pivot the sprite here so the disc — not the cell midpoint — sits on the mound UV.
 */
export const CROP_DISC_IN_CELL: Record<CropKind, readonly Disc[]> = {
  corn: [
    { x: 240, y: 763, d: 316 },
    { x: 236, y: 768, d: 312 },
    { x: 239, y: 766, d: 300 },
    { x: 223, y: 766, d: 311 },
  ],
  strawberry: [
    { x: 233, y: 353, d: 290 },
    { x: 247, y: 364, d: 284 },
    { x: 233, y: 380, d: 283 },
    { x: 234, y: 350, d: 310 },
  ],
  cotton: [
    { x: 238, y: 498, d: 325 },
    { x: 210, y: 504, d: 320 },
    { x: 208, y: 511, d: 307 },
    { x: 228, y: 501, d: 322 },
  ],
  /** Placeholders — art not yet painted. Reuse corn disc measurements. */
  tomato: [
    { x: 240, y: 763, d: 316 },
    { x: 236, y: 768, d: 312 },
    { x: 239, y: 766, d: 300 },
    { x: 223, y: 766, d: 311 },
  ],
  pumpkin: [
    { x: 240, y: 763, d: 316 },
    { x: 236, y: 768, d: 312 },
    { x: 239, y: 766, d: 300 },
    { x: 223, y: 766, d: 311 },
  ],
  sunflower: [
    { x: 240, y: 763, d: 316 },
    { x: 236, y: 768, d: 312 },
    { x: 239, y: 766, d: 300 },
    { x: 223, y: 766, d: 311 },
  ],
};

/** Fallback when a frame has no measured disc. */
export const PLANT_DISC_ANCHOR = { x: 0.5, y: 0.88 } as const;

/** On-texture disc cover. 80% of the first soil-disc pass so plants stay inside neighbors. */
export const PLANT_COVER_FACTOR = 0.8;
export const ZOOM_MOUND_COVER_PX = Math.round(220 * PLANT_COVER_FACTOR);
export const FARM_MOUND_COVER_PX = Math.round(80 * PLANT_COVER_FACTOR);

/** @deprecated plant-only leftover; disc cover is the live scale. */
export const FARM_PLANT_HEIGHT_PX = FARM_MOUND_COVER_PX;
/** Nominal bury into mound (~8% mid). Prefer cropSinkPx(stage, cover, kind). */
export const FARM_PLANT_BURY_PX = Math.round(FARM_MOUND_COVER_PX * 0.08);
export const ZOOM_PLANT_HEIGHT_PX = ZOOM_MOUND_COVER_PX;
/** Nominal bury into mound (~8% mid). Prefer cropSinkPx(stage, cover, kind). */
export const ZOOM_PLANT_BURY_PX = Math.round(ZOOM_MOUND_COVER_PX * 0.08);
/** @deprecated use CROP_SHEET_HEIGHT[kind] */
export const CROP_FRAME_HEIGHT = CROP_SHEET_HEIGHT.corn;

/** Padded 4-frame eat/graze PNG with real alpha (equal cells; Pixi insets so frames never share pixels). */
export const COW_EAT_SHEET = { width: 1704, height: 304, frames: 4 } as const;
/** 4-frame Wanted poster sheet: pinned, tearing, empty, pinning up. Equal 315×470 cells. */
export const WANTED_POSTER_SHEET = { width: 1260, height: 470, frames: 4 } as const;
/**
 * Aged Wanted paper inside each cell. Crop to the paper inset so only the flyer
 * layers on the standing cork (no second cork plate, no paper bolts).
 */
export const WANTED_POSTER_PAPER_INSET = { x: 28, y: 20, w: 258, h: 386 } as const;
/**
 * Standing corkboard PNG includes posts + grass. Loaded full as a ground stake.
 * Hang rect is the cork face (no posts) used to nest the paper poster.
 */
export const CORKBOARD_HANG = { x: 6, y: 4, w: 708, h: 556 } as const;

export const PAINTED_ART = {
  playfield: "/art/painted/farmhand_painted_playfield_v3_no_static_cow.jpg",
  gardenZoom: "/art/painted/garden/garden_zoom_3x3.jpg",
  smoke: "/art/painted/tractor_exhaust_smoke_sheet.png",
  /** Two separate PNGs with real alpha — never sliced from a combined walk/eat sheet. */
  cowWalk: ["/art/painted/cow_walk_frame_a.png", "/art/painted/cow_walk_frame_b.png"],
  /** Must stay PNG so eat frames keep a transparent background. */
  cowEat: "/art/painted/cow_eat_sheet.png",
  corkboard: "/art/painted/farm/corkboard.png",
  wantedPoster: "/art/painted/farm/wanted_poster_sheet.png",
  crops: {
    corn: "/art/painted/plants/plant_corn_stages.png?v=3blossom",
    strawberry: "/art/painted/plants/plant_strawberry_stages.png?v=3blossom",
    cotton: "/art/painted/plants/plant_cotton_stages.png?v=3blossom",
    /** Placeholders — art not yet painted for these crops. */
    tomato: "/art/painted/plants/plant_tomato_stages.png?v=1",
    pumpkin: "/art/painted/plants/plant_pumpkin_stages.png?v=1",
    sunflower: "/art/painted/plants/plant_sunflower_stages.png?v=1",
  },
  /** Wide shallow painted harvest tray (body behind produce; no handle). */
  harvestBasket: "/art/painted/garden/harvest_basket.png?v=3shallow",
  /** Front rim/lip drawn over produce bottoms (same canvas / true alpha nesting). */
  harvestBasketRim: "/art/painted/garden/harvest_basket_rim.png?v=3shallow",
} as const;

export type PaintedArt = {
  playfield: Texture;
  gardenZoom: Texture;
  smokeFrames: Texture[];
  cowWalk: Texture[];
  cowEat: Texture[];
  corkboard: Texture;
  wantedPosterFrames: Texture[];
  crops: Record<CropKind, Texture[]>;
  harvestBasket: Texture;
  harvestBasketRim: Texture;
};

/** 2px inset so adjacent frames never share an edge pixel (stops filter bleed). */
export const SHEET_INSET = 2;

export function sheetFrameRects(
  sheetW: number,
  sheetH: number,
  frames: number,
  inset: number = SHEET_INSET,
): Array<{ x: number; y: number; w: number; h: number }> {
  const cell = Math.floor(sheetW / frames);
  return Array.from({ length: frames }, (_, i) => ({
    x: i * cell + inset,
    y: inset,
    w: cell - inset * 2,
    h: sheetH - inset * 2,
  }));
}

export function sliceSheet(texture: Texture, frames: number, inset: number = SHEET_INSET): Texture[] {
  return sheetFrameRects(texture.width, texture.height, frames, inset).map(
    (rect) =>
      new Texture({
        source: texture.source,
        // Frame is atlas pixels; orig is local sprite size from (0,0) so trim/UV
        // math never treats frame.x as a sprite offset (would slide discs off mounds).
        frame: new Rectangle(rect.x, rect.y, rect.w, rect.h),
        orig: new Rectangle(0, 0, rect.w, rect.h),
      }),
  );
}

/** Paper-only Wanted frames — same size for pinned / tearing / torn / pinning. */
export function wantedPosterFrameRects(): Array<{ x: number; y: number; w: number; h: number }> {
  const cell = Math.floor(WANTED_POSTER_SHEET.width / WANTED_POSTER_SHEET.frames);
  const { x, y, w, h } = WANTED_POSTER_PAPER_INSET;
  return Array.from({ length: WANTED_POSTER_SHEET.frames }, (_, i) => ({
    x: i * cell + x,
    y,
    w,
    h,
  }));
}

export function sliceWantedPoster(texture: Texture): Texture[] {
  return wantedPosterFrameRects().map(
    (rect) =>
      new Texture({
        source: texture.source,
        frame: new Rectangle(rect.x, rect.y, rect.w, rect.h),
        orig: new Rectangle(0, 0, rect.w, rect.h),
      }),
  );
}

export function cropStageFrame(crops: Record<CropKind, Texture[]>, kind: CropKind, stage: 1 | 2 | 3 | 4): Texture {
  return crops[kind]?.[stage - 1] ?? Texture.EMPTY;
}

/**
 * Measured CROP_DISC_IN_CELL diameters include fringe past the dark cookie.
 * Planted uses a steeper hide so the speckled plate is gone; picked keeps more
 * low fruit for the basket (cookie tip is buried behind the rim / brim mask).
 */
export const DISC_HIDE_RADIUS_FRAC = 0.4;
/** Planted mound: cut deeper into the measured disc so no cookie fringe remains. */
export const PLANTED_DISC_HIDE_FRAC = 0.48;
/** Basket picked art: keep hanging berries; only shave the lower cookie. */
export const PICKED_DISC_HIDE_FRAC = 0.25;

/** Y in full cell space of the soil-cookie hide line for the given frac. */
export function cropDiscHideTopInCell(
  kind: CropKind,
  stage: 1 | 2 | 3 | 4,
  hideFrac: number = DISC_HIDE_RADIUS_FRAC,
): number | null {
  const disc = cropDisc(kind, stage);
  if (!disc) return null;
  return disc.y - disc.d * hideFrac;
}

/**
 * Hard-rect clip of the baked soil disc. Stem pad keeps a few pixels of stem;
 * never the speckled cookie. Frame math matches `sliceSheet` insets.
 */
export function cropFoliageFrame(
  crops: Record<CropKind, Texture[]>,
  kind: CropKind,
  stage: 1 | 2 | 3 | 4,
  stemPad = 4,
  hideFrac: number = DISC_HIDE_RADIUS_FRAC,
): Texture {
  const full = cropStageFrame(crops, kind, stage);
  if (full === Texture.EMPTY || !full.source) return full;
  const hideTop = cropDiscHideTopInCell(kind, stage, hideFrac);
  const frame = full.frame;
  if (hideTop == null) return full;
  const hideTopInFrame = hideTop - SHEET_INSET;
  // Keep a little stem, never the mud cookie.
  const height = Math.max(24, Math.round(hideTopInFrame - stemPad));
  const clipped = Math.min(height, frame.height - 4);
  return new Texture({
    source: full.source,
    frame: new Rectangle(frame.x, frame.y, frame.width, clipped),
    orig: new Rectangle(0, 0, frame.width, clipped),
  });
}

const plantedFrameCache = new Map<string, Texture>();

/**
 * Planted mound crop: clip the baked soil cookie, then soft-fade the stem foot
 * so the hard scissor bar blends into the mound (no Graphics dirt-lip oval).
 */
export function cropPlantedFrame(
  crops: Record<CropKind, Texture[]>,
  kind: CropKind,
  stage: 1 | 2 | 3 | 4,
): Texture {
  const key = `planted:${kind}:${stage}`;
  const hit = plantedFrameCache.get(key);
  if (hit) return hit;
  const hard = cropFoliageFrame(crops, kind, stage, 4, PLANTED_DISC_HIDE_FRAC);
  const faded = softFadeTextureFoot(hard, 0.22);
  plantedFrameCache.set(key, faded);
  return faded;
}

const pickedFrameCache = new Map<string, Texture>();

/** Ripe crop for the basket — keep hanging fruit; shave only the lower cookie. */
export function cropPickedFrame(crops: Record<CropKind, Texture[]>, kind: CropKind): Texture {
  const key = `picked:${kind}`;
  const hit = pickedFrameCache.get(key);
  if (hit) return hit;
  // Strawberry/tomato: berry window — drop the leafy canopy so the bowl reads as fruit.
  const tex =
    kind === "strawberry" || kind === "tomato"
      ? cropBerryWindowFrame(crops, kind)
      : cropFoliageFrame(crops, kind, 4, 2, PICKED_DISC_HIDE_FRAC);
  pickedFrameCache.set(key, tex);
  return tex;
}

/** Lower-plant window for bushy fruit — berries dominate, leaves mostly cropped off. */
function cropBerryWindowFrame(
  crops: Record<CropKind, Texture[]>,
  kind: CropKind,
): Texture {
  const full = cropStageFrame(crops, kind, 4);
  if (full === Texture.EMPTY || !full.source) return full;
  const hideTop = cropDiscHideTopInCell(kind, 4, PICKED_DISC_HIDE_FRAC);
  if (hideTop == null) return cropFoliageFrame(crops, kind, 4, 2, PICKED_DISC_HIDE_FRAC);
  const frame = full.frame;
  const hideTopInFrame = hideTop - SHEET_INSET;
  const bottom = Math.max(24, Math.round(hideTopInFrame - 2));
  // Keep ~42% of the cell above the cookie — fruit belt, not the leafy crown.
  const windowH = Math.max(64, Math.round((CROP_SHEET_HEIGHT[kind] - SHEET_INSET * 2) * 0.42));
  const top = Math.max(0, bottom - windowH);
  const height = Math.min(bottom - top, frame.height - top);
  return new Texture({
    source: full.source,
    frame: new Rectangle(frame.x, frame.y + top, frame.width, height),
    orig: new Rectangle(0, 0, frame.width, height),
  });
}

/** Soft-alpha the bottom band of a texture so stem feet blend into the mound. */
function softFadeTextureFoot(tex: Texture, fadeFrac: number): Texture {
  if (tex === Texture.EMPTY || !tex.source) return tex;
  const frame = tex.frame;
  const fadePx = Math.max(12, Math.round(frame.height * fadeFrac));
  const solidH = Math.max(8, Math.round(frame.height - fadePx));
  if (typeof document === "undefined") return tex;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(frame.width));
  canvas.height = Math.max(1, Math.round(frame.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) return tex;
  const image = (tex.source as { resource?: CanvasImageSource }).resource;
  if (!image) return tex;
  try {
    ctx.drawImage(
      image,
      frame.x,
      frame.y,
      frame.width,
      frame.height,
      0,
      0,
      frame.width,
      frame.height,
    );
  } catch {
    return tex;
  }
  const img = ctx.getImageData(0, solidH, canvas.width, fadePx);
  const data = img.data;
  for (let y = 0; y < fadePx; y++) {
    const aMul = 1 - (y + 1) / (fadePx + 1);
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4 + 3;
      data[i] = Math.round(data[i]! * aMul);
    }
  }
  ctx.putImageData(img, 0, solidH);
  return Texture.from(canvas);
}

export function cropDisc(kind: CropKind, stage: 1 | 2 | 3 | 4): Disc | undefined {
  return CROP_DISC_IN_CELL[kind]?.[stage - 1];
}

/** Pixi pivot so the soil-disc center sits on the mound UV. */
export function cropDiscAnchor(kind: CropKind, stage: 1 | 2 | 3 | 4) {
  const disc = cropDisc(kind, stage);
  if (!disc) return { x: PLANT_DISC_ANCHOR.x, y: PLANT_DISC_ANCHOR.y };
  const fw = CROP_FRAME_WIDTH - SHEET_INSET * 2;
  const fh = CROP_SHEET_HEIGHT[kind] - SHEET_INSET * 2;
  return {
    x: (disc.x - SHEET_INSET) / fw,
    y: (disc.y - SHEET_INSET) / fh,
  };
}

/** @deprecated name from the plant-only pass; same as cropDiscAnchor. */
export const cropStemAnchor = cropDiscAnchor;

/** Uniform scale so this frame's soil disc matches `coverPx` on the playfield. */
export function cropCoverScale(kind: CropKind, stage: 1 | 2 | 3 | 4, coverPx: number) {
  const disc = cropDisc(kind, stage);
  const d = disc?.d || CROP_FRAME_WIDTH;
  return coverPx / d;
}

export async function loadPaintedArt(): Promise<PaintedArt> {
  const urls = [
    PAINTED_ART.playfield,
    PAINTED_ART.gardenZoom,
    PAINTED_ART.smoke,
    ...PAINTED_ART.cowWalk,
    PAINTED_ART.cowEat,
    PAINTED_ART.corkboard,
    PAINTED_ART.wantedPoster,
    ...CROP_KINDS.map((kind) => PAINTED_ART.crops[kind]),
    PAINTED_ART.harvestBasket,
    PAINTED_ART.harvestBasketRim,
  ];
  // Drop only URLs that are actually cached. Blind Assets.unload on misses
  // logs "was not found in the Cache" and can leave half-dead GPU sources on
  // the shared canvas during farm↔garden remounts (mobile Firefox).
  for (const url of urls) {
    try {
      if (Assets.cache.has(url)) await Assets.unload(url);
    } catch {
      /* miss or already gone */
    }
  }
  const loaded = await Promise.all(
    urls.map(async (url) => {
      const tex = await Assets.load<Texture>(url);
      if (!tex || tex === Texture.EMPTY || !tex.source) {
        throw new Error(`Painted asset missing GPU source after load: ${url}`);
      }
      return tex;
    }),
  );
  const [
    playfield,
    gardenZoom,
    smoke,
    walkA,
    walkB,
    eat,
    corkboard,
    wantedPoster,
    ...rest
  ] = loaded as [
    Texture,
    Texture,
    Texture,
    Texture,
    Texture,
    Texture,
    Texture,
    Texture,
    ...Texture[],
  ];
  const cropSheets = rest.slice(0, CROP_KINDS.length);
  const harvestBasket = rest[CROP_KINDS.length]!;
  const harvestBasketRim = rest[CROP_KINDS.length + 1]!;
  const crops = {} as Record<CropKind, Texture[]>;
  CROP_KINDS.forEach((kind, i) => {
    crops[kind] = sliceSheet(cropSheets[i]!, CROP_STAGE_FRAMES);
  });
  return {
    playfield,
    gardenZoom,
    smokeFrames: sliceSheet(smoke, 6),
    cowWalk: [walkA, walkB],
    cowEat: sliceSheet(eat, COW_EAT_SHEET.frames),
    corkboard,
    wantedPosterFrames: sliceWantedPoster(wantedPoster),
    crops,
    harvestBasket,
    harvestBasketRim,
  };
}
