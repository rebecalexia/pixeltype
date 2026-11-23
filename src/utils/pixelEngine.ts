import { EditorState, PixelMatrix } from '../types/editor';

const BAYER_4X4 = [
  [0 / 16, 8 / 16, 2 / 16, 10 / 16],
  [12 / 16, 4 / 16, 14 / 16, 6 / 16],
  [3 / 16, 11 / 16, 1 / 16, 9 / 16],
  [15 / 16, 7 / 16, 13 / 16, 5 / 16],
];

function hash2D(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  const num = parseInt(clean.slice(0, 6), 16);
  if (Number.isNaN(num)) return [255, 255, 255];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function sampleThreeStopRgb(
  colorA: string,
  colorB: string,
  colorC: string,
  useThird: boolean,
  t: number
): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, t));
  const [r1, g1, b1] = hexToRgb(colorA);
  const [r2, g2, b2] = hexToRgb(colorB);

  if (!useThird) {
    return [
      r1 + (r2 - r1) * clamped,
      g1 + (g2 - g1) * clamped,
      b1 + (b2 - b1) * clamped,
    ];
  }

  const [r3, g3, b3] = hexToRgb(colorC);
  if (clamped < 0.5) {
    const u = clamped * 2;
    return [
      r1 + (r2 - r1) * u,
      g1 + (g2 - g1) * u,
      b1 + (b2 - b1) * u,
    ];
  }
  const u = (clamped - 0.5) * 2;
  return [
    r2 + (r3 - r2) * u,
    g2 + (g3 - g2) * u,
    b2 + (b3 - b2) * u,
  ];
}

function parseAspectRatio(preset: EditorState['aspectRatio']): number | null {
  switch (preset) {
    case '1:1':
      return 1;
    case '4:5':
      return 4 / 5;
    case '4:3':
      return 4 / 3;
    case '3:2':
      return 3 / 2;
    case '16:9':
      return 16 / 9;
    case '9:16':
      return 9 / 16;
    default:
      return null;
  }
}

