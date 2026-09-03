import { AnimatedSprite, Container } from "pixi.js";
import type { AnimalAction, AnimalKind, Atlas } from "./atlas";
import { isoDepth, isoGround } from "./iso";

export class AmbientAnimal {
  readonly root = new Container();
  private sprite: AnimatedSprite;
  private timer = 1;
  private col: number;
  private row: number;
  private dCol = 0;
  private dRow = 0;
  private origin = { x: 0, y: 0 };

  constructor(
    private atlas: Atlas,
    readonly kind: AnimalKind,
    col: number,
    row: number,
    private bounds: { c0: number; r0: number; c1: number; r1: number },
  ) {
    this.col = col;
    this.row = row;
    const frames = atlas.animation(`animal_${kind}_walk`);
    this.sprite = new AnimatedSprite(frames);
    this.sprite.anchor.set(0.5, 0.86);
    this.sprite.scale.set(0.72);
    this.sprite.animationSpeed = 0.14;
    this.sprite.play();
    this.root.addChild(this.sprite);
    this.pick();
    this.syncPos();
  }

  setOrigin(x: number, y: number) {
    this.origin = { x, y };
    this.syncPos();
  }

  private play(action: AnimalAction) {
    const frames = this.atlas.animation(`animal_${this.kind}_${action}`);
    if (frames.length) {
      this.sprite.textures = frames;
      this.sprite.animationSpeed = action === "run" ? 0.22 : action === "walk" ? 0.14 : 0.08;
      this.sprite.gotoAndPlay(0);
    }
    const moving = action === "walk" || action === "run";
    const speed = action === "run" ? 0.9 : 0.45;
    if (moving) {
      if (Math.random() < 0.5) {
        this.dCol = Math.random() < 0.5 ? -speed : speed;
        this.dRow = 0;
      } else {
        this.dCol = 0;
        this.dRow = Math.random() < 0.5 ? -speed : speed;
      }
    } else {
      this.dCol = 0;
      this.dRow = 0;
    }
  }

  private pick() {
    const roll = Math.random();
    const next: AnimalAction =
      roll < 0.34 ? "walk" : roll < 0.46 ? "run" : roll < 0.66 ? "eat" : roll < 0.84 ? "sit" : "lay";
    this.play(next);
    this.timer = 2.2 + Math.random() * 3.4;
  }

  private syncPos() {
    const p = isoGround(this.col, this.row);
    this.root.position.set(this.origin.x + p.x, this.origin.y + p.y);
    this.root.zIndex = isoDepth(this.col, this.row);
    if (this.dCol !== 0 || this.dRow !== 0) {
      this.sprite.scale.x = Math.abs(this.sprite.scale.x) * (this.dCol + this.dRow >= 0 ? 1 : -1);
    }
  }

  update(dt: number) {
    this.timer -= dt;
    if (this.timer <= 0) this.pick();
    if (this.dCol !== 0 || this.dRow !== 0) {
      this.col += this.dCol * dt;
      this.row += this.dRow * dt;
      if (this.col < this.bounds.c0) {
        this.col = this.bounds.c0;
        this.dCol = Math.abs(this.dCol);
      } else if (this.col > this.bounds.c1) {
        this.col = this.bounds.c1;
        this.dCol = -Math.abs(this.dCol);
      }
      if (this.row < this.bounds.r0) {
        this.row = this.bounds.r0;
        this.dRow = Math.abs(this.dRow);
      } else if (this.row > this.bounds.r1) {
        this.row = this.bounds.r1;
        this.dRow = -Math.abs(this.dRow);
      }
    }
    this.syncPos();
  }
}
