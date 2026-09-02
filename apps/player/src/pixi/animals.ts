import { AnimatedSprite, Container } from "pixi.js";
import type { AnimalAction, AnimalKind, Atlas } from "./atlas";

export class AmbientAnimal {
  readonly root = new Container();
  private sprite: AnimatedSprite;
  private timer = 1;
  private vx = 0.6;
  private bounds = { x: 40, y: 0, w: 400, h: 80 };

  constructor(
    private atlas: Atlas,
    readonly kind: AnimalKind,
    x: number,
    y: number,
    bounds: { x: number; y: number; w: number; h: number },
  ) {
    this.bounds = bounds;
    const frames = atlas.animation(`animal_${kind}_walk`);
    this.sprite = new AnimatedSprite(frames);
    this.sprite.anchor.set(0.5, 0.9);
    this.sprite.animationSpeed = 0.14;
    this.sprite.play();
    this.root.addChild(this.sprite);
    this.root.position.set(x, y);
    this.pick();
  }

  private play(action: AnimalAction) {
    const frames = this.atlas.animation(`animal_${this.kind}_${action}`);
    if (frames.length) {
      this.sprite.textures = frames;
      this.sprite.animationSpeed = action === "run" ? 0.22 : action === "walk" ? 0.14 : 0.09;
      this.sprite.gotoAndPlay(0);
    }
    this.vx = action === "run" ? 1.6 : action === "walk" ? 0.7 : 0;
  }

  private pick() {
    const roll = Math.random();
    const next: AnimalAction = roll < 0.28 ? "walk" : roll < 0.4 ? "run" : roll < 0.58 ? "eat" : roll < 0.78 ? "sit" : "lay";
    this.play(next);
    this.timer = 2.2 + Math.random() * 3.4;
    if (Math.random() < 0.5) this.vx *= -1;
  }

  update(dt: number) {
    this.timer -= dt;
    if (this.timer <= 0) this.pick();
    if (this.vx !== 0) {
      this.root.x += this.vx * dt * 60;
      const min = this.bounds.x;
      const max = this.bounds.x + this.bounds.w;
      if (this.root.x < min) {
        this.root.x = min;
        this.vx = Math.abs(this.vx);
      } else if (this.root.x > max) {
        this.root.x = max;
        this.vx = -Math.abs(this.vx);
      }
      this.sprite.scale.x = Math.abs(this.sprite.scale.x) * (this.vx >= 0 ? 1 : -1);
    }
  }
}
