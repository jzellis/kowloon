// generateCircleIcon — composite up to six member avatars into the hexagonal
// Circle mosaic icon. Pure image work: takes avatar image Buffers, returns a
// PNG Buffer. No DB, no network. Orchestration (which avatars, storing the
// result) lives in regenerateCircleIcon.js.
//
// Layout matches the agreed design (flat-top hexagon, seamless):
//   1 -> whole   2 -> top/bottom   3 -> top-left/top-right/bottom
//   4 -> quadrants   5 -> six wedges w/ a solid-black empty slot   6 -> six wedges
// Each segment is filled from the TOP-CENTRE of its own avatar (the head), so a
// low segment still shows a face, not a body.

import sharp from "sharp";

const S = 512; // master icon size (px)
const C = [S / 2, S / 2];
const R = 250; // centre -> vertex
const MISSING_FILL = { r: 201, g: 201, b: 207 }; // neutral grey for avatar-less members

const rad = (d) => (d * Math.PI) / 180;
const vtx = (deg) => [C[0] + R * Math.cos(rad(deg)), C[1] + R * Math.sin(rad(deg))];
const V0 = vtx(0), V1 = vtx(60), V2 = vtx(120), V3 = vtx(180), V4 = vtx(240), V5 = vtx(300);
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const Mtop = mid(V4, V5), Mur = mid(V5, V0), Mlr = mid(V0, V1);
const Mbot = mid(V1, V2), Mll = mid(V2, V3), Mul = mid(V3, V4);
const HEX = [V4, V5, V0, V1, V2, V3];

function wedges() {
  return {
    TL: [C, Mul, V4, Mtop], TR: [C, Mtop, V5, Mur], R: [C, Mur, V0, Mlr],
    BR: [C, Mlr, V1, Mbot], BL: [C, Mbot, V2, Mll], L: [C, Mll, V3, Mul],
  };
}

// Slot polygons per member count. `black: true` renders a solid-black slot.
function layout(n) {
  switch (n) {
    case 1: return [{ poly: HEX }];
    case 2: return [{ poly: [V3, V4, V5, V0] }, { poly: [V3, V0, V1, V2] }];
    case 3: return [
      { poly: [C, Mtop, V4, V3, Mll] },
      { poly: [C, Mtop, V5, V0, Mlr] },
      { poly: [C, Mll, V2, V1, Mlr] },
    ];
    case 4: return [
      { poly: [C, Mtop, V4, V3] }, { poly: [C, Mtop, V5, V0] },
      { poly: [C, V3, V2, Mbot] }, { poly: [C, V0, V1, Mbot] },
    ];
    case 5: {
      const w = wedges();
      return [{ poly: w.TL, black: true }, { poly: w.TR }, { poly: w.R }, { poly: w.BR }, { poly: w.BL }, { poly: w.L }];
    }
    default: { // 6+
      const w = wedges();
      return [{ poly: w.TL }, { poly: w.TR }, { poly: w.R }, { poly: w.BR }, { poly: w.BL }, { poly: w.L }];
    }
  }
}

const ptsStr = (poly) => poly.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const polySvg = (poly, fill) =>
  Buffer.from(`<svg width="${S}" height="${S}"><polygon points="${ptsStr(poly)}" fill="${fill}"/></svg>`);

// Fill a slot with the top-centre of an avatar (or a neutral panel when the
// member has no usable avatar), then clip to the slot shape.
async function fillSlot(avatarBuf, poly) {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const ox = Math.max(0, Math.floor(Math.min(...xs)));
  const oy = Math.max(0, Math.floor(Math.min(...ys)));
  const bw = Math.min(S - ox, Math.max(1, Math.ceil(Math.max(...xs) - ox)));
  const bh = Math.min(S - oy, Math.max(1, Math.ceil(Math.max(...ys) - oy)));

  let panel;
  if (avatarBuf) {
    panel = await sharp(avatarBuf)
      .rotate() // honour EXIF orientation
      .resize(bw, bh, { fit: "cover", position: "top" }) // top-centre = the head
      .ensureAlpha()
      .png()
      .toBuffer();
  } else {
    panel = await sharp({ create: { width: bw, height: bh, channels: 4, background: { ...MISSING_FILL, alpha: 1 } } })
      .png()
      .toBuffer();
  }

  const placed = await sharp({
    create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: panel, left: ox, top: oy }])
    .png()
    .toBuffer();

  return sharp(placed)
    .composite([{ input: polySvg(poly, "#fff"), blend: "dest-in" }])
    .png()
    .toBuffer();
}

/**
 * @param {(Buffer|null)[]} avatars 1..6 avatar image Buffers (null => neutral panel)
 * @returns {Promise<Buffer>} PNG buffer of the composited hexagon icon
 */
export default async function generateCircleIcon(avatars) {
  const list = (avatars || []).slice(0, 6);
  if (list.length === 0) throw new Error("generateCircleIcon: need at least one avatar");

  const slots = layout(list.length);
  const layers = [];
  let ai = 0;
  for (const slot of slots) {
    if (slot.black) {
      layers.push({ input: polySvg(slot.poly, "#000"), left: 0, top: 0 });
    } else {
      const buf = list[ai++] ?? null;
      layers.push({ input: await fillSlot(buf, slot.poly), left: 0, top: 0 });
    }
  }

  const composed = await sharp({
    create: { width: S, height: S, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(layers)
    .png()
    .toBuffer();

  // Trim anything outside the hexagon for a clean anti-aliased edge.
  return sharp(composed)
    .composite([{ input: polySvg(HEX, "#fff"), blend: "dest-in" }])
    .png()
    .toBuffer();
}
