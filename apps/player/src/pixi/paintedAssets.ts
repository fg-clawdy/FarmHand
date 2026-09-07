import { CROP_KINDS, type CropKind } from "@farmhand/shared";
import { Assets, Rectangle, Texture } from "pixi.js";

export const CROP_STAGE_FRAMES = 4;
/** Plant-only sheets: 1440×720, four equal cells. Stems are NOT at cell-center. */
export const CROP_SHEET = { width: 1440, height: 720, frames: 4 } as const;
export const CROP_FRAME_WIDTH = CROP_SHEET.width / CROP_SHEET.frames;
export const CROP_FRAME_HEIGHT = CROP_SHEET.height;
/**
 * Stem/seed in each cleaned 360×720 cell (gutter scraps removed, stem recentered).
 * One connected blob per frame; pivot is bottom-center of that stem.
 */
const STEM = { x: 180, y: 712 } as const;
export const CROP_STEM_IN_CELL: Record<CropKind, ReadonlyArray<{ x: number; y: number }>> = {
  corn: [STEM, STEM, STEM, STEM],
  strawberry: [STEM, STEM, STEM, STEM],
  cotton: [STEM, STEM, STEM, STEM],
};
/** Fallback when a frame has no measured stem. */
export const PLANT_STEM_ANCHOR = { x: 0.5, y: 1 } as const;
/** On-texture height of a full crop frame on the farm playfield. */
export const FARM_PLANT_HEIGHT_PX = 34;
/** Extra pixels down so the stem sits in the dirt, not on the highlight. */
export const FARM_PLANT_BURY_PX = 4;
/**
 * Zoom height of a full 720px frame. Row spacing is ~223px — keep the mature
 * stalk inside its own mound so it does not draw on the plot above.
 */
export const ZOOM_PLANT_HEIGHT_PX = 115;
export const ZOOM_PLANT_BURY_PX = 12;

/** Padded 4-frame eat/graze PNG with real alpha (equal cells; Pixi insets so frames never share pixels). */
export const COW_EAT_SHEET = { width: 1704, height: 304, frames: 4 } as const;
/** Each standalone walk PNG is one full cow on this canvas. */
export const COW_WALK_FRAME = { width: 426, height: 304 } as const;

export const PAINTED_ART = {
  playfield: "/art/painted/farmhand_painted_playfield_v3_no_static_cow.jpg",
  gardenZoom: "/art/painted/garden/garden_zoom_3x3.jpg",
  smoke: "/art/painted/tractor_exhaust_smoke_sheet.png",
  /** Two separate PNGs with real alpha — never sliced from a combined walk/eat sheet. */
  cowWalk: ["/art/painted/cow_walk_frame_a.png", "/art/painted/cow_walk_frame_b.png"],
  /** Must stay PNG so eat frames keep a transparent background. */
  cowEat: "/art/painted/cow_eat_sheet.png",
  crops: {
    corn: "/art/painted/plants/plant_corn_stages.png",
    strawberry: "/art/painted/plants/plant_strawberry_stages.png",
    cotton: "/art/painted/plants/plant_cotton_stages.png",
  },
} as const;

export type PaintedArt = {
  playfield: Texture;
  gardenZoom: Texture;
  smokeFrames: Texture[];
  cowWalk: Texture[];
  cowEat: Texture[];
  crops: Record<CropKind, Texture[]>;
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
        frame: new Rectangle(rect.x, rect.y, rect.w, rect.h),
      }),
  );
}

export function cropStageFrame(crops: Record<CropKind, Texture[]>, kind: CropKind, stage: 1 | 2 | 3 | 4): Texture {
  return crops[kind]?.[stage - 1] ?? Texture.EMPTY;
}

/** Pixi pivot for a sliced crop frame so the stem, not the cell midpoint, sits on the UV. */
export function cropStemAnchor(kind: CropKind, stage: 1 | 2 | 3 | 4) {
  const cell = CROP_STEM_IN_CELL[kind]?.[stage - 1];
  if (!cell) return { x: PLANT_STEM_ANCHOR.x, y: PLANT_STEM_ANCHOR.y };
  const fw = CROP_FRAME_WIDTH - SHEET_INSET * 2;
  const fh = CROP_FRAME_HEIGHT - SHEET_INSET * 2;
  return {
    x: (cell.x - SHEET_INSET) / fw,
    y: (cell.y - SHEET_INSET) / fh,
  };
}

export async function loadPaintedArt(): Promise<PaintedArt> {
  const [playfield, gardenZoom, smoke, walkA, walkB, eat, ...cropSheets] = await Promise.all([
    Assets.load<Texture>(PAINTED_ART.playfield),
    Assets.load<Texture>(PAINTED_ART.gardenZoom),
    Assets.load<Texture>(PAINTED_ART.smoke),
    Assets.load<Texture>(PAINTED_ART.cowWalk[0]),
    Assets.load<Texture>(PAINTED_ART.cowWalk[1]),
    Assets.load<Texture>(PAINTED_ART.cowEat),
    ...CROP_KINDS.map((kind) => Assets.load<Texture>(PAINTED_ART.crops[kind])),
  ]);
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
    crops,
  };
}
