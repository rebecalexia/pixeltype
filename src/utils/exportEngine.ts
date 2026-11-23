import { EditorState, PixelMatrix } from '../types/editor';
import { computeBackgroundGrid, renderMatrixToCanvas } from './pixelEngine';

interface MergedRect {
  x: number;
  y: number;
  w: number;
  h: number;
  alpha: number;
}

function mergeRectangles(
  cols: number,
  rows: number,
  getVal: (idx: number) => number
): MergedRect[] {
  const visited = new Uint8Array(cols * rows);
  const rects: MergedRect[] = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const startIdx = y * cols + x;
      if (visited[startIdx]) continue;
      const val = getVal(startIdx);
      if (val <= 0) continue;

      let w = 1;
      while (x + w < cols) {
        const idx = y * cols + (x + w);
        if (visited[idx] || Math.abs(getVal(idx) - val) > 0.001) break;
        w++;
      }

      let h = 1;
      outer: while (y + h < rows) {
        for (let dx = 0; dx < w; dx++) {
          const idx = (y + h) * cols + (x + dx);
          if (visited[idx] || Math.abs(getVal(idx) - val) > 0.001) {
            break outer;
          }
        }
        h++;
      }

      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) {
          visited[(y + dy) * cols + (x + dx)] = 1;
        }
      }

      rects.push({ x, y, w, h, alpha: val });
    }
  }

  return rects;
}

export interface SVGExportResult {
  svg: string;
  rawPixelCount: number;
  vectorPathCount: number;
  width: number;
  height: number;
}

