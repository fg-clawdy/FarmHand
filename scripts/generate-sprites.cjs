/**
 * Phase 4+5 — Isometric SVG Sprite Generator
 *
 * Generates detailed animal sprite-sheets (6 frames × 96×96),
 * progressive crop stage sprites (4 stages × 128×256),
 * terrain tiles, building props, and themed FX particles
 * in Kenney isometric miniature farm style.
 *
 * Usage:   node scripts/generate-sprites.cjs
 * Output:  apps/player/public/art/generated/
 */

const sharp = require("sharp");
const { mkdirSync, writeFileSync } = require("fs");
const { join } = require("path");

const OUT = join(__dirname, "..", "apps", "player", "public", "art", "generated");
const ANIMALS = ["sheep", "duck", "cow", "chicken", "pig"];
const ACTIONS = ["walk", "run", "eat", "sit", "lay"];
const CROPS = ["daisy", "herbs", "sunflower", "oak"];

const OUTLINE = "#3d2a16";
const SHADOW_COLOR = "rgba(26,36,16,0.18)";

const PAL = {
  sheep:  { body: "#f4f0e4", shade: "#d4cbb8", accent: "#2a1a0d", hl: "#ffffff" },
  duck:   { body: "#f0c84a", shade: "#d4a22a", accent: "#e23a2a", hl: "#fce888" },
  cow:    { body: "#f7f4ea", shade: "#d8d0c0", accent: "#2a1a0d", hl: "#ffffff" },
  chicken:{ body: "#fff1c4", shade: "#e8d08a", accent: "#e23a2a", hl: "#fff8e0" },
  pig:    { body: "#f7b4c4", shade: "#e87898", accent: "#c45a78", hl: "#fdd4de" },
};

const CROP_COLORS = {
  daisy:     { petal: "#ffffff", center: "#ffc84a", stem: "#3f8a32", leaf: "#4ea83a" },
  herbs:     { petal: "#7cb868", center: "#d4c878", stem: "#3a7030", leaf: "#5a9848" },
  sunflower: { petal: "#ffe86a", center: "#4a2a16", stem: "#4a8030", leaf: "#5a9040" },
  oak:       { petal: "#3f8a32", center: "#6b3f12", stem: "#5a3a1a", leaf: "#4ea83a" },
};

