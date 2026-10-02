import { trayWindow, type PublicSharedGoal } from "@farmhand/shared";

/** Two open shelves, like a little library of books. */
export const LIBRARY_SHELF_COUNT = 2;

/**
 * Jars that fit before a +N chip. Wider than the old tube tray so a handful
 * of goals still read as jars, then the existing overflow sheet takes the rest.
 */
export const LIBRARY_JAR_CAPACITY = 8;

export type LibrarySlotKind = "jar" | "overflow";

export type LibrarySlot = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: LibrarySlotKind;
  shelf: 0 | 1;
};

export type LibraryShelf = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type LibraryShelfLayout = {
  /** The box stays up with empty shelves when there are no goals. */
  visible: true;
  hero: boolean;
  shelves: [LibraryShelf, LibraryShelf];
  slots: LibrarySlot[];
};

export type LibraryHouseMetrics = {
  body: { x: number; y: number; w: number; h: number };
  /** Open cabinet. Shelf layout is in this space. Opaque so the old poster cannot show through. */
  interior: { x: number; y: number; w: number; h: number };
  post: { x: number; y: number; w: number; h: number };
  roof: { apexX: number; apexY: number; left: number; right: number; eaveY: number };
  star: { x: number; y: number; r: number };
};

/** House-on-a-post box. No door. Interior is the open shelf cavity. */
export function libraryHouseMetrics(box: { w: number; h: number }): LibraryHouseMetrics {
  const { w, h } = box;
  const bodyX = w * 0.02;
  const bodyW = w * 0.96;
  const bodyY = h * 0.145;
  const bodyH = h * 0.5;
  const wall = Math.max(8, bodyW * 0.07);
  const eaveY = h * 0.175;
  const postW = Math.max(18, w * 0.22);
  const postY = bodyY + bodyH - 2;
  return {
    body: { x: bodyX, y: bodyY, w: bodyW, h: bodyH },
    interior: {
      x: bodyX + wall,
      y: bodyY + bodyH * 0.07,
      w: bodyW - wall * 2,
      h: bodyH * 0.86,
    },
    post: { x: (w - postW) / 2, y: postY, w: postW, h: Math.max(8, h - postY) },
    roof: {
      apexX: w / 2,
      apexY: 0,
      left: bodyX - w * 0.03,
      right: bodyX + bodyW + w * 0.03,
      eaveY,
    },
    star: { x: w / 2, y: eaveY * 0.58, r: Math.max(6, w * 0.05) },
  };
}

/** OPEN and READY only. Kid surfaces never include waiting, happened, or cancelled jars. */
export function familyJarVisible(jar: PublicSharedGoal | null | undefined): jar is PublicSharedGoal {
  return !!jar && (jar.status === "OPEN" || jar.status === "READY");
}

export function libraryWindow(jars: readonly PublicSharedGoal[], capacity = LIBRARY_JAR_CAPACITY) {
  return trayWindow(jars.filter(familyJarVisible), capacity);
}

function shelfPair(cabinet: { w: number; h: number }): [LibraryShelf, LibraryShelf] {
  const padX = Math.max(4, cabinet.w * 0.05);
  const padY = Math.max(4, cabinet.h * 0.04);
  const gap = Math.max(6, cabinet.h * 0.05);
  const innerW = Math.max(1, cabinet.w - padX * 2);
  const cubbyH = Math.max(1, (cabinet.h - padY * 2 - gap) / LIBRARY_SHELF_COUNT);
  return [
    { x: padX, y: padY, w: innerW, h: cubbyH },
    { x: padX, y: padY + cubbyH + gap, w: innerW, h: cubbyH },
  ];
}

/** Mason-jar box for `count` jars sharing one shelf. More jars → smaller jars. */
function jarSize(shelf: LibraryShelf, count: number) {
  const gap = Math.max(3, shelf.w * 0.03);
  const rawW = (shelf.w - gap * Math.max(0, count - 1)) / Math.max(1, count);
  const h = Math.min(shelf.h * 0.94, rawW / 0.62);
  const w = Math.min(rawW, h * 0.78);
  return { w, h, gap };
}

function placeRow(shelf: LibraryShelf, count: number, shelfIndex: 0 | 1, kinds: LibrarySlotKind[]): LibrarySlot[] {
  if (count <= 0) return [];
  const { w, h, gap } = jarSize(shelf, count);
  const rowW = count * w + (count - 1) * gap;
  const x0 = shelf.x + (shelf.w - rowW) / 2;
  const y = shelf.y + shelf.h - h;
  return Array.from({ length: count }, (_, i) => ({
    x: x0 + i * (w + gap),
    y,
    w,
    h,
    kind: kinds[i] ?? "jar",
    shelf: shelfIndex,
  }));
}

/**
 * Shelf frames inside the open cabinet, in cabinet pixels.
 * One goal is a hero jar. More goals shrink so every shown jar still fits.
 * Zero goals return the shelves and no slots — the library stays visible.
 */
export function libraryShelfLayout(
  cabinet: { w: number; h: number },
  goalCount: number,
  overflow = 0,
): LibraryShelfLayout {
  const shelves = shelfPair(cabinet);
  const goals = Math.max(0, Math.trunc(goalCount));
  const extra = Math.max(0, Math.trunc(overflow));
  if (goals === 0 && extra === 0) {
    return { visible: true, hero: false, shelves, slots: [] };
  }
  if (goals === 1 && extra === 0) {
    const [top, bottom] = shelves;
    const spanH = bottom.y + bottom.h - top.y;
    const h = spanH * 0.78;
    const w = Math.min(top.w * 0.72, h * 0.7);
    return {
      visible: true,
      hero: true,
      shelves,
      slots: [
        {
          x: top.x + (top.w - w) / 2,
          y: top.y + (spanH - h) / 2,
          w,
          h,
          kind: "jar",
          shelf: 0,
        },
      ],
    };
  }

  const total = goals + (extra > 0 ? 1 : 0);
  const topCount = Math.ceil(total / LIBRARY_SHELF_COUNT);
  const bottomCount = total - topCount;
  const kinds: LibrarySlotKind[] = [
    ...Array.from({ length: goals }, () => "jar" as const),
    ...(extra > 0 ? (["overflow"] as const) : []),
  ];
  const topKinds = kinds.slice(0, topCount);
  const bottomKinds = kinds.slice(topCount);
  return {
    visible: true,
    hero: false,
    shelves,
    slots: [
      ...placeRow(shelves[0], topCount, 0, topKinds),
      ...placeRow(shelves[1], bottomCount, 1, bottomKinds),
    ],
  };
}