export function generateSVG(
  matrix: PixelMatrix,
  state: EditorState,
  transparentBg: boolean,
  unitScale = 10,
  mosaicBgImage?: HTMLImageElement | null,
  timeSec = 0
): SVGExportResult {
  const width = matrix.cols * unitScale;
  const height = matrix.rows * unitScale;
  const parts: string[] = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" shape-rendering="crispEdges">`
  );

  const usesGradient = state.fillMode === 'gradient';
  if (usesGradient) {
    const rad = (state.gradientAngle * Math.PI) / 180;
    const x1 = (50 - Math.cos(rad) * 50).toFixed(2);
    const y1 = (50 - Math.sin(rad) * 50).toFixed(2);
    const x2 = (50 + Math.cos(rad) * 50).toFixed(2);
    const y2 = (50 + Math.sin(rad) * 50).toFixed(2);
    parts.push(
      `  <defs>`,
      `    <linearGradient id="pixeltype-grad" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%">`,
      `      <stop offset="0%" stop-color="${state.color}" />`,
      `      <stop offset="100%" stop-color="${state.gradientColorEnd}" />`,
      `    </linearGradient>`,
      `  </defs>`
    );
  }

  if (!transparentBg && state.backgroundMode !== 'transparent') {
    const hasSolidEffects =
      state.backgroundMode === 'solid' &&
      (state.bgGrain > 0 || state.bgTexture !== 'none');

    if (state.backgroundMode === 'solid' && !hasSolidEffects) {
      parts.push(
        `  <rect id="background" width="${width}" height="${height}" fill="${state.backgroundColor}" />`
      );
    } else {
      const bgGrid = computeBackgroundGrid(
        matrix.cols,
        matrix.rows,
        state,
        mosaicBgImage,
        timeSec
      );
      const cellW = width / bgGrid.bgCols;
      const cellH = height / bgGrid.bgRows;
      parts.push(`  <g id="mosaic-background">`);
      for (let by = 0; by < bgGrid.bgRows; by++) {
        let bx = 0;
        while (bx < bgGrid.bgCols) {
          const p0 = (by * bgGrid.bgCols + bx) * 4;
          const r = bgGrid.rgbaData[p0];
          const g = bgGrid.rgbaData[p0 + 1];
          const b = bgGrid.rgbaData[p0 + 2];
          let run = 1;
          while (bx + run < bgGrid.bgCols) {
            const pN = (by * bgGrid.bgCols + bx + run) * 4;
            if (
              bgGrid.rgbaData[pN] !== r ||
              bgGrid.rgbaData[pN + 1] !== g ||
              bgGrid.rgbaData[pN + 2] !== b
            ) {
              break;
            }
            run++;
          }
          const rx = Number((bx * cellW).toFixed(2));
          const ry = Number((by * cellH).toFixed(2));
          const rw = Number((run * cellW).toFixed(2));
          const rh = Number(cellH.toFixed(2));
          parts.push(
            `    <rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="rgb(${r},${g},${b})" />`
          );
          bx += run;
        }
      }
      parts.push(`  </g>`);
    }
  }

  let vectorPathCount = 0;
  const fgFill = usesGradient ? 'url(#pixeltype-grad)' : state.color;

  const emitPrimitive = (
    x: number,
    y: number,
    fill: string,
    alpha: number,
    target: string[]
  ) => {
    const gap = unitScale * state.pixelGap;
    const size = Number((unitScale - gap).toFixed(3));
    const px = Number((x * unitScale + gap / 2).toFixed(3));
    const py = Number((y * unitScale + gap / 2).toFixed(3));
    const opAttr = alpha < 0.999 ? ` fill-opacity="${alpha.toFixed(3)}"` : '';

    if (state.pixelShape === 'square') {
      target.push(
        `    <rect x="${px}" y="${py}" width="${size}" height="${size}" fill="${fill}"${opAttr} />`
      );
    } else if (state.pixelShape === 'rounded') {
      const rx = Number((size * 0.28).toFixed(3));
      target.push(
        `    <rect x="${px}" y="${py}" width="${size}" height="${size}" rx="${rx}" fill="${fill}"${opAttr} />`
      );
    } else if (state.pixelShape === 'led') {
      const cx = Number((px + size / 2).toFixed(3));
      const cy = Number((py + size / 2).toFixed(3));
      const r = Number((size * 0.42).toFixed(3));
      target.push(
        `    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${opAttr} />`
      );
    } else if (state.pixelShape === 'diamond') {
      const cx = Number((px + size / 2).toFixed(3));
      const cy = Number((py + size / 2).toFixed(3));
      const h = size / 2;
      const pts = `${cx},${Number((cy - h).toFixed(3))} ${Number((cx + h).toFixed(3))},${cy} ${cx},${Number((cy + h).toFixed(3))} ${Number((cx - h).toFixed(3))},${cy}`;
      target.push(
        `    <polygon points="${pts}" fill="${fill}"${opAttr} />`
      );
    }
  };

  if (state.effectMode !== 'none') {
    parts.push(`  <g id="pixel-effect">`);
    if (state.pixelShape === 'square' && state.pixelGap === 0) {
      const fxRects = mergeRectangles(
        matrix.cols,
        matrix.rows,
        (idx) => matrix.effectCells[idx]
      );
      if (fxRects.length > 0) {
        const d = fxRects
          .map(
            (r) =>
              `M${r.x * unitScale} ${r.y * unitScale}h${r.w * unitScale}v${r.h * unitScale}h-${r.w * unitScale}z`
          )
          .join('');
        parts.push(`    <path d="${d}" fill="${state.effectColor}" />`);
        vectorPathCount += fxRects.length;
      }
    } else {
      for (let y = 0; y < matrix.rows; y++) {
        for (let x = 0; x < matrix.cols; x++) {
          if (matrix.effectCells[y * matrix.cols + x]) {
            emitPrimitive(x, y, state.effectColor, 1, parts);
            vectorPathCount++;
          }
        }
      }
    }
    parts.push(`  </g>`);
  }

  parts.push(`  <g id="pixel-typography">`);
  if (state.pixelShape === 'square' && state.pixelGap === 0) {
    const merged = mergeRectangles(
      matrix.cols,
      matrix.rows,
      (idx) => matrix.cells[idx]
    );
    vectorPathCount += merged.length;

    const byAlpha = new Map<string, MergedRect[]>();
    for (const r of merged) {
      const key = r.alpha.toFixed(3);
      const list = byAlpha.get(key) || [];
      list.push(r);
      byAlpha.set(key, list);
    }

    for (const [alphaKey, group] of byAlpha.entries()) {
      const alphaNum = parseFloat(alphaKey);
      const opAttr = alphaNum < 0.999 ? ` fill-opacity="${alphaKey}"` : '';
      const d = group
        .map(
          (r) =>
            `M${r.x * unitScale} ${r.y * unitScale}h${r.w * unitScale}v${r.h * unitScale}h-${r.w * unitScale}z`
        )
        .join('');
      parts.push(`    <path d="${d}" fill="${fgFill}"${opAttr} />`);
    }
  } else {
    for (let y = 0; y < matrix.rows; y++) {
      for (let x = 0; x < matrix.cols; x++) {
        const a = matrix.cells[y * matrix.cols + x];
        if (a > 0) {
          emitPrimitive(x, y, fgFill, a, parts);
          vectorPathCount++;
        }
      }
    }
  }
  parts.push(`  </g>`);
  parts.push(`</svg>`);

  return {
    svg: parts.join('\n'),
    rawPixelCount: matrix.activeCount,
    vectorPathCount,
    width,
    height,
  };
}

