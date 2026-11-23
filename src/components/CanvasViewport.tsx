import React, { useEffect, useRef, useState } from 'react';
import {
  Eye,
  Grid,
  Maximize2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { EditorState, PixelMatrix } from '../types/editor';
import { renderMatrixToCanvas } from '../utils/pixelEngine';

interface CanvasViewportProps {
  matrix: PixelMatrix | null;
  state: EditorState;
  mosaicBgImage: HTMLImageElement | null;
  onChange: (patch: Partial<EditorState>) => void;
}

export function CanvasViewport({
  matrix,
  state,
  mosaicBgImage,
  onChange,
}: CanvasViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const [showPixelGrid, setShowPixelGrid] = useState(false);
  const [lightChecker, setLightChecker] = useState(false);
  const [peekOriginal, setPeekOriginal] = useState(false);

  const displayCellPx =
    state.pixelShape === 'square'
      ? Math.max(4, state.pixelSize)
      : Math.max(10, state.pixelSize * 2);

  // Render static frame OR smooth 60fps Motion animation loop
  useEffect(() => {
    if (!matrix || !canvasRef.current) return;
    const canvas = canvasRef.current;

    if (!state.motionEnabled || state.backgroundMode === 'transparent') {
      renderMatrixToCanvas(canvas, matrix, state, {
        cellPx: displayCellPx,
        includeBackground: state.backgroundMode !== 'transparent',
        showPixelGrid,
        mosaicBgImage,
        timeSec: 0,
      });
      return;
    }

    let rafId = 0;
    const startTime = performance.now();
    let lastDraw = 0;

    const frame = (now: number) => {
      // Cap at ~30fps for crisp retro pixel-motion feel & low CPU
      if (now - lastDraw >= 33) {
        lastDraw = now;
        renderMatrixToCanvas(canvas, matrix, state, {
          cellPx: displayCellPx,
          includeBackground: true,
          showPixelGrid,
          mosaicBgImage,
          timeSec: (now - startTime) / 1000,
        });
      }
      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [matrix, state, displayCellPx, showPixelGrid, mosaicBgImage]);

  const handleFitView = () => {
    if (!matrix || !containerRef.current) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const canvasW = matrix.cols * displayCellPx;
    const canvasH = matrix.rows * displayCellPx;
    const availW = Math.max(200, rect.width - 96);
    const availH = Math.max(200, rect.height - 120);
    const fitScale = Math.min(availW / canvasW, availH / canvasH, 2.5);
    setZoom(Number(Math.max(0.25, fitScale).toFixed(2)));
    setPan({ x: 0, y: 0 });
  };

  const hasAutoFittedRef = useRef(false);
  const prevAspectRatioRef = useRef(state.aspectRatio);
  useEffect(() => {
    if (!matrix) return;
    if (!hasAutoFittedRef.current) {
      hasAutoFittedRef.current = true;
      handleFitView();
      return;
    }
    if (prevAspectRatioRef.current !== state.aspectRatio) {
      prevAspectRatioRef.current = state.aspectRatio;
      handleFitView();
    }
  });

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setZoom((z) => Number(Math.min(12, Math.max(0.15, z * factor)).toFixed(2)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    setIsPanning(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: dragStartRef.current.panX + (e.clientX - dragStartRef.current.x),
      y: dragStartRef.current.panY + (e.clientY - dragStartRef.current.y),
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const canvasWidth = matrix ? matrix.cols * displayCellPx : 0;
  const canvasHeight = matrix ? matrix.rows * displayCellPx : 0;

  return (
    <main className="flex-1 relative bg-black flex flex-col overflow-hidden min-h-[360px]">
      {/* Subtle Top Info Bar inside Viewport */}
      <div className="h-10 shrink-0 px-4 border-b border-[#251E23] bg-[#060608] flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3 text-neutral-400 font-mono-tabular truncate">
          {matrix ? (
            <>
              <span>
                Grade: <strong className="text-white font-medium">{matrix.cols} × {matrix.rows}</strong> px
              </span>
              {state.aspectRatio !== 'auto' && (
                <>
                  <span aria-hidden="true" className="text-neutral-700">/</span>
                  <span>
                    Proporção: <strong className="text-[#FAD6EA] font-medium">{state.aspectRatio}</strong>
                  </span>
                </>
              )}
              <span aria-hidden="true" className="text-neutral-700">/</span>
              <span>
                Ativos: <strong className="text-white font-medium">{matrix.activeCount.toLocaleString('pt-BR')}</strong>
              </span>
              <span aria-hidden="true" className="text-neutral-700">/</span>
              <span>
                Limiar: <strong className="text-[#FAD6EA] font-medium">{state.threshold.toFixed(3)}</strong>
              </span>
            </>
          ) : (
            <span>Preparando matriz...</span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {state.backgroundMode !== 'transparent' && (
            <button
              type="button"
              onClick={() => onChange({ motionEnabled: !state.motionEnabled })}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                state.motionEnabled
                  ? 'bg-[#FAD6EA] border-[#FAD6EA] text-black font-semibold'
                  : 'bg-[#121216] border-[#26262C] text-neutral-300 hover:text-white'
              }`}
            >
              {state.motionEnabled ? (
                <Pause className="w-3 h-3" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              <span>Motion</span>
            </button>
          )}
          {state.backgroundMode === 'transparent' && (
            <button
              type="button"
              onClick={() => setLightChecker((v) => !v)}
              className="px-2.5 py-1 rounded text-[11px] font-medium bg-[#121216] border border-[#26262C] text-neutral-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              {lightChecker ? 'Fundo Escuro' : 'Fundo Claro'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowPixelGrid((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer whitespace-nowrap ${
              showPixelGrid
                ? 'bg-[#FAD6EA]/15 border-[#FAD6EA]/70 text-[#FAD6EA]'
                : 'bg-[#121216] border-[#26262C] text-neutral-300 hover:text-white'
            }`}
          >
            <Grid className="w-3 h-3" />
            <span>Grade</span>
          </button>
          <button
            type="button"
            onMouseDown={() => setPeekOriginal(true)}
            onMouseUp={() => setPeekOriginal(false)}
            onMouseLeave={() => setPeekOriginal(false)}
            onTouchStart={() => setPeekOriginal(true)}
            onTouchEnd={() => setPeekOriginal(false)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer whitespace-nowrap select-none ${
              peekOriginal
                ? 'bg-[#FAD6EA] border-[#FAD6EA] text-black font-semibold'
                : 'bg-[#121216] border-[#26262C] text-neutral-300 hover:text-white'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>Segurar p/ Original</span>
          </button>
        </div>
      </div>

      {/* Interactive Pan/Zoom Canvas Area */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`flex-1 relative overflow-hidden flex items-center justify-center select-none ${
          isPanning ? 'cursor-grabbing' : ''
        }`}
      >
        <span
          aria-hidden="true"
          className="absolute top-4 left-5 text-[#FAD6EA]/30 text-sm pointer-events-none select-none"
        >
          ✦
        </span>
        <span
          aria-hidden="true"
          className="absolute bottom-5 right-6 text-[#FAD6EA]/30 text-sm pointer-events-none select-none"
        >
          ✦
        </span>
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isPanning ? 'none' : 'transform 80ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="relative shadow-[0_24px_64px_rgba(0,0,0,0.65)] ring-1 ring-white/10"
        >
          {state.backgroundMode === 'transparent' && (
            <div
              className={`absolute inset-0 pointer-events-none ${
                lightChecker ? 'bg-checkerboard-light' : 'bg-checkerboard'
              }`}
            />
          )}

          <canvas
            ref={canvasRef}
            style={{
              width: canvasWidth,
              height: canvasHeight,
              imageRendering: state.pixelShape === 'square' ? 'pixelated' : 'auto',
              opacity: peekOriginal ? 0.12 : 1,
            }}
            className="block relative z-10"
          />

          {peekOriginal && (
            <div
              style={{
                width: canvasWidth,
                height: canvasHeight,
              }}
              className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none bg-black/75"
            >
              <div
                style={{
                  fontFamily: `"${state.fontFamily}", serif`,
                  fontWeight: state.fontWeight,
                  fontStyle: state.fontItalic ? 'italic' : 'normal',
                  fontSize: `${(state.fontSize / state.pixelSize) * displayCellPx}px`,
                  letterSpacing: `${(state.letterSpacing / state.pixelSize) * displayCellPx}px`,
                  lineHeight: state.lineHeight,
                  textAlign: state.textAlign,
                  color: state.color,
                  whiteSpace: 'pre',
                }}
              >
                {state.text}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Floating Zoom Controls */}
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#09090B]/95 border border-[#26262C] shadow-lg backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => setZoom((z) => Number(Math.max(0.15, z - 0.25).toFixed(2)))}
            aria-label="Diminuir zoom"
            className="p-1.5 rounded text-neutral-300 hover:text-white hover:bg-[#1A1A20] transition-colors cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="px-2 text-xs font-mono-tabular text-white min-w-[54px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Number(Math.min(12, z + 0.25).toFixed(2)))}
            aria-label="Aumentar zoom"
            className="p-1.5 rounded text-neutral-300 hover:text-white hover:bg-[#1A1A20] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-[#26262C] mx-1" />
          <button
            type="button"
            onClick={handleFitView}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-neutral-300 hover:text-white hover:bg-[#1A1A20] transition-colors cursor-pointer whitespace-nowrap"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Ajustar</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            aria-label="Resetar para 100%"
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-neutral-300 hover:text-white hover:bg-[#1A1A20] transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3 h-3" />
            <span>1:1</span>
          </button>
        </div>
      </div>
    </main>
  );
}
