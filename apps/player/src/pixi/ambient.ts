import { AnimatedSprite, Container, type Texture } from "pixi.js";
import { facingFromDx, pickRoamTarget, pointInRect, type PixelRect } from "./playfieldLayout";

export class ExhaustPuff {
  readonly root = new Container();
  private sprite: AnimatedSprite;

  constructor(frames: Texture[]) {
    this.sprite = new AnimatedSprite(frames);
    this.sprite.anchor.set(0.5, 0.92);
    this.sprite.animationSpeed = 0.13;
    this.sprite.loop = true;
    this.sprite.scale.set(0.26);
    this.sprite.alpha = 0.9;
    this.sprite.play();
    this.root.addChild(this.sprite);
    this.root.eventMode = "none";
  }
}

export class PaintedCow {
  readonly root = new Container();
  private sprite: AnimatedSprite;
  private state: "idle" | "walk" | "eat" = "idle";
  private timer = 1;
  private x: number;
  private y: number;
  private tx: number;
  private ty: number;
  private readonly walk: Texture[];
  private readonly eat: Texture[];
  private readonly scale = 0.5;
  /** Sheet faces right. -1 flips horizontally for left roam. */
  private facing: 1 | -1 = 1;

  constructor(
    frames: { walk: Texture[]; eat: Texture[] },
    x: number,
    y: number,
    private roam: PixelRect,
    private forbidden: PixelRect[],
  ) {
    this.walk = frames.walk;
    this.eat = frames.eat;
    this.x = x;
    this.y = y;
    this.tx = x;
    this.ty = y;
    this.sprite = new AnimatedSprite(this.walk);
    this.sprite.anchor.set(0.5, 0.88);
    this.sprite.animationSpeed = 0.1;
    this.sprite.scale.set(this.scale);
    this.sprite.play();
    this.root.addChild(this.sprite);
    this.root.eventMode = "none";
    this.enterIdle();
    this.sync();
  }

  setSpace(roam: PixelRect, forbidden: PixelRect[]) {
    this.roam = roam;
    this.forbidden = forbidden;
    this.x = clamp(this.x, roam.x0, roam.x1);
    this.y = clamp(this.y, roam.y0, roam.y1);
    this.sync();
  }

  private play(textures: Texture[], speed: number) {
    if (!textures.length) return;
    this.sprite.textures = textures;
    this.sprite.animationSpeed = speed;
    this.sprite.gotoAndPlay(0);
    this.applyFacing();
  }

  private applyFacing() {
    this.sprite.scale.x = this.scale * this.facing;
    this.sprite.scale.y = this.scale;
  }

  private enterIdle() {
    this.state = "idle";
    this.play(this.walk, 0);
    this.sprite.gotoAndStop(0);
    this.applyFacing();
    this.timer = 1.1 + Math.random() * 1.4;
  }

  private enterWalk() {
    this.state = "walk";
    const target = pickRoamTarget(this.roam, this.forbidden);
    this.tx = target.x;
    this.ty = target.y;
    this.facing = facingFromDx(this.tx - this.x, this.facing);
    this.play(this.walk, 0.11);
    this.timer = 3.2 + Math.random() * 2.4;
  }

  private enterEat() {
    this.state = "eat";
    this.play(this.eat, 0.08);
    this.timer = 2 + Math.random() * 2;
  }

  private sync() {
    this.root.position.set(this.x, this.y);
    this.root.zIndex = Math.round(this.y);
  }

  update(dt: number) {
    this.timer -= dt;
    if (this.state === "walk") {
      const dx = this.tx - this.x;
      const dy = this.ty - this.y;
      const dist = Math.hypot(dx, dy);
      const speed = 28;
      if (dist < 4 || this.timer <= 0) {
        this.enterEat();
      } else {
        const nx = this.x + (dx / dist) * speed * dt;
        const ny = this.y + (dy / dist) * speed * dt;
        if (this.forbidden.some((rect) => pointInRect(nx, ny, rect))) {
          this.enterIdle();
        } else {
          this.x = clamp(nx, this.roam.x0, this.roam.x1);
          this.y = clamp(ny, this.roam.y0, this.roam.y1);
          this.facing = facingFromDx(dx, this.facing);
          this.applyFacing();
        }
      }
    } else if (this.timer <= 0) {
      if (this.state === "idle") this.enterWalk();
      else this.enterIdle();
    }
    this.sync();
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}
