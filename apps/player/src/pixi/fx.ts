import { Container, Sprite } from "pixi.js";
import type { Atlas } from "./atlas";

type Burst = {
  sprite: Sprite;
  vx: number;
  vy: number;
  life: number;
  max: number;
};

export class FxLayer {
  readonly root = new Container();
  private readonly pool: Burst[] = [];

  constructor(atlas: Atlas) {
    for (let i = 0; i < 56; i++) {
      const sprite = new Sprite(atlas.frame(i % 3 === 0 ? "fx_sparkle" : "fx_dot"));
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.root.addChild(sprite);
      this.pool.push({ sprite, vx: 0, vy: 0, life: 0, max: 1 });
    }
  }

  burst(x: number, y: number, kind: "water" | "fert" | "harvest") {
    const count = kind === "harvest" ? 22 : 14;
    let used = 0;
    for (const p of this.pool) {
      if (used >= count) break;
      if (p.life > 0) continue;
      const a = Math.random() * Math.PI * 2;
      const sp = kind === "water" ? 1.8 + Math.random() * 2.4 : 1.2 + Math.random() * 2.2;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp - (kind === "water" ? 2.2 : 1.4);
      p.life = p.max = 0.55 + Math.random() * 0.4;
      p.sprite.visible = true;
      p.sprite.position.set(x, y);
      p.sprite.scale.set(0.55 + Math.random() * 0.85);
      p.sprite.tint = kind === "water" ? 0x7ec8e3 : kind === "fert" ? 0x7ed957 : 0xffe56a;
      p.sprite.blendMode = kind === "harvest" ? "add" : "normal";
      used += 1;
    }
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.sprite.x += p.vx * dt * 60;
      p.sprite.y += p.vy * dt * 60;
      p.vy += 6 * dt;
      p.sprite.alpha = Math.max(0, p.life / p.max);
      if (p.life <= 0) p.sprite.visible = false;
    }
  }
}

/** Continuous harvest sparkles that sit on ready crop rows. */
export class SparkleField {
  readonly root = new Container();
  private readonly sprites: Sprite[] = [];
  private readonly phase: number[] = [];
  private active = false;
  private radiusX = 36;
  private radiusY = 28;

  constructor(atlas: Atlas, count = 8) {
    for (let i = 0; i < count; i++) {
      const spr = new Sprite(atlas.frame("fx_sparkle"));
      spr.anchor.set(0.5);
      spr.blendMode = "add";
      spr.visible = false;
      this.root.addChild(spr);
      this.sprites.push(spr);
      this.phase.push(Math.random() * Math.PI * 2);
    }
  }

  setArea(rx: number, ry: number) {
    this.radiusX = rx;
    this.radiusY = ry;
  }

  setActive(on: boolean) {
    this.active = on;
    for (const spr of this.sprites) spr.visible = on;
  }

  update(t: number) {
    if (!this.active) return;
    this.sprites.forEach((spr, i) => {
      const p = this.phase[i] + t * (1.4 + (i % 3) * 0.35);
      spr.x = Math.cos(p) * this.radiusX * (0.35 + (i % 5) * 0.13);
      spr.y = Math.sin(p * 1.3) * this.radiusY * (0.3 + (i % 4) * 0.14) - 10;
      const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 5 + i));
      spr.alpha = 0.35 + pulse * 0.65;
      spr.scale.set(0.28 + pulse * 0.42);
    });
  }
}
