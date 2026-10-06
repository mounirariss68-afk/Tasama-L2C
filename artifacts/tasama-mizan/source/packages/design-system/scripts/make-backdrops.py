"""Tasama Ascend backdrops.

Composition follows the Atelier house style: broad flowing ribbons with lit
edges, hairline accent filaments riding the same curves, a sparse particle
field. Here the ribbons RISE left to right rather than sweeping flat — the
Tasama wordmark is built from rising diagonal cuts and the name itself (تسامى)
means to rise, so the backdrop carries the same gesture.

Palette read from the computed styles of tasama.com.sa:
  #10069F ultramarine (the wordmark ink)   #07105F navy (hero band background)
  #342BAD violet-blue (panel fills)        #B59E5F gold (the bilingual subline)
  #ADDC91 soft green (portrait nimbus)

Contrast is the fuel: the glass scale needs something varied to refract.
Target a greyscale spread of 150-220 across the frame INCLUDING the middle.

Deterministic from SEED.  python3 make-backdrops.py
"""
import numpy as np
from PIL import Image, ImageFilter

W, H = 2560, 1440
SEED = 20260917

DEEP = np.array([4, 8, 31], float)
NAVY = np.array([7, 16, 95], float)
ULTRA = np.array([16, 6, 159], float)
VIOLET = np.array([52, 43, 173], float)
INDIGO = np.array([139, 130, 245], float)
GOLD = np.array([181, 158, 95], float)
GOLDLT = np.array([228, 206, 148], float)
GREEN = np.array([173, 220, 145], float)
COOL = np.array([250, 251, 254], float)

YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)
NX, NY = XX / W, YY / H


def gblur(a, r):
    k = max(float(a.max()), 1e-6)
    im = Image.fromarray(np.clip(a / k * 255, 0, 255).astype(np.uint8), "L")
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r)), np.float32) / 255.0 * k


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def curve(a0, amps, freqs, phases, rise=0.0):
    """A ribbon centre line y(x). `rise` lifts the line toward the right."""
    t = np.linspace(0, 1, W)
    y = np.full(W, a0, np.float32) - rise * t
    for a, f, p in zip(amps, freqs, phases):
        y += a * np.sin(2 * np.pi * f * t + p)
    return y.astype(np.float32)


def ribbon(centre, thick, feather=0.055):
    d = np.abs(NY - centre[None, :])
    t = thick[None, :]
    return smoothstep(t / 2 + feather * t, t / 2 - feather * t, d).astype(np.float32)


def rim(centre, thick, width=0.010, side=-1.0):
    d = np.abs(NY - (centre + side * thick / 2)[None, :])
    return np.exp(-(d / width) ** 2).astype(np.float32)


def thread(centre, width=0.0030):
    d = np.abs(NY - centre[None, :])
    return np.exp(-(d / width) ** 2).astype(np.float32)


def xwin(a, b, feather=0.22):
    return (
        smoothstep(a - feather, a + feather * 0.4, NX)
        * (1 - smoothstep(b - feather * 0.4, b + feather, NX))
    ).astype(np.float32)


def particles(rng, n, mask):
    p = np.zeros((H, W), np.float32)
    xs, ys = rng.integers(0, W, n), rng.integers(0, H, n)
    keep = mask[ys, xs] > rng.random(n) * 0.9
    xs, ys = xs[keep], ys[keep]
    p[ys, xs] = 0.6 + rng.random(len(xs)) * 0.4
    return gblur(p, 1.6) * 40 + gblur(p, 7.0) * 12