// ── SVG Helpers ────────────────────────────────────────────────────
function svg(w, h, ...parts) {
  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">\n${parts.join("\n")}\n</svg>`;
}
function shadow(cx, cy, rx, ry) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${SHADOW_COLOR}"/>`;
}
function ellipse(cx, cy, rx, ry, fill, rot, extra) {
  rot = rot || 0;
  extra = extra || "";
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${OUTLINE}" stroke-width="1.8" transform="rotate(${rot},${cx},${cy})" ${extra}/>`;
}
function circle(cx, cy, r, fill) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${OUTLINE}" stroke-width="1.5"/>`;
}
function path(d, fill, sw) {
  sw = sw || 1.8;
  return `<path d="${d}" fill="${fill}" stroke="${OUTLINE}" stroke-width="${sw}" stroke-linejoin="round"/>`;
}
function isoBody(cx, cy, rx, ry, p, rot) {
  rot = rot === undefined ? -0.35 : rot;
  var clip = '\n    <defs>\n      <clipPath id="sh"><rect x="' + cx + '" y="' + (cy - ry - 4) + '" width="' + (rx + 4) + '" height="' + (ry * 2 + 8) + '"/></clipPath>\n      <clipPath id="hl"><rect x="' + (cx - rx - 4) + '" y="' + (cy - ry - 4) + '" width="' + (rx + 4) + '" height="' + (ry * 2 + 8) + '"/></clipPath>\n    </defs>';
  var shadeEl = '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + p.shade + '" transform="rotate(' + rot + ',' + cx + ',' + cy + ')" clip-path="url(#sh)"/>';
  var hlEl = '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + p.hl + '" transform="rotate(' + rot + ',' + cx + ',' + cy + ')" clip-path="url(#hl)"/>';
  var bodyEl = '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + p.body + '" transform="rotate(' + rot + ',' + cx + ',' + cy + ')"/>';
  var olEl = '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="none" stroke="' + OUTLINE + '" stroke-width="1.8" transform="rotate(' + rot + ',' + cx + ',' + cy + ')"/>';
  return clip + "\n" + shadeEl + "\n" + hlEl + "\n" + bodyEl + "\n" + olEl;
}
function simpleE(cx, cy, rx, ry, fill, rot) {
  rot = rot || 0;
  return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + fill + '" stroke="' + OUTLINE + '" stroke-width="1.5" transform="rotate(' + rot + ',' + cx + ',' + cy + ')"/>';
}
function svgToPng(svgStr, w, h) {
  return sharp(Buffer.from(svgStr)).resize(w, h).png().toBuffer();
}
function rect(x, y, w, h, fill) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${OUTLINE}" stroke-width="1.8" rx="2"/>`;
}
function grassBlade(gx, gy, ang, len, fill) {
  var rad = ang * Math.PI / 180;
  var x2 = gx + Math.cos(rad) * len;
  var y2 = gy - Math.sin(rad) * len;
  return '<line x1="' + gx + '" y1="' + gy + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="' + fill + '" stroke-width="2.5" stroke-linecap="round"/>';
}
// END PART 1

// ── Species Feature Builders ───────────────────────────────────────

function sheepFeatures(cx, cy, p, action, t, headCx, headCy) {
  var parts = [];
  var tufts = [[cx-12,cy-8],[cx+10,cy-6],[cx-6,cy+8],[cx+8,cy+6],[cx,cy-10],[cx-10,cy+2]];
  for (var i = 0; i < tufts.length; i++) {
    var tx = tufts[i][0], ty = tufts[i][1];
    var bob = action === "walk" ? Math.sin(t + tx * 0.3) * 1 : 0;
    parts.push(circle(tx, ty + bob, 4, p.body));
  }
  parts.push(simpleE(headCx + 4, headCy - 4, 3.5, 2, p.shade, 0.3));
  parts.push(simpleE(headCx - 4, headCy - 4, 3.5, 2, p.shade, -0.3));
  parts.push(circle(headCx + 2, headCy - 2, 1.6, p.accent));
  return parts.join("\n");
}

function duckFeatures(cx, cy, p, action, t, headCx, headCy) {
  var parts = [];
  parts.push(path("M " + (headCx+10) + " " + headCy + " L " + (headCx+17) + " " + (headCy+1) + " L " + (headCx+10) + " " + (headCy+3) + " Z", "#e87820"));
  var wingBob = action === "walk" ? Math.sin(t + 1) * 1.5 : 0;
  parts.push(simpleE(cx - 2, cy + 2 + wingBob, 8, 4, p.shade, 0.2));
  parts.push(circle(headCx + 3, headCy - 2, 1.5, "#1a1a1a"));
  return parts.join("\n");
}

function cowFeatures(cx, cy, p, action, t, headCx, headCy) {
  var parts = [];
  parts.push(simpleE(cx - 6, cy - 2, 5, 3.5, p.accent, 0));
  parts.push(simpleE(cx + 8, cy + 5, 4, 3, p.accent, 0));
  parts.push(simpleE(cx - 2, cy + 6, 3, 2.5, p.accent, 0));
  parts.push(path("M " + (headCx+4) + " " + (headCy-4) + " Q " + (headCx+10) + " " + (headCy-10) + " " + (headCx+8) + " " + (headCy-14), "none", 1.8));
  parts.push(path("M " + (headCx-4) + " " + (headCy-4) + " Q " + (headCx-10) + " " + (headCy-10) + " " + (headCx-8) + " " + (headCy-14), "none", 1.8));
  if (action !== "lay") {
    parts.push('<ellipse cx="' + cx + '" cy="' + (cy+10) + '" rx="5" ry="3" fill="' + p.accent + '" opacity="0.5"/>');
  }
  parts.push(circle(headCx + 2, headCy - 2, 1.6, p.accent));
  return parts.join("\n");
}

function chickenFeatures(cx, cy, p, action, t, headCx, headCy) {
  var parts = [];
  parts.push(path("M " + (headCx-3) + " " + (headCy-8) + " Q " + (headCx+1) + " " + (headCy-16) + " " + (headCx+5) + " " + (headCy-12) + " Q " + (headCx+6) + " " + (headCy-18) + " " + (headCx+8) + " " + (headCy-10) + " Z", "#e23a2a"));
  parts.push('<ellipse cx="' + (headCx+5) + '" cy="' + headCy + '" rx="2" ry="2.5" fill="#e23a2a"/>');
  var tailBob = action === "walk" ? Math.sin(t) * 2 : 0;
  parts.push(path("M " + (cx-14) + " " + (cy-2) + " Q " + (cx-22) + " " + (cy-10+tailBob) + " " + (cx-18) + " " + (cy-6) + " Q " + (cx-24) + " " + (cy-4+tailBob) + " " + (cx-16) + " " + cy + " Z", p.shade));
  parts.push(path("M " + (headCx+9) + " " + (headCy-1) + " L " + (headCx+14) + " " + headCy + " L " + (headCx+9) + " " + (headCy+2) + " Z", "#e87820"));
  parts.push(circle(headCx + 2, headCy - 3, 1.3, "#1a1a1a"));
  return parts.join("\n");
}

function pigFeatures(cx, cy, p, action, t, headCx, headCy) {
  var parts = [];
  parts.push(simpleE(headCx + 8, headCy, 5, 4, "#f08ca0", 0));
  parts.push('<circle cx="' + (headCx+7) + '" cy="' + (headCy-1) + '" r="0.8" fill="' + p.accent + '"/>');
  parts.push('<circle cx="' + (headCx+10) + '" cy="' + (headCy-1) + '" r="0.8" fill="' + p.accent + '"/>');
  parts.push(simpleE(headCx - 3, headCy - 8, 5, 3.5, p.shade, -0.6));
  var tx = cx - 12, ty = cy + 2;
  parts.push(path("M " + tx + " " + ty + " Q " + (tx-6) + " " + (ty-6) + " " + (tx-3) + " " + (ty-3) + " Q " + (tx-5) + " " + (ty-8) + " " + (tx-2) + " " + (ty-4), "none", 1.8));
  parts.push(circle(headCx + 3, headCy - 4, 1.3, "#1a1a1a"));
  return parts.join("\n");
}
// END PART 2

// ── Action Pose Builders ───────────────────────────────────────────

// ── Terrain Tile Generator ────────────────────────────────────────────

function renderGrassTile(w, h) {
  var cx = w / 2, cy = h / 2, rx = w * 0.44, ry = h * 0.42, uid = "g";
  var parts = [];
  parts.push(shadow(cx, cy + ry * 0.85, rx * 0.7, ry * 0.15));
  parts.push('<defs>');
  parts.push('  <clipPath id="' + uid + 's"><polygon points="' + cx + ',' + (cy - ry) + ' ' + (cx + rx) + ',' + cy + ' ' + cx + ',' + (cy + ry) + '"/></clipPath>');
  parts.push('  <clipPath id="' + uid + 'h"><polygon points="' + cx + ',' + (cy - ry) + ' ' + (cx - rx) + ',' + cy + ' ' + cx + ',' + (cy + ry) + '"/></clipPath>');
  parts.push('</defs>');
  parts.push(path('M ' + cx + ' ' + (cy - ry * 0.6) + ' L ' + (cx + rx) + ' ' + (cy + ry * 0.15) + ' L ' + cx + ' ' + (cy + ry * 0.9) + ' L ' + (cx - rx) + ' ' + (cy + ry * 0.15) + ' Z', '#6dcc52'));
  parts.push('<polygon points="' + cx + ',' + (cy - ry * 0.55) + ' ' + (cx - rx) + ',' + (cy + ry * 0.2) + ' ' + cx + ',' + (cy + ry * 0.85) + '" fill="#8ce868" clip-path="url(#' + uid + 'h)" opacity="0.55"/>');
  parts.push('<polygon points="' + cx + ',' + (cy - ry * 0.55) + ' ' + (cx + rx) + ',' + (cy + ry * 0.2) + ' ' + cx + ',' + (cy + ry * 0.85) + '" fill="#3f8a32" clip-path="url(#' + uid + 's)" opacity="0.45"/>');
  // Blade tufts
  var tufts = [[cx-10,cy-ry*0.5,-4,-10],[cx+14,cy-ry*0.4,5,-9],[cx-20,cy-ry*0.3,-3,-8],[cx+22,cy-ry*0.2,4,-8],[cx-8,cy-ry*0.15,-2,-7],[cx+8,cy-ry*0.05,3,-7],[cx-16,cy+ry*0.1,-4,-6],[cx+18,cy+ry*0.2,2,-6]];
  var gs = ['#7adc52','#5ca83a','#4ea832'];
  for (var i = 0; i < tufts.length; i++) {
    var t = tufts[i];
    parts.push('<line x1="' + t[0] + '" y1="' + t[1] + '" x2="' + (t[0]+t[2]) + '" y2="' + (t[1]+t[3]) + '" stroke="' + gs[i%3] + '" stroke-width="2.5" stroke-linecap="round"/>');
  }
  parts.push(grassBlade(cx-26,cy+ry*0.3,75,11,'#6dcc52'));
  parts.push(grassBlade(cx+28,cy+ry*0.35,55,9,'#5ca83a'));
  return svg(w, h, parts.join('\n'));
}


var FEATURES = { sheep: sheepFeatures, duck: duckFeatures, cow: cowFeatures, chicken: chickenFeatures, pig: pigFeatures };

// ── Building Prop Generators ──────────────────────────────────────────

function renderStoreProp(w, h) {
  var parts = [], cx = w / 2, base = h * 0.82, bw = 80, bh = 52;
  parts.push(shadow(cx, base + 8, 46, 10));
  // Front wall
  parts.push(path('M ' + (cx-10) + ' ' + (base-bh) + ' L ' + (cx+bw*0.5) + ' ' + (base-bh*0.6) + ' L ' + (cx+bw*0.5) + ' ' + (base+2-bh*0.6) + ' L ' + (cx-10) + ' ' + (base+2) + ' Z','#e8d4a0'));
  // Side wall (shaded)
  parts.push(path('M ' + (cx+bw*0.5) + ' ' + (base-bh*0.6) + ' L ' + (cx+bw) + ' ' + (base-bh*0.2) + ' L ' + (cx+bw) + ' ' + (base+2-bh*0.2) + ' L ' + (cx+bw*0.5) + ' ' + (base+2-bh*0.6) + ' Z','#c4b078'));
  // Plank seams
  for (var i = 0; i < 3; i++) {
    var yp = base - bh + bh * 0.3 + i * bh * 0.22;
    parts.push('<line x1="' + (cx-8) + '" y1="' + yp + '" x2="' + (cx+bw*0.48) + '" y2="' + (yp-bh*0.08) + '" stroke="' + OUTLINE + '" stroke-width="1" opacity="0.3"/>');
  }
  // Door
  parts.push(path('M ' + (cx+14) + ' ' + (base-bh*0.35) + ' L ' + (cx+bw*0.5-2) + ' ' + (base-bh*0.75) + ' L ' + (cx+bw*0.5-2) + ' ' + (base+2-bh*0.75) + ' L ' + (cx+14) + ' ' + (base+2-bh*0.35) + ' Z','#6b3f12'));
  parts.push(circle(cx+bw*0.28, base-bh*0.38, 3, '#c9892a'));
  // Window
  parts.push(path('M ' + (cx+bw*0.62) + ' ' + (base-bh*0.58) + ' L ' + (cx+bw*0.88) + ' ' + (base-bh*0.32) + ' L ' + (cx+bw*0.88) + ' ' + (base-bh*0.02) + ' L ' + (cx+bw*0.62) + ' ' + (base-bh*0.28) + ' Z','#ffe88a'));
  parts.push('<line x1="' + (cx+bw*0.75) + '" y1="' + (base-bh*0.52) + '" x2="' + (cx+bw*0.75) + '" y2="' + (base-bh*0.22) + '" stroke="' + OUTLINE + '" stroke-width="1"/>');
  // Roof
  var rr = 52;
  parts.push(path('M ' + (cx-18) + ' ' + (base-bh*1.02) + ' L ' + (cx+bw*0.5) + ' ' + (base-bh*1.0-rr*0.35) + ' L ' + (cx+bw+14) + ' ' + (base-bh*0.22) + ' L ' + (cx+bw*0.5+4) + ' ' + (base-bh*0.62) + ' Z','#d43a2a'));
  parts.push('<polygon points="' + (cx-18) + ',' + (base-bh*1.02) + ' ' + (cx+bw*0.5) + ',' + (base-bh*1.0-rr*0.35) + ' ' + (cx+bw+14) + ',' + (base-bh*0.22) + ' ' + (cx+bw*0.5+4) + ',' + (base-bh*0.62) + '" fill="none" stroke="' + OUTLINE + '" stroke-width="1.8" stroke-linejoin="round"/>');
  // Chimney
  var chX = cx + bw * 0.72, chTop = base - bh * 0.95;
  parts.push(path('M ' + (chX-6) + ' ' + (chTop+18) + ' L ' + (chX+6) + ' ' + (chTop+10) + ' L ' + (chX+6) + ' ' + (chTop-12) + ' L ' + (chX-6) + ' ' + (chTop-4) + ' Z','#8a5640'));
  // Awning sign
  var sX = cx + bw * 0.5, sY = base - bh * 0.88;
  parts.push(path('M ' + (sX-32) + ' ' + sY + ' L ' + (sX+32) + ' ' + (sY-16) + ' L ' + (sX+34) + ' ' + (sY-2) + ' L ' + (sX-30) + ' ' + (sY+14) + ' Z','#ffe56a'));
  parts.push('<text x="' + sX + '" y="' + (sY+2) + '" text-anchor="middle" font-size="10" font-family="sans-serif" font-weight="bold" fill="' + OUTLINE + '" transform="skewX(-26.6)">STORE</text>');
  parts.push(grassBlade(cx-24,base+6,70,10,'#6dcc52'));
  parts.push(grassBlade(cx+bw+6,base-bh*0.05,50,9,'#5ca83a'));
  return svg(w, h, parts.join('\n'));
}

function renderBarnProp(w, h) {
  var parts = [], cx = w / 2, base = h * 0.84, bw = 88, bh = 64;
  parts.push(shadow(cx, base + 10, 52, 12));
  // Front face
  parts.push(path('M ' + (cx-14) + ' ' + (base-bh) + ' L ' + (cx+bw*0.5) + ' ' + (base-bh*0.55) + ' L ' + (cx+bw*0.5) + ' ' + (base+2-bh*0.55) + ' L ' + (cx-14) + ' ' + (base+2) + ' Z','#d4402a'));
  // Side face (shaded)
  parts.push(path('M ' + (cx+bw*0.5) + ' ' + (base-bh*0.55) + ' L ' + (cx+bw) + ' ' + (base-bh*0.15) + ' L ' + (cx+bw) + ' ' + (base+2-bh*0.15) + ' L ' + (cx+bw*0.5) + ' ' + (base+2-bh*0.55) + ' Z','#a83022'));
  // White trim
  parts.push('<line x1="' + (cx-12) + '" y1="' + (base-bh+6) + '" x2="' + (cx+bw*0.48) + '" y2="' + (base-bh*0.55+6) + '" stroke="#f4f0e4" stroke-width="3"/>');
  // Big door
  parts.push(path('M ' + (cx+10) + ' ' + (base-bh*0.65) + ' L ' + (cx+bw*0.5-4) + ' ' + (base-bh*1.0) + ' L ' + (cx+bw*0.5-4) + ' ' + (base-bh*0.55) + ' L ' + (cx+10) + ' ' + (base-bh*0.2) + ' Z','#f4f0e4'));
  parts.push('<line x1="' + (cx+12) + '" y1="' + (base-bh*0.62) + '" x2="' + (cx+bw*0.46) + '" y2="' + (base-bh*0.58) + '" stroke="' + OUTLINE + '" stroke-width="1.5"/>');
  parts.push('<line x1="' + (cx+12) + '" y1="' + (base-bh*0.58) + '" x2="' + (cx+bw*0.46) + '" y2="' + (base-bh*0.62) + '" stroke="' + OUTLINE + '" stroke-width="1.5"/>');
  // Window
  parts.push(path('M ' + (cx+bw*0.6) + ' ' + (base-bh*0.52) + ' L ' + (cx+bw*0.88) + ' ' + (base-bh*0.28) + ' L ' + (cx+bw*0.88) + ' ' + (base-bh*0.05) + ' L ' + (cx+bw*0.6) + ' ' + (base-bh*0.29) + ' Z','#ffe88a'));
  // Roof
  var rr = 58;
  parts.push(path('M ' + (cx-22) + ' ' + (base-bh*1.02) + ' L ' + (cx+bw*0.5) + ' ' + (base-bh*0.95-rr*0.35) + ' L ' + (cx+bw+18) + ' ' + (base-bh*0.18) + ' L ' + (cx+bw*0.5+4) + ' ' + (base-bh*0.58) + ' Z','#5c3818'));
  parts.push('<polygon points="' + (cx-22) + ',' + (base-bh*1.02) + ' ' + (cx+bw*0.5) + ',' + (base-bh*0.95-rr*0.35) + ' ' + (cx+bw+18) + ',' + (base-bh*0.18) + ' ' + (cx+bw*0.5+4) + ',' + (base-bh*0.58) + '" fill="none" stroke="' + OUTLINE + '" stroke-width="1.8" stroke-linejoin="round"/>');
  // Cupola
  var cupX = cx + bw * 0.5, cupTop = base - bh * 0.95 - rr * 0.35;
  parts.push(rect(cupX-8, cupTop-22, 16, 22, '#f4f0e4'));
  parts.push(path('M ' + (cupX-10) + ' ' + (cupTop-22) + ' L ' + cupX + ' ' + (cupTop-36) + ' L ' + (cupX+10) + ' ' + (cupTop-22) + ' Z','#5c3818'));
  parts.push('<line x1="' + cupX + '" y1="' + (cupTop-36) + '" x2="' + cupX + '" y2="' + (cupTop-46) + '" stroke="' + OUTLINE + '" stroke-width="1.5"/>');
  parts.push(grassBlade(cx-28, base+8, 70, 11, '#6dcc52'));
  parts.push(grassBlade(cx+bw+10, base-bh*0.08, 55, 10, '#5ca83a'));
  return svg(w, h, parts.join('\n'));
}

function renderSiloProp(w, h) {
  var parts = [], cx = w / 2, base = h * 0.86, sw = 38, sh = 90;
  parts.push(shadow(cx, base + 6, 22, 8));
  // Side (shaded)
  parts.push(path('M ' + cx + ' ' + (base-sh) + ' L ' + (cx+sw) + ' ' + (base-sh*0.7) + ' L ' + (cx+sw) + ' ' + (base+2-sh*0.7) + ' L ' + cx + ' ' + (base+2) + ' Z','#c0c0c0'));
  // Front face
  parts.push(path('M ' + cx + ' ' + (base-sh) + ' L ' + (cx-sw*0.35) + ' ' + (base-sh*0.82) + ' L ' + (cx-sw*0.35) + ' ' + (base+2-sh*0.82) + ' L ' + cx + ' ' + (base+2) + ' Z','#e8e8e8'));
  // Bands
  for (var ib = 0; ib < 4; ib++) {
    var by = base - sh + sh * 0.25 + ib * sh * 0.18;
    parts.push('<ellipse cx="' + cx + '" cy="' + by + '" rx="' + sw * 0.58 + '" ry="' + sh * 0.06 + '" fill="none" stroke="' + OUTLINE + '" stroke-width="1.2" opacity="0.4"/>');
  }
  // Dome roof
  parts.push('<ellipse cx="' + cx + '" cy="' + (base-sh*0.78) + '" rx="' + sw*0.6 + '" ry="' + sh*0.12 + '" fill="#9a9a9a" stroke="' + OUTLINE + '" stroke-width="1.8"/>');
  parts.push('<path d="M ' + (cx-sw*0.48) + ' ' + (base-sh*0.78) + ' C ' + (cx-sw*0.4) + ' ' + (base-sh*1.05) + ' ' + (cx+sw*0.4) + ' ' + (base-sh*1.05) + ' ' + (cx+sw*0.55) + ' ' + (base-sh*0.75) + '" fill="#b8b8b8" stroke="' + OUTLINE + '" stroke-width="1.8"/>');
  parts.push(circle(cx, base - sh * 0.98, 4, '#c9892a'));
  parts.push(grassBlade(cx-18, base+8, 60, 8, '#6dcc52'));
  return svg(w, h, parts.join('\n'));
}

// ── Themed FX Particles ──────────────────────────────────────────────

function renderFxWaterDrop() {
  var s = 32, cx = s / 2, cy = s / 2;
  return svg(s, s,
    '<path d="M ' + cx + ' ' + (cy-10) + ' C ' + (cx-7) + ' ' + (cy+4) + ' ' + (cx-7) + ' ' + (cy+10) + ' ' + cx + ' ' + (cy+12) + ' C ' + (cx+7) + ' ' + (cy+10) + ' ' + (cx+7) + ' ' + (cy+4) + ' ' + cx + ' ' + (cy-10) + ' Z" fill="#7ec8e3" stroke="' + OUTLINE + '" stroke-width="1.2"/>',
    '<ellipse cx="' + (cx-2) + '" cy="' + (cy-2) + '" rx="2" ry="3" fill="#b0e8f8" opacity="0.7"/>'
  );
}

function renderFxLeaf() {
  var s = 32, cx = s / 2, cy = s / 2;
  return svg(s, s,
    '<path d="M ' + cx + ' ' + (cy-10) + ' C ' + (cx+8) + ' ' + (cy-4) + ' ' + (cx+8) + ' ' + (cy+8) + ' ' + cx + ' ' + (cy+12) + ' C ' + (cx-6) + ' ' + (cy+4) + ' ' + (cx-6) + ' ' + (cy-4) + ' ' + cx + ' ' + (cy-10) + ' Z" fill="#7ed957" stroke="' + OUTLINE + '" stroke-width="1.2"/>',
    '<line x1="' + cx + '" y1="' + (cy-10) + '" x2="' + cx + '" y2="' + (cy+12) + '" stroke="#4ea83a" stroke-width="1" opacity="0.6"/>'
  );
}

function renderFxStar() {
  var s = 32, cx = s / 2, cy = s / 2, rOuter = 12, rInner = 5, pts = [];
  for (var ia = 0; ia < 5; ia++) {
    var oa = (ia * 72 - 90) * Math.PI / 180, inn = (ia * 72 + 36 - 90) * Math.PI / 180;
    pts.push((cx + Math.cos(oa) * rOuter).toFixed(1) + ',' + (cy + Math.sin(oa) * rOuter).toFixed(1));
    pts.push((cx + Math.cos(inn) * rInner).toFixed(1) + ',' + (cy + Math.sin(inn) * rInner).toFixed(1));
  }
  return svg(s, s,
    '<polygon points="' + pts.join(' ') + '" fill="#ffe56a" stroke="' + OUTLINE + '" stroke-width="1.2" stroke-linejoin="round"/>'
  );
}

function renderFxGlow() {
  var s = 64;
  return svg(s, s,
    '<defs><radialGradient id="glow"><stop offset="0%" stop-color="#ffe56a" stop-opacity="0.9"/><stop offset="100%" stop-color="#ffe56a" stop-opacity="0"/></radialGradient></defs>',
    '<circle cx="' + (s/2) + '" cy="' + (s/2) + '" r="' + (s/2-2) + '" fill="url(#glow)"/>'
  );
}


function buildStanding(kind, action, frame, cx, cy, p) {
  var t = (frame / 6) * Math.PI * 2;
  var stride = action === "run" ? Math.sin(t) * 9 : action === "walk" ? Math.sin(t) * 6 : Math.sin(t) * 2;
  var bob = action === "run" ? Math.abs(Math.sin(t)) * 3 : action === "walk" ? Math.abs(Math.sin(t)) * 2 : 0;
  var bodyCy = cy + bob;
  var parts = [];
  var lc = (kind === "duck" || kind === "chicken") ? "#e87820" : p.shade;
  var lw = (kind === "chicken" || kind === "duck") ? 1.5 : 2;
  parts.push(path("M " + (cx-8) + " " + (bodyCy+8) + " L " + (cx-8+stride) + " " + (bodyCy+18), lc, lw));
  parts.push(path("M " + (cx+4) + " " + (bodyCy+8) + " L " + (cx+4-stride) + " " + (bodyCy+18), lc, lw));
  if (kind !== "chicken" && kind !== "duck") {
    parts.push('<rect x="' + (cx-11+stride) + '" y="' + (bodyCy+17) + '" width="5" height="3" rx="1" fill="' + p.accent + '"/>');
    parts.push('<rect x="' + (cx+1-stride) + '" y="' + (bodyCy+17) + '" width="5" height="3" rx="1" fill="' + p.accent + '"/>');
  }
  parts.push(isoBody(cx, bodyCy, 17, 10, p));
  var hs = (kind === "chicken" || kind === "duck") ? 8 : 10;
  var hcx = cx + 8, hcy = bodyCy - 12;
  parts.push(isoBody(hcx, hcy, hs, hs, p, -0.25));
  var feat = FEATURES[kind];
  if (feat) parts.push(feat(cx, bodyCy, p, action, t, hcx, hcy));
  return parts.join("\n");
}

function buildEating(kind, action, frame, cx, cy, p) {
  var t = (frame / 6) * Math.PI * 2;
  var headBob = Math.sin(t) * 4;
  var bodyCy = cy + 4;
  var parts = [];
  var lc = (kind === "duck" || kind === "chicken") ? "#e87820" : p.shade;
  var lw = (kind === "chicken" || kind === "duck") ? 1.5 : 2;
  parts.push(path("M " + (cx-6) + " " + (bodyCy+8) + " L " + (cx-6) + " " + (bodyCy+17), lc, lw));
  parts.push(path("M " + (cx+4) + " " + (bodyCy+8) + " L " + (cx+4) + " " + (bodyCy+17), lc, lw));
  if (kind !== "chicken" && kind !== "duck") {
    parts.push('<rect x="' + (cx-9) + '" y="' + (bodyCy+16) + '" width="5" height="3" rx="1" fill="' + p.accent + '"/>');
    parts.push('<rect x="' + (cx+1) + '" y="' + (bodyCy+16) + '" width="5" height="3" rx="1" fill="' + p.accent + '"/>');
  }
  parts.push(isoBody(cx, bodyCy, 17, 9, p));
  var hs = (kind === "chicken" || kind === "duck") ? 7 : 9;
  var hcx = cx + 14 + headBob * 0.3;
  var hcy = bodyCy + 2 + Math.abs(headBob) * 2;
  parts.push('<ellipse cx="' + hcx + '" cy="' + hcy + '" rx="' + hs + '" ry="' + hs + '" fill="' + p.body + '" stroke="' + OUTLINE + '" stroke-width="1.8" transform="rotate(0.6,' + hcx + ',' + hcy + ')"/>');
  if (kind === "duck" || kind === "chicken") {
    parts.push(path("M " + (hcx+hs-1) + " " + (hcy-1) + " L " + (hcx+hs+5) + " " + (hcy+1+headBob*0.5) + " L " + (hcx+hs-1) + " " + (hcy+3) + " Z", "#e87820"));
  }
  parts.push(circle(hcx + 3, hcy - 3, 1.5, p.accent));
  if (Math.abs(headBob) < 2 && kind !== "duck") {
    parts.push('<circle cx="' + (cx+8) + '" cy="' + (bodyCy+16) + '" r="2" fill="#8a5634" opacity="0.6"/>');
  }
  return parts.join("\n");
}

function buildSitting(kind, action, frame, cx, cy, p) {
  var t = (frame / 6) * Math.PI * 2;
  var breathe = Math.sin(t) * 1.5;
  var bodyCy = cy + 2;
  var parts = [];
  parts.push('<ellipse cx="' + (cx-8) + '" cy="' + (bodyCy+12) + '" rx="4" ry="2.5" fill="' + p.accent + '" opacity="0.6"/>');
  parts.push('<ellipse cx="' + (cx+6) + '" cy="' + (bodyCy+14) + '" rx="4" ry="2.5" fill="' + p.accent + '" opacity="0.6"/>');
  parts.push(isoBody(cx, bodyCy + breathe, 15, 14, p));
  var hs = (kind === "chicken" || kind === "duck") ? 8 : 10;
  var hcx = cx + 10, hcy = bodyCy - 12 + breathe;
  parts.push(isoBody(hcx, hcy, hs, hs, p, -0.2));
  var feat = FEATURES[kind];
  if (feat) parts.push(feat(cx, bodyCy, p, action, t, hcx, hcy));
  return parts.join("\n");
}

function buildLaying(kind, action, frame, cx, cy, p) {
  var t = (frame / 6) * Math.PI * 2;
  var breathe = Math.sin(t) * 2;
  var bodyCy = cy + 6;
  var parts = [];
  parts.push(isoBody(cx - 2, bodyCy, 22, 9, p, -0.1));
  var hs = (kind === "chicken" || kind === "duck") ? 7 : 9;
  var hcx = cx + 14;
  parts.push('<ellipse cx="' + hcx + '" cy="' + (bodyCy-2+breathe*0.3) + '" rx="' + hs + '" ry="7" fill="' + p.body + '" stroke="' + OUTLINE + '" stroke-width="1.5" transform="rotate(-0.4,' + hcx + ',' + (bodyCy-2) + ')"/>');
  parts.push(path("M " + (hcx+2) + " " + (bodyCy-4) + " Q " + (hcx+4) + " " + (bodyCy-2) + " " + (hcx+6) + " " + (bodyCy-4), "none", 1.2));
  var lc = (kind === "duck" || kind === "chicken") ? "#e87820" : p.shade;
  parts.push('<ellipse cx="' + (cx-10) + '" cy="' + (bodyCy+4) + '" rx="4" ry="3" fill="' + lc + '" opacity="0.5"/>');
  parts.push('<ellipse cx="' + (cx-6) + '" cy="' + (bodyCy+7) + '" rx="3.5" ry="2.5" fill="' + lc + '" opacity="0.4"/>');
  if (frame % 2 === 0) {
    parts.push('<text x="' + (hcx+2) + '" y="' + (bodyCy-12) + '" font-size="7" fill="' + p.accent + '" font-family="sans-serif" opacity="0.4">z</text>');
  } else if (frame % 3 === 1) {
    parts.push('<text x="' + (hcx+4) + '" y="' + (bodyCy-16) + '" font-size="9" fill="' + p.accent + '" font-family="sans-serif" opacity="0.35">Z</text>');
  }
  return parts.join("\n");
}
// END PART 3

// ── Crop Stage Builders ────────────────────────────────────────────
// 128x256, 4 stages per crop kind.

function buildSeed(w, h, col) {
  return svg(w, h,
    '<ellipse cx="' + (w/2) + '" cy="' + (h*0.75) + '" rx="40" ry="18" fill="#8a5634" stroke="' + OUTLINE + '" stroke-width="2"/>',
    '<ellipse cx="' + (w/2-6) + '" cy="' + (h*0.73) + '" rx="18" ry="7" fill="#7a4828"/>',
    '<ellipse cx="' + (w/2) + '" cy="' + (h*0.74) + '" rx="5" ry="3.5" fill="' + col.center + '" stroke="' + OUTLINE + '" stroke-width="1.2"/>',
    '<circle cx="' + (w/2) + '" cy="' + (h*0.74) + '" r="1.5" fill="' + col.leaf + '"/>'
  );
}

function buildSprout(w, h, col) {
  return svg(w, h,
    '<ellipse cx="' + (w/2) + '" cy="' + (h*0.78) + '" rx="38" ry="16" fill="#8a5634" stroke="' + OUTLINE + '" stroke-width="2"/>',
    '<line x1="' + (w/2) + '" y1="' + (h*0.78) + '" x2="' + (w/2) + '" y2="' + (h*0.58) + '" stroke="' + col.stem + '" stroke-width="2.5" stroke-linecap="round"/>',
    '<ellipse cx="' + (w/2-5) + '" cy="' + (h*0.68) + '" rx="6" ry="3" fill="' + col.leaf + '" stroke="' + OUTLINE + '" stroke-width="1" transform="rotate(-30,' + (w/2-5) + ',' + (h*0.68) + ')"/>',
    '<ellipse cx="' + (w/2+5) + '" cy="' + (h*0.64) + '" rx="5" ry="2.5" fill="' + col.leaf + '" stroke="' + OUTLINE + '" stroke-width="1" transform="rotate(25,' + (w/2+5) + ',' + (h*0.64) + ')"/>'
  );
}

function buildGrown(w, h, kind, col) {
  var parts = [
    '<ellipse cx="' + (w/2) + '" cy="' + (h*0.80) + '" rx="38" ry="15" fill="#8a5634" stroke="' + OUTLINE + '" stroke-width="2"/>',
    '<ellipse cx="' + (w/2-6) + '" cy="' + (h*0.78) + '" rx="18" ry="7" fill="#7a4828"/>',
    '<line x1="' + (w/2) + '" y1="' + (h*0.80) + '" x2="' + (w/2) + '" y2="' + (h*0.40) + '" stroke="' + col.stem + '" stroke-width="3" stroke-linecap="round"/>'
  ];
  if (kind === "oak") {
    parts.push('<ellipse cx="' + (w/2) + '" cy="' + (h*0.45) + '" rx="16" ry="12" fill="' + col.leaf + '" stroke="' + OUTLINE + '" stroke-width="1.5"/>');
    parts.push('<ellipse cx="' + (w/2-8) + '" cy="' + (h*0.48) + '" rx="10" ry="8" fill="' + col.petal + '" opacity="0.7"/>');
  } else if (kind === "sunflower") {
    parts.push('<ellipse cx="' + (w/2) + '" cy="' + (h*0.45) + '" rx="8" ry="10" fill="' + col.center + '" stroke="' + OUTLINE + '" stroke-width="1.2"/>');
    for (var a = 0; a < 6; a++) {
      var ang = (a / 6) * Math.PI * 2;
      parts.push('<ellipse cx="' + (w/2+Math.cos(ang)*9) + '" cy="' + (h*0.45+Math.sin(ang)*11) + '" rx="4" ry="6" fill="' + col.petal + '" stroke="' + OUTLINE + '" stroke-width="0.8"/>');
    }
  } else {
    for (var i = 0; i < 4; i++) {
      var ly = h * 0.55 + i * 12;
      var lx = w/2 + (i % 2 === 0 ? -7 : 7);
      parts.push('<ellipse cx="' + lx + '" cy="' + ly + '" rx="8" ry="4" fill="' + col.leaf + '" stroke="' + OUTLINE + '" stroke-width="1" transform="rotate(' + (i%2===0?-20:20) + ',' + lx + ',' + ly + ')"/>');
    }
    if (kind === "daisy") {
      parts.push('<circle cx="' + (w/2) + '" cy="' + (h*0.42) + '" r="4" fill="' + col.petal + '"/>');
      parts.push('<circle cx="' + (w/2) + '" cy="' + (h*0.42) + '" r="2" fill="' + col.center + '"/>');
    }
  }
  return svg(w, h, parts.join("\n"));
}
// END PART 4A

function buildMature(w, h, kind, col) {
  var parts = [
    '<ellipse cx="' + (w/2) + '" cy="' + (h*0.82) + '" rx="38" ry="14" fill="#8a5634" stroke="' + OUTLINE + '" stroke-width="2"/>',
    '<line x1="' + (w/2) + '" y1="' + (h*0.82) + '" x2="' + (w/2) + '" y2="' + (h*0.30) + '" stroke="' + col.stem + '" stroke-width="3.5" stroke-linecap="round"/>'
  ];
  if (kind === "oak") {
    parts.push('<ellipse cx="' + (w/2) + '" cy="' + (h*0.30) + '" rx="24" ry="18" fill="' + col.petal + '"/>');
    parts.push('<ellipse cx="' + (w/2-8) + '" cy="' + (h*0.34) + '" rx="14" ry="10" fill="' + col.leaf + '" opacity="0.6"/>');
    parts.push('<ellipse cx="' + (w/2) + '" cy="' + (h*0.30) + '" rx="24" ry="18" fill="none" stroke="' + OUTLINE + '" stroke-width="2"/>');
  } else if (kind === "sunflower") {
    parts.push('<circle cx="' + (w/2) + '" cy="' + (h*0.30) + '" r="12" fill="' + col.center + '" stroke="' + OUTLINE + '" stroke-width="1.5"/>');
    for (var a = 0; a < 10; a++) {
      var ang = (a / 10) * Math.PI * 2;
      parts.push('<ellipse cx="' + (w/2+Math.cos(ang)*14) + '" cy="' + (h*0.30+Math.sin(ang)*15) + '" rx="4.5" ry="8" fill="' + col.petal + '" stroke="' + OUTLINE + '" stroke-width="1"/>');
    }
  } else if (kind === "daisy") {
    parts.push('<circle cx="' + (w/2) + '" cy="' + (h*0.34) + '" r="12" fill="' + col.petal + '" stroke="' + OUTLINE + '" stroke-width="1.5"/>');
    for (var a = 0; a < 8; a++) {
      var ang = (a / 8) * Math.PI * 2;
      parts.push('<ellipse cx="' + (w/2+Math.cos(ang)*12) + '" cy="' + (h*0.34+Math.sin(ang)*12) + '" rx="3.5" ry="5" fill="' + col.petal + '" stroke="' + OUTLINE + '" stroke-width="0.8"/>');
    }
    parts.push('<circle cx="' + (w/2) + '" cy="' + (h*0.34) + '" r="4" fill="' + col.center + '"/>');
  } else {
    parts.push('<ellipse cx="' + (w/2) + '" cy="' + (h*0.42) + '" rx="18" ry="14" fill="' + col.leaf + '"/>');
    parts.push('<ellipse cx="' + (w/2-6) + '" cy="' + (h*0.40) + '" rx="12" ry="10" fill="' + col.petal + '" opacity="0.6"/>');
    parts.push('<ellipse cx="' + (w/2) + '" cy="' + (h*0.42) + '" rx="18" ry="14" fill="none" stroke="' + OUTLINE + '" stroke-width="1.8"/>');
    for (var i = 0; i < 3; i++) {
      parts.push('<circle cx="' + (w/2-8+i*8) + '" cy="' + (h*0.39+(i%2)*6) + '" r="3" fill="#d4c878"/>');
    }
  }
  return svg(w, h, parts.join("\n"));
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log("=== Phase 4+5: Isometric Sprite & Asset Generator ===\n");

  var ac = 0;
  for (var ki = 0; ki < ANIMALS.length; ki++) {
    var kind = ANIMALS[ki];
    for (var ai = 0; ai < ACTIONS.length; ai++) {
      var action = ACTIONS[ai];
      var dir = join(OUT, "animals", kind, action);
      mkdirSync(dir, { recursive: true });
      var p = PAL[kind];
      var frames = [];

      for (var frame = 0; frame < 6; frame++) {
        var bodySvg;
        if (action === "lay") bodySvg = buildLaying(kind, action, frame, 48, 62, p);
        else if (action === "sit") bodySvg = buildSitting(kind, action, frame, 48, 62, p);
        else if (action === "eat") bodySvg = buildEating(kind, action, frame, 48, 62, p);
        else bodySvg = buildStanding(kind, action, frame, 48, 62, p);

        var sh = action === "lay" ? 82 : 80;
        var sr = action === "lay" ? 22 : 16;
        var sry = action === "lay" ? 4 : 6;
        var fullSvg = svg(96, 96, shadow(48, sh, sr, sry), bodySvg);
        frames.push(await svgToPng(fullSvg, 96, 96));
      }

      var comps = frames.map(function(buf, i) { return { input: buf, left: i * 96, top: 0 }; });
      var sheet = await sharp({
        create: { width: 576, height: 96, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
      }).composite(comps).png().toBuffer();

      writeFileSync(join(dir, "spritesheet.png"), sheet);
      console.log("  [OK] " + kind + "/" + action);
      ac++;
    }
  }

  var cc = 0;
  var CROP_BUILDERS = [buildSeed, buildSprout, buildGrown, buildMature];
  for (var ki = 0; ki < CROPS.length; ki++) {
    var kind = CROPS[ki];
    var dir = join(OUT, "crops", kind);
    mkdirSync(dir, { recursive: true });
    var col = CROP_COLORS[kind];

    for (var stage = 0; stage < 4; stage++) {
      var builder = CROP_BUILDERS[stage];
      var svgStr = stage < 2 ? builder(128, 256, col) : builder(128, 256, kind, col);
      var png = await svgToPng(svgStr, 128, 256);
      writeFileSync(join(dir, "stage_" + (stage + 1) + ".png"), png);
      console.log("  [OK] " + kind + "/stage_" + (stage + 1));
      cc++;
    }
  }

  // ── Phase 5: Terrain Tiles ──────────────────────────────────────────
  console.log("\n--- Terrain Tiles ---");
  var tilesDir = join(OUT, "tiles");
  mkdirSync(tilesDir, { recursive: true });
  var grassPng = await svgToPng(renderGrassTile(128, 256), 128, 256);
  writeFileSync(join(tilesDir, "grass.png"), grassPng);
  console.log("  [OK] tiles/grass.png");

  // ── Phase 5: Building Props ─────────────────────────────────────────
  console.log("\n--- Building Props ---");
  var propsDir = join(OUT, "props");
  mkdirSync(propsDir, { recursive: true });
  var storePng = await svgToPng(renderStoreProp(256, 384), 256, 384);
  writeFileSync(join(propsDir, "store.png"), storePng);
  console.log("  [OK] props/store.png");
  var barnPng = await svgToPng(renderBarnProp(256, 400), 256, 400);
  writeFileSync(join(propsDir, "barn.png"), barnPng);
  console.log("  [OK] props/barn.png");
  var siloPng = await svgToPng(renderSiloProp(180, 320), 180, 320);
  writeFileSync(join(propsDir, "silo.png"), siloPng);
  console.log("  [OK] props/silo.png");

  // ── Phase 5: Themed FX Particles ────────────────────────────────────
  console.log("\n--- FX Particles ---");
  var fxDir = join(OUT, "fx");
  mkdirSync(fxDir, { recursive: true });
  var dropPng = await svgToPng(renderFxWaterDrop(), 32, 32);
  writeFileSync(join(fxDir, "water_drop.png"), dropPng);
  console.log("  [OK] fx/water_drop.png");
  var leafPng = await svgToPng(renderFxLeaf(), 32, 32);
  writeFileSync(join(fxDir, "leaf.png"), leafPng);
  console.log("  [OK] fx/leaf.png");
  var starPng = await svgToPng(renderFxStar(), 32, 32);
  writeFileSync(join(fxDir, "star.png"), starPng);
  console.log("  [OK] fx/star.png");
  var glowPng = await svgToPng(renderFxGlow(), 64, 64);
  writeFileSync(join(fxDir, "glow.png"), glowPng);
  console.log("  [OK] fx/glow.png");

  var tc = 1 + 3 + 4; // tiles + props + fx
  console.log("\nDone! " + ac + " spritesheets + " + cc + " crop stages + " + tc + " assets generated.");
}

main().catch(function(e) { console.error("ERROR:", e.message || e); process.exit(1); });