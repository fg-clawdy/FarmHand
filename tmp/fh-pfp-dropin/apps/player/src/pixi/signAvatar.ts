/**
 * Circular PFP badge for garden signs — overlays top-left of existing sign art.
 * Does NOT move plank text. Tap hit-target calls onTap.
 */
import { avatarPresetById, type FarmPlayerCard, type Mascot } from "@farmhand/shared";
import { Assets, Circle, Container, Graphics, Sprite, Text, Texture } from "pixi.js";

export type SignAvatarPlayer = Pick<
  FarmPlayerCard,
  "id" | "name" | "mascot"
> & {
  avatarKind?: string | null;
  avatarPreset?: string | null;
  avatarUrl?: string | null;
};

const MASCOT_GLYPH: Record<Mascot, string> = {
  cow: "🐮",
  chicken: "🐔",
  pig: "🐷",
  sheep: "🐑",
  horse: "🐴",
};

export class SignAvatarBadge {
  readonly root = new Container();
  private ring = new Graphics();
  private fill = new Graphics();
  private sprite = new Sprite();
  private emoji = new Text({
    text: "",
    style: {
      fontFamily: "Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, Fredoka, sans-serif",
      fontSize: 22,
      align: "center",
    },
  });
  private initials = new Text({
    text: "",
    style: {
      fontFamily: "Fredoka, sans-serif",
      fontSize: 16,
      fill: 0xfff6df,
      fontWeight: "700",
      align: "center",
    },
  });
  private radius = 20;
  private loadToken = 0;
  private lastUrl: string | null = null;

  constructor(onTap: () => void) {
    this.emoji.anchor.set(0.5);
    this.initials.anchor.set(0.5);
    this.sprite.anchor.set(0.5);
    this.sprite.visible = false;
    this.root.addChild(this.fill, this.sprite, this.emoji, this.initials, this.ring);
    this.root.eventMode = "static";
    this.root.cursor = "pointer";
    this.root.hitArea = new Circle(0, 0, this.radius + 8);
    this.root.on("pointerdown", (e) => {
      e.stopPropagation();
      this.root.scale.set(0.94);
    });
    this.root.on("pointerup", (e) => {
      e.stopPropagation();
      this.root.scale.set(1);
      onTap();
    });
    this.root.on("pointerupoutside", () => this.root.scale.set(1));
    this.drawChrome();
  }

  /** Place badge in texture-local pixels (playfield / garden zoom space). */
  place(x: number, y: number, radius: number) {
    this.radius = Math.max(14, radius);
    this.root.position.set(x, y);
    this.root.zIndex = 4200;
    this.drawChrome();
    this.root.hitArea = new Circle(0, 0, this.radius + 8);
    this.fitContents();
  }

  private drawChrome() {
    const r = this.radius;
    this.fill.clear();
    this.fill.circle(0, 0, r);
    this.fill.fill({ color: 0xf3d9a2 });
    this.ring.clear();
    this.ring.circle(0, 0, r);
    this.ring.stroke({ width: Math.max(2, r * 0.12), color: 0x2a1608 });
    this.ring.circle(0, 0, r + 1.5);
    this.ring.stroke({ width: Math.max(1.5, r * 0.08), color: 0xfff6df, alpha: 0.85 });
  }

  private fitContents() {
    const r = this.radius;
    this.emoji.style.fontSize = r * 1.15;
    this.initials.style.fontSize = r * 0.85;
    if (this.sprite.texture && this.sprite.texture !== Texture.EMPTY) {
      const tw = this.sprite.texture.width || 1;
      const th = this.sprite.texture.height || 1;
      const s = (r * 2) / Math.max(tw, th);
      this.sprite.scale.set(s);
    }
  }

  sync(player: SignAvatarPlayer) {
    const kind = player.avatarKind ?? "mascot";
    const url = player.avatarUrl ?? null;
    const initial = (player.name.trim()[0] || "?").toUpperCase();
    this.initials.text = initial;

    if (url && (kind === "preset" || kind === "selfie")) {
      this.showUrl(url, kind === "selfie" ? initial : null);
      return;
    }

    this.lastUrl = null;
    this.sprite.visible = false;
    this.initials.visible = false;
    if (kind === "preset" && player.avatarPreset) {
      const preset = avatarPresetById(player.avatarPreset);
      if (preset) {
        this.emoji.text = preset.emoji;
        this.emoji.visible = true;
        this.fitContents();
        return;
      }
    }
    this.emoji.text = MASCOT_GLYPH[player.mascot] ?? "🌱";
    this.emoji.visible = true;
    this.fitContents();
  }

  private async showUrl(url: string, fallbackInitial: string | null) {
    if (url === this.lastUrl && this.sprite.visible) return;
    const token = ++this.loadToken;
    this.lastUrl = url;
    this.emoji.visible = false;
    this.initials.visible = Boolean(fallbackInitial);
    this.sprite.visible = false;
    try {
      const tex = await Assets.load<Texture>(url);
      if (token !== this.loadToken) return;
      this.sprite.texture = tex;
      this.sprite.visible = true;
      this.initials.visible = false;
      this.fitContents();
    } catch {
      if (token !== this.loadToken) return;
      this.sprite.visible = false;
      if (fallbackInitial) {
        this.initials.visible = true;
        this.emoji.visible = false;
      } else {
        this.emoji.visible = true;
      }
    }
  }
}

/** Top-left badge anchor from name-plank center (farm three-plank signs). */
export function farmSignBadgeLocal(
  namePlank: { x: number; y: number },
  nameMaxW: number,
  radius: number,
) {
  return {
    x: namePlank.x - nameMaxW / 2 + radius * 0.15,
    y: namePlank.y - radius * 1.35,
    radius,
  };
}

/** Top-left badge on garden-zoom name sign. */
export function gardenZoomBadgeLocal(sign: { x: number; y: number }, radius: number) {
  return {
    x: sign.x - radius * 2.6,
    y: sign.y - radius * 1.4,
    radius,
  };
}
