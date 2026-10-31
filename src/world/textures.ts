import * as THREE from 'three';

/* ---------------------------------------------------------------- value noise */
function hash(x: number, y: number, seed = 0): number {
  let h = x * 374761393 + y * 668265263 + seed * 1442695040888963407;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(t: number) { return t * t * (3 - 2 * t); }

function valueNoise(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  const u = smooth(xf), v = smooth(yf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export function fbm(x: number, y: number, octaves = 5, seed = 0): number {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 31);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

/* ---------------------------------------------------------------- canvas helpers */
const SIZE = 512;

function canvas(draw: (ctx: CanvasRenderingContext2D, s: number) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d')!;
  draw(ctx, SIZE);
  return c;
}

export interface SurfaceMaps {
  albedo: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
}

function toTexture(c: HTMLCanvasElement, repeat: number, srgb: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Procedural concrete: broad patches + fine aggregate + subtle normal relief. */
export function makeConcrete(opts: {
  base?: [number, number, number];
  contrast?: number;
  rough?: [number, number];
  repeat?: number;
  grain?: number;
} = {}): SurfaceMaps {
  const { base = [0.33, 0.325, 0.315], contrast = 0.35, rough = [0.72, 0.95], repeat = 3, grain = 1 } = opts;

  const albedoCanvas = canvas((ctx, s) => {
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const u = x / s, v = y / s;
        const patch = fbm(u * 3.2, v * 3.2, 4, 11);
        const fine = fbm(u * 46, v * 46, 3, 23) * grain;
        const speck = valueNoise(u * 190, v * 190, 71) * 0.06 * grain;
        let k = 1 + (patch - 0.5) * contrast + (fine - 0.5) * 0.32 * grain + (speck - 0.03);
        k = Math.min(1.5, Math.max(0.35, k));
        const i = (y * s + x) * 4;
        img.data[i] = Math.min(255, base[0] * k * 255);
        img.data[i + 1] = Math.min(255, base[1] * k * 255);
        img.data[i + 2] = Math.min(255, base[2] * k * 255);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  const heightData = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE, v = y / SIZE;
      heightData[y * SIZE + x] =
        fbm(u * 30, v * 30, 4, 5) * 0.6 + fbm(u * 120, v * 120, 2, 9) * 0.4;
    }
  }

  const normalCanvas = canvas((ctx, s) => {
    const img = ctx.createImageData(s, s);
    const strength = 2.4;
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const xl = heightData[y * s + ((x - 1 + s) % s)];
        const xr = heightData[y * s + ((x + 1) % s)];
        const yl = heightData[((y - 1 + s) % s) * s + x];
        const yr = heightData[((y + 1) % s) * s + x];
        let nx = (xl - xr) * strength, ny = (yl - yr) * strength, nz = 1;
        const len = Math.hypot(nx, ny, nz);
        nx /= len; ny /= len; nz /= len;
        const i = (y * s + x) * 4;
        img.data[i] = (nx * 0.5 + 0.5) * 255;
        img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
        img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  const roughCanvas = canvas((ctx, s) => {
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const u = x / s, v = y / s;
        const n = fbm(u * 8, v * 8, 4, 3) * 0.7 + fbm(u * 64, v * 64, 2, 17) * 0.3;
        const r = rough[0] + (rough[1] - rough[0]) * n;
        const i = (y * s + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = r * 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });

  return {
    albedo: toTexture(albedoCanvas, repeat, true),
    roughness: toTexture(roughCanvas, repeat, false),
    normal: toTexture(normalCanvas, repeat, false),
  };
}

/** Brushed / cast metal roughness variation. */
export function makeBrushRoughness(min: number, max: number, stretch = 40): THREE.CanvasTexture {
  const c = canvas((ctx, s) => {
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const u = x / s, v = y / s;
        const n = fbm(u * stretch, v * 6, 3, 41);
        const r = min + (max - min) * n;
        const i = (y * s + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = r * 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Etched floor plate text / markings, drawn into an alpha map. */
export function makeMarkingTexture(draw: (ctx: CanvasRenderingContext2D, s: number) => void): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas(draw));
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
