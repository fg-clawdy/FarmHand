from pathlib import Path
p = Path(r'C:\Users\theha\Documents\GIT\FarmHand\apps\player\src\pixi\jobBoard.ts')
t = p.read_text(encoding='utf-8')

const_block = '''const FLYER_FACE_FIT = { w: 0.88, h: 0.86 } as const;
const SHEET_FACE_FIT = { w: 0.72, h: 0.78 } as const;

/**
 * Resting flyer on the cork face: left edge farther (board toed in ~52°).
 * Flat catalog PNGs need this; tear/pin sheet frames keep art-baked perspective.
 */
const CORK_FLYER_REST = {
  rotation: -0.09,
  skewY: -0.24,
  scaleXMul: 0.92,
} as const;
'''

if 'CORK_FLYER_REST' not in t:
    t = t.replace(
        'const FLYER_FACE_FIT = { w: 0.88, h: 0.86 } as const;\nconst SHEET_FACE_FIT = { w: 0.72, h: 0.78 } as const;\n',
        const_block,
        1,
    )

old_reset = '''  private resetPosterPose() {
    this.poster.rotation = 0;
    this.poster.alpha = 1;
    this.poster.scale.set(this.poseScale());
    this.poster.position.set(this.restX, this.restY);
    this.copy.visible = !this.activeFlyer;
  }'''

new_reset = '''  private applyRestFaceTransform() {
    const s = this.poseScale();
    // Flat chore flyers need cork yaw; sheet frames already carry painted perspective.
    if (this.activeFlyer && this.phase === "show") {
      this.poster.rotation = CORK_FLYER_REST.rotation;
      this.poster.skew.x = 0;
      this.poster.skew.y = CORK_FLYER_REST.skewY;
      this.poster.scale.set(s * CORK_FLYER_REST.scaleXMul, s);
    } else {
      this.poster.rotation = 0;
      this.poster.skew.set(0, 0);
      this.poster.scale.set(s);
    }
    this.poster.position.set(this.restX, this.restY);
    this.poster.alpha = 1;
  }

  private resetPosterPose() {
    this.applyRestFaceTransform();
    this.copy.visible = !this.activeFlyer;
  }'''

if old_reset not in t:
    raise SystemExit('resetPosterPose block not found')
t = t.replace(old_reset, new_reset, 1)

# When setting flyer scale in paintPoster show path, use applyRestFaceTransform
t = t.replace(
'''      if (this.phase === "show") {
        this.setFrame(WANTED_FRAME.pinned);
        this.poster.scale.set(this.flyerScale);
      }
      return;
    }

    this.copy.visible = this.phase === "show";''',
'''      if (this.phase === "show") {
        this.setFrame(WANTED_FRAME.pinned);
        this.applyRestFaceTransform();
      }
      return;
    }

    this.copy.visible = this.phase === "show";''',
)

t = t.replace(
'''    if (this.phase === "show") {
      this.setFrame(WANTED_FRAME.pinned);
      this.poster.scale.set(this.sheetScale);
    }
  }
}''',
'''    if (this.phase === "show") {
      this.setFrame(WANTED_FRAME.pinned);
      this.applyRestFaceTransform();
    }
  }
}''',
)

# Clear skew when tearing starts (sheet pose)
if 'this.poster.skew.set(0, 0);' not in t.split('phase === "tear"')[1][:400]:
    t = t.replace(
'''      // Sheet frames + sheetScale during tear (flyer scale only while phase === "show").
      this.setFrame(WANTED_FRAME.tearing);
      this.poster.scale.set(this.sheetScale);''',
'''      // Sheet frames + sheetScale during tear (flyer scale only while phase === "show").
      this.poster.skew.set(0, 0);
      this.setFrame(WANTED_FRAME.tearing);
      this.poster.scale.set(this.sheetScale);''',
        1,
    )

p.write_text(t, encoding='utf-8')
print('patched jobBoard flyer angle')
print('has CORK_FLYER_REST', 'CORK_FLYER_REST' in t)
print('has applyRestFaceTransform', 'applyRestFaceTransform' in t)