export function sanitizeFileSlug(text: string): string {
  const clean = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return clean || 'pixeltype';
}

export async function exportPNG(
  matrix: PixelMatrix,
  state: EditorState,
  scale: number,
  transparentBg: boolean,
  mosaicBgImage?: HTMLImageElement | null,
  timeSec = 0
): Promise<void> {
  const canvas = document.createElement('canvas');
  renderMatrixToCanvas(canvas, matrix, state, {
    cellPx: scale,
    includeBackground: !transparentBg,
    showPixelGrid: false,
    mosaicBgImage,
    timeSec,
  });

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );
  if (!blob) throw new Error('Falha ao gerar PNG.');

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const slug = sanitizeFileSlug(state.text);
  link.href = url;
  link.download = `${slug}-${matrix.cols * scale}x${matrix.rows * scale}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function copyPNGToClipboard(
  matrix: PixelMatrix,
  state: EditorState,
  scale: number,
  transparentBg: boolean,
  mosaicBgImage?: HTMLImageElement | null,
  timeSec = 0
): Promise<void> {
  const canvas = document.createElement('canvas');
  renderMatrixToCanvas(canvas, matrix, state, {
    cellPx: scale,
    includeBackground: !transparentBg,
    showPixelGrid: false,
    mosaicBgImage,
    timeSec,
  });

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );
  if (!blob) throw new Error('Falha ao gerar imagem.');

  if (navigator.clipboard && 'write' in navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  } else {
    throw new Error('Seu navegador não suporta copiar imagens para a área de transferência.');
  }
}

export function downloadSVG(
  matrix: PixelMatrix,
  state: EditorState,
  transparentBg: boolean,
  mosaicBgImage?: HTMLImageElement | null,
  timeSec = 0
): void {
  const { svg } = generateSVG(matrix, state, transparentBg, 10, mosaicBgImage, timeSec);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const slug = sanitizeFileSlug(state.text);
  link.href = url;
  link.download = `${slug}-vetor.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportMotionWebM(
  matrix: PixelMatrix,
  state: EditorState,
  scale: number,
  mosaicBgImage?: HTMLImageElement | null,
  durationMs = 4000
): Promise<void> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Seu navegador não suporta gravação de vídeo WebM.');
  }

  const canvas = document.createElement('canvas');
  const forcedState: EditorState = {
    ...state,
    motionEnabled: true,
    backgroundMode: state.backgroundMode === 'transparent' ? 'solid' : state.backgroundMode,
  };

  renderMatrixToCanvas(canvas, matrix, forcedState, {
    cellPx: scale,
    includeBackground: true,
    showPixelGrid: false,
    mosaicBgImage,
    timeSec: 0,
  });

  const stream = canvas.captureStream(30);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 6_000_000,
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const stopped = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  recorder.start();
  const start = performance.now();

  await new Promise<void>((resolve) => {
    const tick = () => {
      const elapsed = performance.now() - start;
      renderMatrixToCanvas(canvas, matrix, forcedState, {
        cellPx: scale,
        includeBackground: true,
        showPixelGrid: false,
        mosaicBgImage,
        timeSec: elapsed / 1000,
      });
      if (elapsed < durationMs) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });

  recorder.stop();
  const blob = await stopped;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const slug = sanitizeFileSlug(state.text);
  link.href = url;
  link.download = `${slug}-motion.webm`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