export function rasterizeTextToMatrix(
  state: EditorState
): PixelMatrix {
  const oversample = 3;
  const rawText = state.text.length > 0 ? state.text : ' ';
  const lines = rawText.split('\n');
  const scaledFontSize = Math.max(12, state.fontSize * oversample);
  const fontSpec = `${state.fontItalic ? 'italic ' : ''}${state.fontWeight} ${scaledFontSize}px "${state.fontFamily}", serif`;

  const measureCanvas = document.createElement('canvas');
  const mCtx = measureCanvas.getContext('2d')!;
  mCtx.font = fontSpec;
  if ('letterSpacing' in mCtx) {
    (mCtx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${state.letterSpacing * oversample}px`;
  }

  let maxLineWidth = 0;
  for (const line of lines) {
    const metrics = mCtx.measureText(line || ' ');
    const left = Math.abs(metrics.actualBoundingBoxLeft || 0);
    const right = Math.abs(metrics.actualBoundingBoxRight || 0);
    const w = Math.max(metrics.width, left + right);
    if (w > maxLineWidth) maxLineWidth = w;
  }

  const lineStep = scaledFontSize * state.lineHeight;
  const marginX = Math.max(scaledFontSize * 1.4, 120);
  const marginY = Math.max(scaledFontSize * 1.1, 100);

  const canvasW = Math.min(4800, Math.max(200, Math.ceil(maxLineWidth + marginX * 2)));
  const canvasH = Math.min(
    4800,
    Math.max(200, Math.ceil(lines.length * lineStep + marginY * 2))
  );

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = canvasW;
  sourceCanvas.height = canvasH;
  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true })!;
  ctx.clearRect(0, 0, canvasW, canvasH);

  ctx.font = fontSpec;
  if ('letterSpacing' in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${state.letterSpacing * oversample}px`;
  }
  ctx.textBaseline = 'middle';
  ctx.textAlign = state.textAlign;

  const anchorX =
    state.textAlign === 'left'
      ? marginX
      : state.textAlign === 'right'
        ? canvasW - marginX
        : canvasW / 2;

  const totalBlockH = (lines.length - 1) * lineStep;
  const startY = canvasH / 2 - totalBlockH / 2;

  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#FFFFFF';

  lines.forEach((line, i) => {
    const y = startY + i * lineStep;
    if (state.preStroke > 0) {
      ctx.save();
      ctx.lineWidth = state.preStroke * 2 * oversample;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeText(line, anchorX, y);
      ctx.restore();
    }
    ctx.fillText(line, anchorX, y);
    if (state.preStroke < 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = Math.abs(state.preStroke) * 2 * oversample;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeText(line, anchorX, y);
      ctx.restore();
    }
  });

  const imgData = ctx.getImageData(0, 0, canvasW, canvasH);
  const data = imgData.data;

  let minX = canvasW;
  let minY = canvasH;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < canvasH; y++) {
    const rowOffset = y * canvasW * 4;
    for (let x = 0; x < canvasW; x++) {
      if (data[rowOffset + x * 4 + 3] > 2) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    minX = Math.floor(canvasW * 0.4);
    maxX = Math.floor(canvasW * 0.6);
    minY = Math.floor(canvasH * 0.4);
    maxY = Math.floor(canvasH * 0.6);
  }

  const inkW = maxX - minX + 1;
  const inkH = maxY - minY + 1;

  const cellSrcSize = Math.max(1, state.pixelSize * oversample);
  const inkCols = Math.max(1, Math.ceil(inkW / cellSrcSize));
  const inkRows = Math.max(1, Math.ceil(inkH / cellSrcSize));

  const pad = Math.max(0, Math.round(state.padding));
  const cols = inkCols + pad * 2;
  const rows = inkRows + pad * 2;

  const offsetX = minX - Math.floor((inkCols * cellSrcSize - inkW) / 2);
  const offsetY = minY - Math.floor((inkRows * cellSrcSize - inkH) / 2);

  const rawCoverage = new Float32Array(cols * rows);

  for (let gy = 0; gy < inkRows; gy++) {
    const sy0 = Math.max(0, Math.floor(offsetY + gy * cellSrcSize));
    const sy1 = Math.min(canvasH, Math.ceil(offsetY + (gy + 1) * cellSrcSize));

    for (let gx = 0; gx < inkCols; gx++) {
      const sx0 = Math.max(0, Math.floor(offsetX + gx * cellSrcSize));
      const sx1 = Math.min(canvasW, Math.ceil(offsetX + (gx + 1) * cellSrcSize));

      let sum = 0;
      let count = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        const rowOff = sy * canvasW * 4;
        for (let sx = sx0; sx < sx1; sx++) {
          sum += data[rowOff + sx * 4 + 3];
          count++;
        }
      }

      const avg = count > 0 ? sum / (count * 255) : 0;
      rawCoverage[(gy + pad) * cols + (gx + pad)] = avg;
    }
  }

  const cells = new Float32Array(cols * rows);
  const thr = state.threshold;

  if (state.quantizationMode === 'threshold') {
    for (let i = 0; i < rawCoverage.length; i++) {
      cells[i] = rawCoverage[i] >= thr ? 1 : 0;
    }
  } else if (state.quantizationMode === 'levels') {
    const steps = Math.max(2, state.levelsCount);
    const floorCutoff = thr * 0.25;
    for (let i = 0; i < rawCoverage.length; i++) {
      const v = rawCoverage[i];
      if (v < floorCutoff) {
        cells[i] = 0;
      } else {
        const q = Math.round(v * steps) / steps;
        cells[i] = Math.min(1, Math.max(0, q));
      }
    }
  } else if (state.quantizationMode === 'bayer4') {
    const bias = (0.5 - thr) * 0.85;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const v = rawCoverage[y * cols + x];
        if (v <= 0.01) {
          cells[y * cols + x] = 0;
        } else {
          const bayerVal = BAYER_4X4[y % 4][x % 4];
          cells[y * cols + x] = v + bias > bayerVal ? 1 : 0;
        }
      }
    }
  } else if (state.quantizationMode === 'floyd') {
    const buf = new Float32Array(rawCoverage);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = y * cols + x;
        const oldVal = buf[idx];
        const newVal = oldVal >= thr ? 1 : 0;
        cells[idx] = newVal;
        const err = oldVal - newVal;
        if (x + 1 < cols) buf[idx + 1] += err * (7 / 16);
        if (y + 1 < rows) {
          if (x - 1 >= 0) buf[(y + 1) * cols + x - 1] += err * (3 / 16);
          buf[(y + 1) * cols + x] += err * (5 / 16);
          if (x + 1 < cols) buf[(y + 1) * cols + x + 1] += err * (1 / 16);
        }
      }
    }
  }

  // Optional Typography Grain (pixel-level stochastic dropout)
  if (state.textGrain > 0) {
    const dropProb = (state.textGrain / 100) * 0.45;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = y * cols + x;
        if (cells[idx] > 0) {
          const n = hash2D(x, y, state.mosaicSeed + 91);
          if (n < dropProb) {
            cells[idx] = 0;
          }
        }
      }
    }
  }

  let finalCols = cols;
  let finalRows = rows;
  let finalCells = cells;

  const targetRatio = parseAspectRatio(state.aspectRatio);
  if (targetRatio !== null) {
    if (cols / rows < targetRatio) {
      finalCols = Math.max(cols, Math.round(rows * targetRatio));
      finalRows = rows;
    } else {
      finalRows = Math.max(rows, Math.round(cols / targetRatio));
      finalCols = cols;
    }

    if (finalCols !== cols || finalRows !== rows) {
      const expanded = new Float32Array(finalCols * finalRows);
      const offX = Math.floor((finalCols - cols) / 2);
      const offY = Math.floor((finalRows - rows) / 2);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          expanded[(y + offY) * finalCols + (x + offX)] = cells[y * cols + x];
        }
      }
      finalCells = expanded;
    }
  }

  let activeCount = 0;
  for (let i = 0; i < finalCells.length; i++) {
    if (finalCells[i] > 0) activeCount++;
  }

  const effectCells = new Uint8Array(finalCols * finalRows);
  if (state.effectMode === 'shadow') {
    for (let y = 1; y < finalRows; y++) {
      for (let x = 1; x < finalCols; x++) {
        const idx = y * finalCols + x;
        if (finalCells[idx] === 0 && finalCells[(y - 1) * finalCols + (x - 1)] > 0) {
          effectCells[idx] = 1;
        }
      }
    }
  } else if (state.effectMode === 'outline') {
    for (let y = 0; y < finalRows; y++) {
      for (let x = 0; x < finalCols; x++) {
        const idx = y * finalCols + x;
        if (finalCells[idx] > 0) continue;
        const hasNeighbor =
          (x > 0 && finalCells[y * finalCols + (x - 1)] > 0) ||
          (x < finalCols - 1 && finalCells[y * finalCols + (x + 1)] > 0) ||
          (y > 0 && finalCells[(y - 1) * finalCols + x] > 0) ||
          (y < finalRows - 1 && finalCells[(y + 1) * finalCols + x] > 0);
        if (hasNeighbor) {
          effectCells[idx] = 1;
        }
      }
    }
  }

  return {
    cols: finalCols,
    rows: finalRows,
    cells: finalCells,
    effectCells,
    activeCount,
    sourceCanvas,
  };
}

