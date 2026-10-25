/**
 * The whole 3D Tonnetz in one shader pair. The mesh is one torus copy (the
 * parallelogram spanned by the period vectors (4, −4) and (0, 3) from lattice
 * corner (−2, 1)), tiled by instances around the camera. Everything else is
 * procedural in the fragment shader from the continuous lattice coordinate:
 * triangle fills, anti-aliased edges and seams (all lattice edges lie on
 * integer lines of i, j or i + j), glass nodes, atlas labels, copy tints and
 * per-triad highlights. Repeats of a triad light together for free, because
 * lighting is looked up by triad, not by position.
 *
 * The vertex shader bends the plane away from the camera (phantom.land's
 * curved grid) and, with uRoll, rolls one copy up into the literal torus.
 */

export const COPY_ORIGIN = { i: -2, j: 1 };
export const PERIOD_A = { i: 4, j: -4 }; // four minor thirds
export const PERIOD_B = { i: 0, j: 3 }; // three major thirds

export const TORUS_R = 2.1;
export const TORUS_r = 0.95;

export const latticeVertex = /* glsl */ `
attribute vec2 aLat;
attribute vec2 aCopy;

uniform vec2 uCam;
uniform vec2 uCopyBase;
uniform float uCurve;
uniform float uRoll;

varying vec2 vLat;
varying vec2 vCopy;
varying vec2 vRel;
varying vec3 vPos;

const float S3 = 0.8660254;
const float TAU = 6.2831853;

void main() {
  vec2 copy = aCopy + uCopyBase;
  vec2 lat = aLat + copy.x * vec2(4.0, -4.0) + copy.y * vec2(0.0, 3.0);
  vec2 rel = lat - uCam;
  vec2 xy = vec2(rel.x + 0.5 * rel.y, S3 * rel.y);
  vec3 P = vec3(xy, -uCurve * dot(xy, xy));

  if (uRoll > 0.0) {
    // Torus angles: the small loop carries major thirds (u = i + j, 3 steps),
    // the large loop minor thirds (v = i, 4 steps). The camera's point faces us.
    float du = rel.x + rel.y;
    float dv = rel.x;
    float th = TAU * du / 3.0;
    float ph = TAU * dv / 4.0;
    float ring = ${TORUS_R.toFixed(3)} + ${TORUS_r.toFixed(3)} * cos(th);
    vec3 T = vec3(ring * sin(ph), ${TORUS_r.toFixed(3)} * sin(th), ring * cos(ph) - ${(TORUS_R + TORUS_r).toFixed(3)});
    // Early in the roll, shear the torus's local frame onto the plane's so the
    // sheet curls instead of swirling; relax to the true torus as it closes.
    vec2 ax = vec2(0.5, -S3) / (${(TORUS_R + TORUS_r).toFixed(3)} * TAU / 4.0);
    vec2 ay = vec2(0.5, S3) / (${TORUS_r.toFixed(3)} * TAU / 3.0);
    float k = smoothstep(0.0, 1.0, uRoll);
    mat2 A = mat2(mix(ax, vec2(1.0, 0.0), k), mix(ay, vec2(0.0, 1.0), k));
    float zs = mix(sqrt(abs(ax.x * ay.y - ax.y * ay.x)), 1.0, k);
    T = vec3(A * T.xy, T.z * zs);
    // Tilt toward the camera so the hole shows, and centre the torus on screen.
    float a = -1.0 * k;
    float ca = cos(a);
    float sa = sin(a);
    T = vec3(T.x, T.y * ca - T.z * sa, T.y * sa + T.z * ca);
    float cz = -${(TORUS_R + TORUS_r).toFixed(3)} * zs;
    T.y -= k * (-cz * sa);
    // The plane share is gone by 0.6, before the window starts discarding the
    // other copies, so the torus is exactly periodic and shows no crack.
    P = mix(P, T, smoothstep(0.0, 0.6, uRoll));
  }

  vLat = lat;
  vCopy = copy;
  vRel = xy;
  vPos = P;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(P, 1.0);
}
`;