def save(rgb, path):
    Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB").save(
        path, "WEBP", quality=93, method=6
    )
    g = np.asarray(Image.open(path).convert("L"), float)
    mid = g[H // 3 : 2 * H // 3, W // 4 : 3 * W // 4]
    print(
        f"{path}: spread {np.percentile(g,99)-np.percentile(g,1):.0f}  "
        f"mid-frame {np.percentile(mid,99)-np.percentile(mid,1):.0f}  "
        f"mean {g.mean():.0f}"
    )


# =================================================================== DARK
rng = np.random.default_rng(SEED)

u = np.clip(NX * 0.58 + NY * 0.60, 0, 1)
rgb = DEEP + (NAVY * 1.35 - DEEP) * (u**1.20)[..., None]
rgb += (
    np.exp(-(((NX - 0.86) / 0.40) ** 2 + ((NY - 0.74) / 0.46) ** 2)) * 0.62
)[..., None] * ULTRA * 0.30

RIBBONS = [
    # a0, amps, freqs, phases, rise, thick, fill, fill_k, rim_col, rim_k, rim_w
    (1.22, [0.09, 0.030], [0.85, 2.0], [1.9, 0.4], 0.24, 0.44, VIOLET, 0.26, INDIGO, 0.34, 0.016),
    (1.08, [0.11, 0.034], [0.75, 1.7], [2.6, 1.1], 0.26, 0.28, ULTRA, 0.34, INDIGO, 0.62, 0.011),
    (1.32, [0.08, 0.026], [1.05, 2.3], [0.7, 2.2], 0.22, 0.26, VIOLET, 0.30, GOLD, 0.44, 0.010),
    (0.96, [0.09, 0.030], [0.70, 1.9], [3.4, 0.9], 0.28, 0.14, VIOLET, 0.28, GOLDLT, 0.80, 0.008),
    # Two thin, strongly lit ribbons through the mid-frame. Fill near zero, rim
    # bright: this is the pair that keeps the mid-frame spread up.
    (0.74, [0.10, 0.032], [0.80, 1.8], [1.2, 2.4], 0.26, 0.055, ULTRA, 0.16, INDIGO, 1.05, 0.006),
    (0.58, [0.08, 0.026], [0.95, 2.1], [4.1, 1.3], 0.22, 0.040, VIOLET, 0.14, GOLDLT, 0.85, 0.005),
]
for a0, amps, freqs, phases, rise, t0, fill, fk, rimc, rk, rw in RIBBONS:
    c = curve(a0, amps, freqs, phases, rise)
    th = t0 * (1 + 0.30 * np.sin(np.linspace(0, 1, W) * 2 * np.pi * 1.3 + a0 * 7)).astype(np.float32)
    w = xwin(0.08, 1.25, 0.30)
    rgb += (gblur(ribbon(c, th), 14) * w)[..., None] * fill * fk
    rgb += (gblur(rim(c, th, rw, -1.0), 3) * w)[..., None] * rimc * rk
    rgb += (gblur(rim(c, th, rw * 2.2, +1.0), 9) * w)[..., None] * rimc * rk * 0.30

# Gold filaments — the one warm note, riding the same rise.
for a0, f, p, col, k, rise in [
    (1.12, 0.85, 2.2, GOLDLT, 0.95, 0.26),
    (1.00, 0.78, 2.9, GOLD, 0.90, 0.28),
    (1.30, 1.05, 0.5, GREEN, 0.50, 0.20),
    (0.66, 0.90, 1.6, GOLD, 0.85, 0.24),
    (0.48, 1.15, 3.7, INDIGO, 0.70, 0.18),
]:
    c = curve(a0, [0.11, 0.032], [f, f * 2.3], [p, p * 1.7], rise)
    w = xwin(0.05, 1.3, 0.34)
    glow = thread(c, 0.0030) * w
    a = np.clip(gblur(glow, 1.5) * k, 0, 1)[..., None]
    rgb = rgb * (1 - a) + col * 1.18 * a
    rgb += gblur(glow, 18)[..., None] * col * k * 0.30

comb = np.zeros((H, W), np.float32)
for i in range(24):
    comb += thread(curve(1.06 + i * 0.006, [0.10, 0.030], [0.80, 1.9], [2.5, 1.0], 0.26), 0.0013)
comb *= xwin(0.12, 1.2, 0.30)
rgb += (gblur(comb, 1.2) * 0.16)[..., None] * INDIGO

field = np.clip(gblur(comb, 60) * 3 + 0.18, 0, 1)
rgb += particles(rng, 1600, field)[..., None] * np.array([196.0, 208.0, 255.0]) / 255.0 * 2.1

# Deepen the upper-left so the title bar and the first panels sit on quiet.
rgb *= (1 - np.exp(-(((NX - 0.20) / 0.85) ** 2 + ((NY - 0.02) / 0.78) ** 2)) * 0.46)[..., None]
save(rgb, "dark-backdrop.webp")

# ================================================================== LIGHT
rng = np.random.default_rng(SEED + 3)

rgb = np.broadcast_to(COOL, (H, W, 3)).astype(np.float32).copy()
rgb -= (smoothstep(0.10, 1.0, NY) * 8)[..., None]
rgb -= (np.exp(-(((NX - 0.40) / 0.55) ** 2 + ((NY - 0.18) / 0.45) ** 2)) * 5)[..., None]

for a0, amps, freqs, phases, rise, t0, col, k in [
    (0.34, [0.09, 0.028], [0.78, 1.9], [1.2, 0.5], 0.16, 0.30, VIOLET, 0.075),
    (0.50, [0.12, 0.036], [0.70, 1.6], [2.8, 1.4], 0.20, 0.24, ULTRA, 0.085),
    (0.24, [0.07, 0.026], [1.00, 2.2], [0.3, 2.0], 0.12, 0.18, GOLD, 0.050),
]:
    c = curve(a0, amps, freqs, phases, rise)
    th = np.full(W, t0, np.float32) * (1 + 0.25 * np.sin(np.linspace(0, 1, W) * 6 + a0 * 9)).astype(np.float32)
    band = gblur(ribbon(c, th), 22) * k
    rgb = rgb * (1 - band[..., None]) + col * band[..., None]


def sweep(strokes, stops, window, edge):
    global rgb
    for a0, amps, freqs, phases, rise, t0, k, feather, blur in strokes:
        c = curve(a0, amps, freqs, phases, rise)
        th = np.full(W, t0, np.float32) * (1 + 0.20 * np.sin(np.linspace(0, 1, W) * 5 + a0 * 4)).astype(np.float32)
        band = gblur(ribbon(c, th, feather), blur) * window
        t = np.clip(NX, 0, 1)
        n = len(stops) - 1
        i = np.clip((t * n).astype(int), 0, n - 1)
        f = (t * n - i)[..., None]
        col = np.array(stops)[i] * (1 - f) + np.array(stops)[i + 1] * f
        a = (band * k)[..., None]
        rgb = rgb * (1 - a) + col * a
        e = (gblur(rim(c, th, 0.010, -1.0), 4) * window * 0.42)[..., None]
        rgb = rgb * (1 - e) + edge * e


# Ultramarine, bottom-left — the deep anchor the glass refracts against.
sweep(
    strokes=[
        (1.02, [0.16, 0.05], [0.60, 1.5], [2.1, 0.8], 0.30, 0.30, 0.28, 0.13, 28),
        (1.11, [0.20, 0.06], [0.56, 1.4], [2.4, 1.1], 0.32, 0.38, 0.55, 0.10, 18),
        (1.21, [0.24, 0.06], [0.53, 1.3], [2.0, 0.6], 0.34, 0.46, 0.95, 0.07, 11),
    ],
    stops=[NAVY * 0.70 + ULTRA * 0.30, ULTRA, ULTRA * 0.72 + VIOLET * 0.28],
    window=xwin(-0.35, 0.46, 0.26),
    edge=INDIGO,
)

# Gold, bottom-right — warm counterweight, the logo's second colour.
sweep(
    strokes=[
        (1.06, [0.15, 0.05], [0.54, 1.4], [5.0, 2.3], 0.34, 0.28, 0.26, 0.13, 28),
        (1.14, [0.19, 0.05], [0.51, 1.3], [5.3, 2.6], 0.36, 0.35, 0.52, 0.10, 18),
        (1.24, [0.22, 0.06], [0.49, 1.2], [4.8, 2.0], 0.38, 0.44, 0.93, 0.07, 11),
    ],
    stops=[VIOLET * 0.55 + GOLD * 0.45, GOLD, GOLD * 0.62 + GOLDLT * 0.38],
    window=xwin(0.54, 1.42, 0.26),
    edge=GOLDLT,
)

# One pale ultramarine ribbon crossing the middle, so the mid-frame is not empty
# — this is the band that keeps the mid-frame spread up where the glass needs it.
c = curve(0.62, [0.11, 0.033], [0.72, 1.8], [3.6, 1.2], 0.22)
band = gblur(ribbon(c, np.full(W, 0.19, np.float32), 0.16), 30) * 0.26
rgb = rgb * (1 - band[..., None]) + ULTRA * band[..., None]

# A gold filament through the upper third, lit — mid-frame contrast, cheaply.
c = curve(0.40, [0.09, 0.03], [0.82, 2.0], [4.2, 1.6], 0.16)
glow = thread(c, 0.0030) * xwin(0.10, 1.25, 0.30)
a = (gblur(glow, 2.0) * 0.55)[..., None]
rgb = rgb * (1 - a) + GOLD * a

save(rgb, "light-backdrop.webp")
