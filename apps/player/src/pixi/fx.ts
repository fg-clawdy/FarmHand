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
    for (let i = 0; i < 48; i++) {
      const sprite = new Sprite(atlas.frame("fx_dot"));
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.root.addChild(sprite);
      this.pool.push({ sprite, vx: 0, vy: 0, life: 0, max: 1 });
    }
  }

  burst(x: number, y: number, kind: "water" | "fert" | "harvest") {
    const count = kind === "harvest" ? 18 : 14;
    let used = 0;
    for (const p of this.pool) {
      if (used >= count) break;
      if (p.life > 0) continue;
      const a = Math.random() * Math.PI * 2;
      const sp = kind === "water" ? 1.8 + Math.random() * 2.4 : 1.2 + Math.random() * 2.2;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp - (kind === "water" ? 2.2 : 1.4);
      p.life = p.max = 0.55 + Math.random() * 0.35;
      p.sprite.visible = true;
      p.sprite.position.set(x, y);
      p.sprite.scale.set(0.7 + Math.random() * 0.7);
      p.sprite.tint = kind === "water" ? 0x7ec8e3 : kind === "fert" ? 0x7ed957 : 0xffe56a;
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