export const latticeFragment = /* glsl */ `
uniform vec2 uCam;
uniform float uCentre;
uniform float uRoll;
uniform float uTime;
uniform float uShowChords;
uniform float uFadeR;
uniform float uLit[24];
uniform float uPlay[24];
uniform vec3 uFocus;

uniform vec3 uBg;
uniform vec3 uFill;
uniform vec3 uRim;
uniform vec3 uHair;
uniform vec3 uSeam;
uniform vec3 uText;
uniform vec3 uTextStrong;
uniform vec3 uAccent;
uniform vec3 uTint;
uniform vec3 uMajor;
uniform vec3 uMinor;
uniform sampler2D uAtlas;

varying vec2 vLat;
varying vec2 vCopy;
varying vec2 vRel;
varying vec3 vPos;

const float S3 = 0.8660254;

vec2 toXY(vec2 l) { return vec2(l.x + 0.5 * l.y, S3 * l.y); }

float lineAA(float d, float halfw, float fw) {
  return 1.0 - smoothstep(halfw - fw, halfw + fw, d);
}

float label(vec2 q, float idx, vec2 size) {
  vec2 uv = q / size + 0.5;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
  float col = mod(idx, 8.0);
  float row = floor(idx / 8.0);
  vec2 a = vec2((col + uv.x) / 8.0, 1.0 - (row + 1.0 - uv.y) / 5.0);
  return texture2D(uAtlas, a).a;
}

/** Light level of the triangle at lattice cell p (up or down). */
float triGlow(vec2 p, bool isUp) {
  vec2 r = isUp ? p : p + vec2(0.0, 1.0);
  float pc = mod(uCentre + 7.0 * r.x + 4.0 * r.y, 12.0);
  int t = int(pc + 0.5) * 2 + (isUp ? 0 : 1);
  return uLit[t] + uPlay[t];
}

void main() {
  vec2 L = vLat;

  // Torus window for the rolled-up overview: one copy around the camera.
  if (uRoll > 0.0) {
    float du = (L.x + L.y) - (uCam.x + uCam.y);
    float dv = L.x - uCam.x;
    bool inside = du >= -1.5 && du < 1.5 && dv >= -2.0 && dv < 2.0;
    if (!inside && uRoll > 0.6) discard;
  }

  float fi = floor(L.x);
  float fj = floor(L.y);
  vec2 fr = L - vec2(fi, fj);
  bool up = fr.x + fr.y < 1.0;
  vec2 rootL = up ? vec2(fi, fj) : vec2(fi, fj + 1.0);
  float pc = mod(uCentre + 7.0 * rootL.x + 4.0 * rootL.y, 12.0);
  int tri = int(pc + 0.5) * 2 + (up ? 0 : 1);
  vec2 cen = up ? vec2(fi + 1.0 / 3.0, fj + 1.0 / 3.0) : vec2(fi + 2.0 / 3.0, fj + 2.0 / 3.0);

  float lit = uLit[tri];
  float breathe = 0.78 + 0.22 * sin(uTime * 6.6);
  float play = uPlay[tri] * breathe;
  float focusCopy = uFocus.z * (1.0 - step(0.05, length(cen - uFocus.xy)));
  float glow = clamp(lit * 0.55 + focusCopy * 0.45 + play, 0.0, 1.0);

  // ---- fill ----
  vec3 col = mix(uBg, uFill, 0.45);
  float checker = mod(vCopy.x + vCopy.y, 2.0);
  col = mix(col, uTint, 0.07 * checker);
  if (uShowChords > 0.5) col = mix(col, up ? uMajor : uMinor, 0.17);
  col = mix(col, uAccent, 0.13 * lit + 0.12 * focusCopy + 0.32 * play);

  // ---- edges (three families of integer lines) ----
  float di = abs(fract(L.x + 0.5) - 0.5);
  float dj = abs(fract(L.y + 0.5) - 0.5);
  float dk = abs(fract(L.x + L.y + 0.5) - 0.5);
  float fwi = fwidth(L.x);
  float fwj = fwidth(L.y);
  float fwk = fwidth(L.x + L.y);
  float edge = max(
    max(lineAA(di, max(0.011, fwi * 0.55), fwi), lineAA(dj, max(0.011, fwj * 0.55), fwj)),
    lineAA(dk, max(0.011, fwk * 0.55), fwk)
  );
  col = mix(col, uHair, edge);

  // Lit triangles glow along their own inner edges.
  float dEdge = min(di, min(dj, dk)) * S3;
  float rim = glow * (1.0 - smoothstep(0.0, 0.085, dEdge));
  col = mix(col, uAccent, rim * 0.9);
  col = mix(col, uAccent, edge * glow);

  // ---- seams between torus copies ----
  float su = abs(mod(L.x + L.y + 1.0 + 1.5, 3.0) - 1.5);
  float sv = abs(mod(L.x + 2.0 + 2.0, 4.0) - 2.0);
  float seam = max(lineAA(su, max(0.018, fwk * 0.6), fwk), lineAA(sv, max(0.018, fwi * 0.6), fwi));
  col = mix(col, uSeam, seam * 0.55);

  // ---- nodes ----
  vec2 c0 = up ? vec2(fi, fj) : vec2(fi + 1.0, fj);
  vec2 c1 = up ? vec2(fi + 1.0, fj) : vec2(fi, fj + 1.0);
  vec2 c2 = up ? vec2(fi, fj + 1.0) : vec2(fi + 1.0, fj + 1.0);
  vec2 n = c0;
  float dn = length(toXY(L - c0));
  float d1 = length(toXY(L - c1));
  float d2 = length(toXY(L - c2));
  if (d1 < dn) { n = c1; dn = d1; }
  if (d2 < dn) { n = c2; dn = d2; }
  float R = 0.19;
  float fwn = max(fwidth(dn), 1e-4);
  float disc = 1.0 - smoothstep(R - fwn, R + fwn, dn);
  if (disc > 0.0) {
    float npc = mod(uCentre + 7.0 * n.x + 4.0 * n.y, 12.0);
    // Accent only where the node is a corner of a lit triangle (6 around it).
    float nlit = 0.0;
    nlit = max(nlit, triGlow(n, true));
    nlit = max(nlit, triGlow(n - vec2(1.0, 0.0), true));
    nlit = max(nlit, triGlow(n - vec2(0.0, 1.0), true));
    nlit = max(nlit, triGlow(n - vec2(1.0, 0.0), false));
    nlit = max(nlit, triGlow(n - vec2(0.0, 1.0), false));
    nlit = max(nlit, triGlow(n - vec2(1.0, 1.0), false));
    nlit = clamp(nlit, 0.0, 1.0);
    vec2 q = toXY(L - n);
    // glass wash: highlight toward the upper left, as the card's nodes
    float wash = 1.0 - clamp(length(q / R - vec2(-0.32, 0.36)) * 0.75, 0.0, 1.0);
    vec3 nodeCol = mix(uFill, mix(uTextStrong, uAccent, nlit), wash * (0.12 + 0.2 * nlit));
    float ring = smoothstep(R - 0.03 - fwn, R - 0.03 + fwn, dn);
    nodeCol = mix(nodeCol, mix(uRim, uAccent, nlit), ring);
    // note name, tilted 35° counterclockwise
    float ca = 0.8191520;
    float sa = 0.5735764;
    vec2 qr = vec2(ca * q.x + sa * q.y, -sa * q.x + ca * q.y);
    float lab = label(qr, npc, vec2(0.34, 0.17));
    nodeCol = mix(nodeCol, mix(uText, uTextStrong, max(nlit, 0.25)), lab);
    col = mix(col, nodeCol, disc);
  }

  // ---- chord names ----
  if (uShowChords > 0.5) {
    float cl = label(toXY(L - cen), 12.0 + float(tri), vec2(0.4, 0.2));
    col = mix(col, mix(uText, uTextStrong, max(glow, 0.2)), cl * (1.0 - disc));
  }

  // ---- overview ----
  if (uRoll > 0.0) {
    float du = (L.x + L.y) - (uCam.x + uCam.y);
    float dv = L.x - uCam.x;
    bool inside = du >= -1.5 && du < 1.5 && dv >= -2.0 && dv < 2.0;
    if (!inside) col = mix(col, uBg, clamp(uRoll / 0.22, 0.0, 1.0));
    vec3 nrm = normalize(cross(dFdx(vPos), dFdy(vPos)));
    col *= mix(1.0, 0.5 + 0.5 * abs(nrm.z), uRoll);
    // "you are here"
    float r = length(vRel);
    float mr = 0.3 * (1.0 - 0.7 * uRoll);
    float marker = 1.0 - smoothstep(0.03 * (1.0 - 0.6 * uRoll), 0.03 * (1.0 - 0.6 * uRoll) + fwidth(r) * 1.5, abs(r - mr));
    col = mix(col, uAccent, marker * smoothstep(0.1, 0.6, uRoll));
  }

  // Soft fade toward the far edges of the curved plane.
  float fade = smoothstep(uFadeR * 0.8, uFadeR * 1.08, length(vRel));
  col = mix(col, uBg, fade * (1.0 - uRoll));

  // Colours are sRGB throughout (see LatticeScene), so no output conversion.
  gl_FragColor = vec4(col, 1.0);
}
`;