export interface BackgroundGrid {
  bgCols: number;
  bgRows: number;
  blockRatio: number;
  rgbaData: Uint8ClampedArray;
}

let cachedBgCanvas: HTMLCanvasElement | null = null;

function blendChannel(base: number, blend: number, mode: EditorState['bgBlendMode']): number {
  const a = base / 255;
  const b = blend / 255;
  if (mode === 'multiply') return a * b * 255;
  if (mode === 'screen') return (1 - (1 - a) * (1 - b)) * 255;
  if (mode === 'overlay') {
    return (a < 0.5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b)) * 255;
  }
  return blend;
}

export function computeBackgroundGrid(
  matrixCols: number,
  matrixRows: number,
  state: EditorState,
  mosaicBgImage?: HTMLImageElement | null,
  timeSec = 0
): BackgroundGrid {
  const isSolid = state.backgroundMode === 'solid';
  const hasImage =
    !isSolid &&
    Boolean(
      mosaicBgImage && mosaicBgImage.complete && mosaicBgImage.naturalWidth > 0
    );
  const rawRatio = Math.max(0.25, Math.min(8, state.mosaicBlockRatio));
  const blockRatio = !isSolid ? rawRatio : Math.min(1, rawRatio);

  const rawCols = Math.max(1, Math.ceil(matrixCols / blockRatio));
  const rawRows = Math.max(1, Math.ceil(matrixRows / blockRatio));
  const maxDim = 640;
  const downScale = Math.max(1, rawCols / maxDim, rawRows / maxDim);
  const bgCols = Math.max(1, Math.round(rawCols / downScale));
  const bgRows = Math.max(1, Math.round(rawRows / downScale));
  const rgbaData = new Uint8ClampedArray(bgCols * bgRows * 4);

  const animTime = state.motionEnabled ? timeSec * state.motionSpeed : 0;

  let focalX = state.mosaicPosX;
  let focalY = state.mosaicPosY;
  let angleDeg = state.mosaicAngle;
  let scale = state.mosaicScale;
  let grainFrameSeed = state.mosaicSeed;

  if (state.motionEnabled) {
    if (state.motionMode === 'drift') {
      focalX += Math.sin(animTime * 0.9) * 0.14;
      focalY += Math.cos(animTime * 0.7) * 0.12;
    } else if (state.motionMode === 'pulse') {
      scale *= 1 + Math.sin(animTime * 2.1) * 0.25;
    } else if (state.motionMode === 'rotate') {
      angleDeg = (angleDeg + animTime * 45) % 360;
    } else if (state.motionMode === 'flicker') {
      grainFrameSeed += Math.floor(animTime * 14);
      focalX += Math.sin(animTime * 1.4) * 0.05;
    }
  }

  let imgPixels: Uint8ClampedArray | null = null;
  if (hasImage && mosaicBgImage) {
    const mCanvas = document.createElement('canvas');
    mCanvas.width = bgCols;
    mCanvas.height = bgRows;
    const bgCtx = mCanvas.getContext('2d')!;
    bgCtx.clearRect(0, 0, bgCols, bgRows);

    const natW = mosaicBgImage.naturalWidth;
    const natH = mosaicBgImage.naturalHeight;
    const baseScale =
      state.bgImageFit === 'contain'
        ? Math.min(bgCols / natW, bgRows / natH)
        : Math.max(bgCols / natW, bgRows / natH);
    const userScale = Math.max(0.05, Math.min(5, state.bgImageScale));
    const drawW = natW * baseScale * userScale;
    const drawH = natH * baseScale * userScale;
    const dx = (bgCols - drawW) / 2 + (state.bgImageOffsetX / 100) * (bgCols * 0.5);
    const dy = (bgRows - drawH) / 2 + (state.bgImageOffsetY / 100) * (bgRows * 0.5);

    bgCtx.drawImage(mosaicBgImage, 0, 0, natW, natH, dx, dy, drawW, drawH);
    imgPixels = bgCtx.getImageData(0, 0, bgCols, bgRows).data;
  }

  const rad = (angleDeg * Math.PI) / 180;
  const dirX = Math.cos(rad);
  const dirY = Math.sin(rad);
  const phase = state.mosaicSeed * 1.37 + animTime * 0.65;
  const grainStrength = (state.bgGrain / 100) * 95;
  const texStrength = state.bgTextureIntensity / 100;
  const [solidR, solidG, solidB] = hexToRgb(state.backgroundColor);

  const imgBright = (state.bgImageBrightness / 100) * 255;
  const imgContrast = state.bgImageContrast;
  const imgLevels = state.bgImageLevels;
  const gradMix = Math.max(0, Math.min(1, state.bgGradientMix / 100));

  for (let by = 0; by < bgRows; by++) {
    const ny = bgRows > 1 ? by / (bgRows - 1) : 0.5;
    for (let bx = 0; bx < bgCols; bx++) {
      const nx = bgCols > 1 ? bx / (bgCols - 1) : 0.5;
      const idx = by * bgCols + bx;

      let r = solidR;
      let g = solidG;
      let b = solidB;

      if (!isSolid) {
        // Compute spatial gradient value t and gradient RGB
        let t = 0;
        const dx = (nx - focalX) / Math.max(0.25, scale);
        const dy = (ny - focalY) / Math.max(0.25, scale);

        if (state.mosaicGradientType === 'radial') {
          t = Math.min(1, Math.hypot(dx * 1.4, dy * 1.4));
        } else if (state.mosaicGradientType === 'linear') {
          const proj = (nx - focalX) * dirX + (ny - focalY) * dirY;
          t = Math.max(0, Math.min(1, 0.5 + proj / Math.max(0.25, scale)));
        } else if (state.mosaicGradientType === 'conic') {
          const ang = Math.atan2(dy, dx) - rad;
          t = (Math.sin(ang * 2) + 1) * 0.5;
        } else {
          const radial = Math.min(1, Math.hypot(dx * 1.45, dy * 1.35));
          const wave =
            0.15 * Math.sin(nx * 4.2 + phase) * Math.cos(ny * 3.1 - phase * 0.6) +
            0.12 * Math.cos((nx - ny) * 3.5 + phase * 0.8);
          const cornerGlow =
            Math.max(0, 1 - Math.hypot(nx - (1 - focalX * 0.25), ny - 0.1) * 2.1) * 0.38 +
            Math.max(0, 1 - Math.hypot(nx - 0.1, ny - (1 - focalY * 0.3)) * 2.3) * 0.28;
          t = Math.max(0, Math.min(1, radial * 0.72 + wave + cornerGlow));
        }

        const [gr, gg, gb] = sampleThreeStopRgb(
          state.mosaicColorA,
          state.mosaicColorB,
          state.mosaicColorC,
          state.mosaicUseThirdColor,
          t
        );

        if (imgPixels) {
          const imgAlpha = imgPixels[idx * 4 + 3] / 255;
          const backdropR =
            state.backgroundMode === 'mosaic'
              ? gr
              : solidR * (1 - gradMix) + gr * gradMix;
          const backdropG =
            state.backgroundMode === 'mosaic'
              ? gg
              : solidG * (1 - gradMix) + gg * gradMix;
          const backdropB =
            state.backgroundMode === 'mosaic'
              ? gb
              : solidB * (1 - gradMix) + gb * gradMix;

          if (imgAlpha <= 0) {
            r = backdropR;
            g = backdropG;
            b = backdropB;
          } else {
            let ir = imgPixels[idx * 4];
            let ig = imgPixels[idx * 4 + 1];
            let ib = imgPixels[idx * 4 + 2];

            // Image pixel adjustments: brightness & contrast
            ir = (ir - 128) * imgContrast + 128 + imgBright;
            ig = (ig - 128) * imgContrast + 128 + imgBright;
            ib = (ib - 128) * imgContrast + 128 + imgBright;

            if (state.bgImageGrayscale) {
              const lum = 0.299 * ir + 0.587 * ig + 0.114 * ib;
              ir = lum;
              ig = lum;
              ib = lum;
            }

            // Posterize / quantize pixel color levels
            if (imgLevels >= 2) {
              const step = 255 / (imgLevels - 1);
              ir = Math.round(clampByte(ir) / step) * step;
              ig = Math.round(clampByte(ig) / step) * step;
              ib = Math.round(clampByte(ib) / step) * step;
            } else {
              ir = clampByte(ir);
              ig = clampByte(ig);
              ib = clampByte(ib);
            }

            let outR = ir;
            let outG = ig;
            let outB = ib;

            if (gradMix > 0) {
              if (state.bgBlendMode === 'duotone') {
                const lum = Math.max(
                  0,
                  Math.min(1, (0.299 * ir + 0.587 * ig + 0.114 * ib) / 255)
                );
                const mixedT = Math.max(0, Math.min(1, lum * 0.72 + t * 0.28));
                const [dr, dg, db] = sampleThreeStopRgb(
                  state.mosaicColorA,
                  state.mosaicColorB,
                  state.mosaicColorC,
                  state.mosaicUseThirdColor,
                  mixedT
                );
                outR = ir * (1 - gradMix) + dr * gradMix;
                outG = ig * (1 - gradMix) + dg * gradMix;
                outB = ib * (1 - gradMix) + db * gradMix;
              } else {
                const br = blendChannel(ir, gr, state.bgBlendMode);
                const bg = blendChannel(ig, gg, state.bgBlendMode);
                const bb = blendChannel(ib, gb, state.bgBlendMode);
                outR = ir * (1 - gradMix) + br * gradMix;
                outG = ig * (1 - gradMix) + bg * gradMix;
                outB = ib * (1 - gradMix) + bb * gradMix;
              }
            }

            r = backdropR * (1 - imgAlpha) + outR * imgAlpha;
            g = backdropG * (1 - imgAlpha) + outG * imgAlpha;
            b = backdropB * (1 - imgAlpha) + outB * imgAlpha;
          }
        } else {
          r = gr;
          g = gg;
          b = gb;
        }
      }

      if (state.bgTexture === 'bayer') {
        const bayerVal = BAYER_4X4[by % 4][bx % 4] - 0.5;
        const delta = bayerVal * texStrength * 110;
        r += delta;
        g += delta;
        b += delta;
      } else if (state.bgTexture === 'scanlines') {
        if (by % 2 === 1) {
          const factor = 1 - texStrength * 0.65;
          r *= factor;
          g *= factor;
          b *= factor;
        }
      } else if (state.bgTexture === 'grid') {
        if (bx % 3 === 0 || by % 3 === 0) {
          const delta = texStrength * 48;
          r += delta;
          g += delta;
          b += delta;
        }
      }

      if (grainStrength > 0) {
        const noise = (hash2D(bx, by, grainFrameSeed) - 0.5) * 2 * grainStrength;
        r += noise;
        g += noise;
        b += noise;
      }

      const p = idx * 4;
      rgbaData[p] = clampByte(r);
      rgbaData[p + 1] = clampByte(g);
      rgbaData[p + 2] = clampByte(b);
      rgbaData[p + 3] = 255;
    }
  }

  return {
    bgCols,
    bgRows,
    blockRatio: matrixCols / bgCols,
    rgbaData,
  };
}

