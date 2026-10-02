export type JarSlotKind = "jar" | "overflow" | "ghost";

export type JarSlotFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: JarSlotKind;
};

/** Slot frames inside the wood tray, in board pixels. Pure so the farm layout can be tested without Pixi. */
export function jarTraySlots(
  board: { w: number; h: number },
  visibleJars: number,
  overflow: number,
): { header: number; slots: JarSlotFrame[] } {
  const header = Math.max(22, Math.round(board.h * 0.14));
  const pad = Math.max(8, Math.round(board.w * 0.045));
  const bottom = Math.max(18, Math.round(board.h * 0.07));
  const innerW = Math.max(1, board.w - pad * 2);
  const innerH = Math.max(1, board.h - header - bottom);
  if (visibleJars <= 0) {
    const ghostW = Math.min(innerW * 0.46, 96);
    const ghostH = Math.min(innerH * 0.78, 128);
    return {
      header,
      slots: [
        {
          x: (board.w - ghostW) / 2,
          y: header + (innerH - ghostH) / 2,
          w: ghostW,
          h: ghostH,
          kind: "ghost",
        },
      ],
    };
  }
  const n = visibleJars + (overflow > 0 ? 1 : 0);
  const gap = Math.max(4, Math.round(innerW * 0.03));
  const slotW = (innerW - gap * (n - 1)) / n;
  const slots: JarSlotFrame[] = [];
  for (let i = 0; i < n; i++) {
    const overflowSlot = overflow > 0 && i === n - 1;
    slots.push({
      x: pad + i * (slotW + gap),
      y: header,
      w: slotW,
      h: innerH,
      kind: overflowSlot ? "overflow" : "jar",
    });
  }
  return { header, slots };
}
