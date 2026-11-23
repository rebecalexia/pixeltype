import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, FileCode2, Film, Loader2, X } from 'lucide-react';
import { EditorState, PixelMatrix } from '../types/editor';
import {
  copyPNGToClipboard,
  downloadSVG,
  exportMotionWebM,
  exportPNG,
  generateSVG,
} from '../utils/exportEngine';
import { renderMatrixToCanvas } from '../utils/pixelEngine';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  matrix: PixelMatrix | null;
  state: EditorState;
  mosaicBgImage: HTMLImageElement | null;
  onChange: (patch: Partial<EditorState>) => void;
}

const PNG_SCALES = [1, 4, 8, 12, 16];

export function ExportModal({
  isOpen,
  onClose,
  matrix,
  state,
  mosaicBgImage,
  onChange,
}: ExportModalProps) {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [copiedType, setCopiedType] = useState<'png' | 'svg' | null>(null);
  const [isRecordingMotion, setIsRecordingMotion] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const svgInfo = useMemo(() => {
    if (!isOpen || !matrix) return null;
    return generateSVG(
      matrix,
      state,
      state.exportTransparent,
      10,
      mosaicBgImage,
      0
    );
  }, [isOpen, matrix, state, mosaicBgImage]);

  useEffect(() => {
    if (!isOpen || !matrix || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const previewCell = state.pixelShape === 'square' ? 4 : 8;

    if (!state.motionEnabled || state.exportTransparent || state.backgroundMode === 'transparent') {
      renderMatrixToCanvas(canvas, matrix, state, {
        cellPx: previewCell,
        includeBackground: !state.exportTransparent,
        showPixelGrid: false,
        mosaicBgImage,
        timeSec: 0,
      });
      return;
    }

    let rafId = 0;
    const start = performance.now();
    let lastDraw = 0;

    const tick = (now: number) => {
      if (now - lastDraw >= 33) {
        lastDraw = now;
        renderMatrixToCanvas(canvas, matrix, state, {
          cellPx: previewCell,
          includeBackground: true,
          showPixelGrid: false,
          mosaicBgImage,
          timeSec: (now - start) / 1000,
        });
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isOpen, matrix, state, mosaicBgImage]);

  if (!isOpen || !matrix) return null;

  const outWidth = matrix.cols * state.exportScale;
  const outHeight = matrix.rows * state.exportScale;

  const handleCopySVG = async () => {
    if (!svgInfo) return;
    setErrorMsg(null);
    try {
      await navigator.clipboard.writeText(svgInfo.svg);
      setCopiedType('svg');
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      setErrorMsg('Não foi possível copiar o código SVG.');
    }
  };

  const handleCopyPNG = async () => {
    setErrorMsg(null);
    try {
      await copyPNGToClipboard(
        matrix,
        state,
        state.exportScale,
        state.exportTransparent,
        mosaicBgImage
      );
      setCopiedType('png');
      setTimeout(() => setCopiedType(null), 2000);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Falha ao copiar PNG.'
      );
    }
  };

  const handleExportMotion = async () => {
    setErrorMsg(null);
    setIsRecordingMotion(true);
    try {
      await exportMotionWebM(
        matrix,
        state,
        Math.min(8, Math.max(2, state.exportScale)),
        mosaicBgImage,
        4000
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Falha ao gravar vídeo Motion.'
      );
    } finally {
      setIsRecordingMotion(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-lg border border-[#26262C] bg-[#09090B] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#202026]">
          <div>
            <h2
              id="export-modal-title"
              className="font-display text-base font-semibold text-white"
            >
              Exportar Tipografia
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              PNG transparente, vetor SVG editável ou vídeo Motion
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de exportação"
            className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-[#18181D] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Preview Box */}
          <div className="relative h-44 rounded-md border border-[#222228] overflow-hidden flex items-center justify-center p-4 bg-black">
            {state.exportTransparent && (
              <div className="absolute inset-0 bg-checkerboard opacity-90" />
            )}
            <canvas
              ref={previewCanvasRef}
              style={{
                imageRendering:
                  state.pixelShape === 'square' ? 'pixelated' : 'auto',
              }}
              className="relative z-10 max-w-full max-h-full object-contain"
            />
          </div>

          {/* Transparency Switch */}
          <label className="flex items-center justify-between p-3 rounded-md bg-[#111115] border border-[#222228] cursor-pointer select-none">
            <div>
              <div className="text-xs font-medium text-white">
                Fundo Transparente
              </div>
              <div className="text-[11px] text-neutral-400">
                Remove a camada de fundo tanto no PNG quanto no vetor SVG
              </div>
            </div>
            <input
              type="checkbox"
              checked={state.exportTransparent}
              onChange={(e) =>
                onChange({ exportTransparent: e.target.checked })
              }
              className="w-4 h-4 rounded border-[#33333A] bg-black accent-[#FAD6EA] cursor-pointer"
            />
          </label>

          {/* Two Column Export Options: PNG vs SVG */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* PNG Card */}
            <div className="p-3.5 rounded-md border border-[#222228] bg-[#111115] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">
                  Imagem PNG
                </span>
                <span className="text-[11px] font-mono-tabular text-neutral-400">
                  {outWidth} × {outHeight} px
                </span>
              </div>

              <div className="space-y-1.5">
                <span className="block text-[11px] text-neutral-400">
                  Escala de Resolução
                </span>
                <div className="grid grid-cols-5 gap-1">
                  {PNG_SCALES.map((sc) => (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => onChange({ exportScale: sc })}
                      className={`py-1 text-xs font-mono-tabular rounded border transition-colors cursor-pointer ${
                        state.exportScale === sc
                          ? 'bg-[#FAD6EA] border-[#FAD6EA] text-black font-semibold'
                          : 'bg-black border-[#26262C] text-neutral-300 hover:text-white'
                      }`}
                    >
                      {sc}×
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    exportPNG(
                      matrix,
                      state,
                      state.exportScale,
                      state.exportTransparent,
                      mosaicBgImage
                    )
                  }
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-white text-black hover:bg-neutral-200 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar PNG</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyPNG}
                  title="Copiar PNG para área de transferência"
                  className="px-2.5 py-2 rounded-md bg-[#1C1C22] hover:bg-[#26262E] text-white text-xs transition-colors cursor-pointer"
                >
                  {copiedType === 'png' ? (
                    <Check className="w-3.5 h-3.5 text-[#FAD6EA]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* SVG Card */}
            <div className="p-3.5 rounded-md border border-[#222228] bg-[#111115] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">
                  Vetor SVG
                </span>
                <span className="text-[11px] font-mono-tabular text-neutral-400">
                  {svgInfo ? `${svgInfo.vectorPathCount} formas` : ''}
                </span>
              </div>

              <p className="text-[11px] text-neutral-400 leading-relaxed">
                {state.pixelShape === 'square' && state.pixelGap === 0
                  ? `Células contíguas fundidas em geometria vetorial limpa (${matrix.activeCount.toLocaleString('pt-BR')} px → ${svgInfo?.vectorPathCount.toLocaleString('pt-BR')} blocos).`
                  : `Geometria vetorial pura com ${matrix.activeCount.toLocaleString('pt-BR')} formas escaláveis sem perda.`}
              </p>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    downloadSVG(
                      matrix,
                      state,
                      state.exportTransparent,
                      mosaicBgImage
                    )
                  }
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-[#FAD6EA] hover:bg-[#FDE4F2] text-black text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  <span>Baixar SVG</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopySVG}
                  title="Copiar código SVG"
                  className="px-2.5 py-2 rounded-md bg-[#1C1C22] hover:bg-[#26262E] text-white text-xs transition-colors cursor-pointer"
                >
                  {copiedType === 'svg' ? (
                    <Check className="w-3.5 h-3.5 text-[#FAD6EA]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Motion Video Export Row */}
          {state.backgroundMode !== 'transparent' && (
            <div className="flex items-center justify-between gap-4 p-3.5 rounded-md border border-[#222228] bg-[#111115]">
              <div>
                <div className="text-xs font-semibold text-white">
                  Vídeo Motion (WebM · 4s)
                </div>
                <div className="text-[11px] text-neutral-400">
                  Grava a animação do gradiente, granulação e textura em vídeo
                </div>
              </div>
              <button
                type="button"
                onClick={handleExportMotion}
                disabled={isRecordingMotion}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#1C1C22] hover:bg-[#26262E] border border-[#303038] disabled:opacity-60 text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {isRecordingMotion ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FAD6EA]" />
                    <span>Gravando 4s...</span>
                  </>
                ) : (
                  <>
                    <Film className="w-3.5 h-3.5 text-[#FAD6EA]" />
                    <span>Baixar WebM</span>
                  </>
                )}
              </button>
            </div>
          )}

          {errorMsg && (
            <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/50 rounded-md px-3 py-2">
              {errorMsg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