export interface RenderOptions {
  cellPx: number;
  includeBackground: boolean;
  showPixelGrid?: boolean;
  mosaicBgImage?: HTMLImageElement | null;
  timeSec?: number;
}

export function drawPixelCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  shape: EditorState['pixelShape'],
  gapFraction: number
): void {
  const gap = size * gapFraction;
  const drawSize = Math.max(0.5, size - gap);
  const offset = gap / 2;
  const px = x + offset;
  const py = y + offset;

  if (shape === 'square') {
    ctx.fillRect(px, py, drawSize, drawSize);
  } else if (shape === 'rounded') {
    const r = drawSize * 0.28;
    ctx.beginPath();
    ctx.roundRect(px, py, drawSize, drawSize, r);
    ctx.fill();
  } else if (shape === 'led') {
    const cx = px + drawSize / 2;
    const cy = py + drawSize / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, drawSize * 0.42, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === 'diamond') {
    const cx = px + drawSize / 2;
    const cy = py + drawSize / 2;
    const half = drawSize / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - half);
    ctx.lineTo(cx + half, cy);
    ctx.lineTo(cx, cy + half);
    ctx.lineTo(cx - half, cy);
    ctx.closePath();
    ctx.fill();
  }
}

export function renderMatrixToCanvas(
  canvas: HTMLCanvasElement,
  matrix: PixelMatrix,
  state: EditorState,
  options: RenderOptions
): void {
  const {
    cellPx,
    includeBackground,
    showPixelGrid = false,
    mosaicBgImage = null,
    timeSec = 0,
  } = options;
  const width = Math.max(1, Math.round(matrix.cols * cellPx));
  const height = Math.max(1, Math.round(matrix.rows * cellPx));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, width, height);

  // 1. Optional Background (Solid, Solid + Grain/Texture, or Manipulable Mosaic)
  if (includeBackground && state.backgroundMode !== 'transparent') {
    const hasSolidEffects =
      state.backgroundMode === 'solid' &&
      (state.bgGrain > 0 || state.bgTexture !== 'none');

    if (state.backgroundMode === 'solid' && !hasSolidEffects) {
      ctx.fillStyle = state.backgroundColor;
      ctx.fillRect(0, 0, width, height);
    } else {
      const bgGrid = computeBackgroundGrid(
        matrix.cols,
        matrix.rows,
        state,
        mosaicBgImage,
        timeSec
      );
      if (!cachedBgCanvas) {
        cachedBgCanvas = document.createElement('canvas');
      }
      if (
        cachedBgCanvas.width !== bgGrid.bgCols ||
        cachedBgCanvas.height !== bgGrid.bgRows
      ) {
        cachedBgCanvas.width = bgGrid.bgCols;
        cachedBgCanvas.height = bgGrid.bgRows;
      }
      const bgCtx = cachedBgCanvas.getContext('2d')!;
      const imgData = new ImageData(
        new Uint8ClampedArray(bgGrid.rgbaData),
        bgGrid.bgCols,
        bgGrid.bgRows
      );
      bgCtx.putImageData(imgData, 0, 0);

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        cachedBgCanvas,
        0,
        0,
        bgGrid.bgCols,
        bgGrid.bgRows,
        0,
        0,
        width,
        height
      );
      ctx.restore();
    }
  }

  // 2. Effect Layer (Shadow / Outline)
  if (state.effectMode !== 'none') {
    ctx.fillStyle = state.effectColor;
    for (let y = 0; y < matrix.rows; y++) {
      for (let x = 0; x < matrix.cols; x++) {
        if (matrix.effectCells[y * matrix.cols + x]) {
          drawPixelCell(
            ctx,
            x * cellPx,
            y * cellPx,
            cellPx,
            state.pixelShape,
            state.pixelGap
          );
        }
      }
    }
  }

  // 3. Foreground Pixel Typography Layer
  let fillStyle: string | CanvasGradient = state.color;
  if (state.fillMode === 'gradient') {
    const rad = (state.gradientAngle * Math.PI) / 180;
    const cx = width / 2;
    const cy = height / 2;
    const halfDiag = Math.hypot(width, height) / 2;
    const dx = Math.cos(rad) * halfDiag;
    const dy = Math.sin(rad) * halfDiag;
    const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    grad.addColorStop(0, state.color);
    grad.addColorStop(1, state.gradientColorEnd);
    fillStyle = grad;
  }

  ctx.fillStyle = fillStyle;
  for (let y = 0; y < matrix.rows; y++) {
    for (let x = 0; x < matrix.cols; x++) {
      const alpha = matrix.cells[y * matrix.cols + x];
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      drawPixelCell(
        ctx,
        x * cellPx,
        y * cellPx,
        cellPx,
        state.pixelShape,
        state.pixelGap
      );
    }
  }
  ctx.globalAlpha = 1;

  // 4. Optional Pixel Grid Overlay (Viewport Aid Only)
  if (showPixelGrid && cellPx >= 4) {
    ctx.save();
    ctx.strokeStyle =
      state.backgroundMode === 'solid' && state.backgroundColor.toLowerCase() === '#ffffff'
        ? 'rgba(0, 0, 0, 0.12)'
        : 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= matrix.cols; x++) {
      const px = Math.round(x * cellPx) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
    }
    for (let y = 0; y <= matrix.rows; y++) {
      const py = Math.round(y * cellPx) + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
    }
    ctx.stroke();
    ctx.restore();
  }
}
