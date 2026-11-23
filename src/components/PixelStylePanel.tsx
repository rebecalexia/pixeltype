import React, { useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Download,
  FileCode2,
  Image as ImageIcon,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  AspectRatioPreset,
  BackgroundMode,
  BgBlendMode,
  BgImageFit,
  EditorState,
  EffectMode,
  MosaicGradientType,
  MotionMode,
  PixelShape,
  QuantizationMode,
  TextureType,
} from '../types/editor';

interface PixelStylePanelProps {
  state: EditorState;
  onChange: (patch: Partial<EditorState>) => void;
  onQuickExportPNG: () => void;
  onQuickExportSVG: () => void;
}

const SWATCHES = ['#FFFFFF', '#000000', '#FAD6EA', '#FBCFE8', '#F4B8D8', '#D4D4D8', '#27272A'];

export function PixelStylePanel({
  state,
  onChange,
  onQuickExportPNG,
  onQuickExportSVG,
}: PixelStylePanelProps) {
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const xyPadRef = useRef<HTMLDivElement>(null);
  const [draggingPad, setDraggingPad] = useState(false);

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onChange({
          backgroundMode: 'image',
          mosaicImageDataUrl: reader.result,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadMosaicImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
    e.target.value = '';
  };

  const updateFocalFromPointer = (clientX: number, clientY: number) => {
    if (!xyPadRef.current) return;
    const rect = xyPadRef.current.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    onChange({
      mosaicPosX: Number(nx.toFixed(2)),
      mosaicPosY: Number(ny.toFixed(2)),
    });
  };

  return (
    <aside className="w-full lg:w-[320px] shrink-0 border-t lg:border-t-0 lg:border-l border-[#251E23] bg-[#09090B] flex flex-col overflow-hidden">
      <div className="p-4 space-y-5 overflow-y-auto studio-scroll flex-1">
        {/* Pixelation Engine */}
        <section className="space-y-3.5">
          <h2 className="text-xs font-semibold text-neutral-200">
            Motor de Pixelização
          </h2>

          {/* Pixel Size */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Tamanho do Pixel</span>
              <span className="font-mono-tabular text-neutral-200">
                {state.pixelSize} px
              </span>
            </div>
            <input
              type="range"
              min={2}
              max={24}
              step={1}
              value={state.pixelSize}
              onChange={(e) => onChange({ pixelSize: Number(e.target.value) })}
              className="w-full studio-slider"
            />
          </div>

          {/* Threshold */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Limiar (Threshold)</span>
              <span className="font-mono-tabular text-[#FAD6EA] font-medium">
                {state.threshold.toFixed(3)}
              </span>
            </div>
            <input
              type="range"
              min={0.05}
              max={0.95}
              step={0.005}
              value={state.threshold}
              onChange={(e) => onChange({ threshold: Number(e.target.value) })}
              className="w-full studio-slider"
            />
          </div>

          {/* Quantization Mode */}
          <div className="space-y-1.5">
            <span className="block text-xs text-neutral-400">
              Modo de Quantização
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { id: 'threshold', label: 'Binário Crisp' },
                  { id: 'levels', label: 'Níveis Alfa' },
                  { id: 'bayer4', label: 'Dither Bayer' },
                  { id: 'floyd', label: 'Floyd-Steinberg' },
                ] as { id: QuantizationMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChange({ quantizationMode: m.id })}
                  className={`py-1.5 px-2 text-xs font-medium rounded border transition-colors cursor-pointer truncate ${
                    state.quantizationMode === m.id
                      ? 'bg-[#FAD6EA]/12 border-[#FAD6EA] text-white'
                      : 'bg-black border-[#26262C] text-neutral-400 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {state.quantizationMode === 'levels' && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">Degraus de Opacidade</span>
                <span className="font-mono-tabular text-neutral-200">
                  {state.levelsCount} níveis
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={8}
                step={1}
                value={state.levelsCount}
                onChange={(e) =>
                  onChange({ levelsCount: Number(e.target.value) })
                }
                className="w-full studio-slider"
              />
            </div>
          )}

          {/* Pixel Shape */}
          <div className="space-y-1.5">
            <span className="block text-xs text-neutral-400">
              Forma da Célula
            </span>
            <div className="grid grid-cols-4 gap-1">
              {(
                [
                  { id: 'square', label: 'Quadrado' },
                  { id: 'rounded', label: 'Suave' },
                  { id: 'led', label: 'LED' },
                  { id: 'diamond', label: 'Losango' },
                ] as { id: PixelShape; label: string }[]
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onChange({ pixelShape: s.id })}
                  className={`py-1.5 px-1.5 text-[11px] font-medium rounded border transition-colors cursor-pointer truncate ${
                    state.pixelShape === s.id
                      ? 'bg-[#FAD6EA]/12 border-[#FAD6EA] text-white'
                      : 'bg-black border-[#26262C] text-neutral-400 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cell Gap */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Espaçamento entre Pixels</span>
              <span className="font-mono-tabular text-neutral-200">
                {Math.round(state.pixelGap * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={0.45}
              step={0.05}
              value={state.pixelGap}
              onChange={(e) => onChange({ pixelGap: Number(e.target.value) })}
              className="w-full studio-slider"
            />
          </div>

          {/* Typography Pixel Grain */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-neutral-400">Granulação na Tipografia</span>
              <span className="font-mono-tabular text-neutral-200">
                {state.textGrain}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={2}
              value={state.textGrain}
              onChange={(e) => onChange({ textGrain: Number(e.target.value) })}
              className="w-full studio-slider"
            />
          </div>
        </section>

        <div className="h-px bg-[#201A1F]" />

        {/* Color & Pixel Effects */}
        <section className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-neutral-200">
              Cor & Acabamento
            </h2>
            <div className="flex items-center gap-1 bg-black border border-[#222228] rounded p-0.5">
              <button
                type="button"
                onClick={() => onChange({ fillMode: 'solid' })}
                className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                  state.fillMode === 'solid'
                    ? 'bg-[#222228] text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Sólida
              </button>
              <button
                type="button"
                onClick={() => onChange({ fillMode: 'gradient' })}
                className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                  state.fillMode === 'gradient'
                    ? 'bg-[#222228] text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Degradê
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="relative flex items-center gap-2 flex-1 bg-black border border-[#26262C] rounded-md px-2.5 py-1.5 cursor-pointer">
              <input
                type="color"
                value={state.color}
                onChange={(e) => onChange({ color: e.target.value.toUpperCase() })}
                className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer p-0"
              />
              <span className="text-xs font-mono-tabular text-neutral-200">
                {state.color.toUpperCase()}
              </span>
            </label>

            {state.fillMode === 'gradient' && (
              <label className="relative flex items-center gap-2 flex-1 bg-black border border-[#26262C] rounded-md px-2.5 py-1.5 cursor-pointer">
                <input
                  type="color"
                  value={state.gradientColorEnd}
                  onChange={(e) =>
                    onChange({ gradientColorEnd: e.target.value.toUpperCase() })
                  }
                  className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer p-0"
                />
                <span className="text-xs font-mono-tabular text-neutral-200">
                  {state.gradientColorEnd.toUpperCase()}
                </span>
              </label>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {SWATCHES.map((hex) => (
              <button
                key={hex}
                type="button"
                aria-label={`Selecionar cor ${hex}`}
                onClick={() => onChange({ color: hex })}
                style={{ backgroundColor: hex }}
                className={`w-6 h-6 rounded border transition-transform hover:scale-110 cursor-pointer ${
                  state.color.toUpperCase() === hex
                    ? 'border-[#FAD6EA] ring-1 ring-[#FAD6EA]'
                    : 'border-white/25'
                }`}
              />
            ))}
          </div>

          {state.fillMode === 'gradient' && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-400">Ângulo do Degradê</span>
                <span className="font-mono-tabular text-neutral-200">
                  {state.gradientAngle}°
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                step={5}
                value={state.gradientAngle}
                onChange={(e) =>
                  onChange({ gradientAngle: Number(e.target.value) })
                }
                className="w-full studio-slider"
              />
            </div>
          )}

          {/* Pixel Effect (Shadow / Outline) */}
          <div className="space-y-2">
            <span className="block text-xs text-neutral-400">
              Efeito de Borda Pixelada
            </span>
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  { id: 'none', label: 'Nenhum' },
                  { id: 'shadow', label: 'Sombra 1px' },
                  { id: 'outline', label: 'Contorno' },
                ] as { id: EffectMode; label: string }[]
              ).map((fx) => (
                <button
                  key={fx.id}
                  type="button"
                  onClick={() => onChange({ effectMode: fx.id })}
                  className={`py-1.5 px-2 text-xs font-medium rounded border transition-colors cursor-pointer ${
                    state.effectMode === fx.id
                      ? 'bg-[#FAD6EA]/12 border-[#FAD6EA] text-white'
                      : 'bg-black border-[#26262C] text-neutral-400 hover:text-white'
                  }`}
                >
                  {fx.label}
                </button>
              ))}
            </div>

            {state.effectMode !== 'none' && (
              <label className="flex items-center justify-between bg-black border border-[#26262C] rounded-md px-2.5 py-1.5 cursor-pointer">
                <span className="text-xs text-neutral-400">Cor do Efeito</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono-tabular text-neutral-200">
                    {state.effectColor.toUpperCase()}
                  </span>
                  <input
                    type="color"
                    value={state.effectColor}
                    onChange={(e) =>
                      onChange({ effectColor: e.target.value.toUpperCase() })
                    }
                    className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer p-0"
                  />
                </div>
              </label>
            )}
          </div>
        </section>

        <div className="h-px bg-[#201A1F]" />

        {/* Canvas Aspect Ratio */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-neutral-200">
              Proporção (Aspect Ratio)
            </h2>
            <span className="text-[11px] font-mono-tabular text-[#FAD6EA]">
              {state.aspectRatio === 'auto' ? 'Auto' : state.aspectRatio}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {(
              [
                { id: 'auto', label: 'Auto' },
                { id: '1:1', label: '1:1' },
                { id: '4:5', label: '4:5' },
                { id: '4:3', label: '4:3' },
                { id: '3:2', label: '3:2' },
                { id: '16:9', label: '16:9' },
                { id: '9:16', label: '9:16' },
              ] as { id: AspectRatioPreset; label: string }[]
            ).map((ar) => (
              <button
                key={ar.id}
                type="button"
                onClick={() => onChange({ aspectRatio: ar.id })}
                className={`py-1.5 px-1 text-[11px] font-mono-tabular font-medium rounded border transition-colors cursor-pointer ${
                  state.aspectRatio === ar.id
                    ? 'bg-[#FAD6EA]/12 border-[#FAD6EA] text-white'
                    : 'bg-black border-[#26262C] text-neutral-400 hover:text-white'
                }`}
              >
                {ar.label}
              </button>
            ))}
          </div>
        </section>

        <div className="h-px bg-[#201A1F]" />

        {/* Background, Gradient Manipulation, Grain & Motion */}
        <section className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-neutral-200">
              Fundo, Textura & Motion
            </h2>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {(
              [
                { id: 'transparent', label: 'Sem Fundo' },
                { id: 'solid', label: 'Sólido' },
                { id: 'mosaic', label: 'Gradiente' },
                { id: 'image', label: 'Imagem' },
              ] as { id: BackgroundMode; label: string }[]
            ).map((bg) => (
              <button
                key={bg.id}
                type="button"
                onClick={() => onChange({ backgroundMode: bg.id })}
                className={`py-1.5 px-1 text-[11px] font-medium rounded border transition-colors cursor-pointer truncate ${
                  state.backgroundMode === bg.id
                    ? 'bg-[#FAD6EA]/12 border-[#FAD6EA] text-white'
                    : 'bg-black border-[#26262C] text-neutral-400 hover:text-white'
                }`}
              >
                {bg.label}
              </button>
            ))}
          </div>

          {state.backgroundMode === 'solid' && (
            <label className="flex items-center justify-between bg-black border border-[#26262C] rounded-md px-2.5 py-1.5 cursor-pointer">
              <span className="text-xs text-neutral-400">Cor de Fundo</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono-tabular text-neutral-200">
                  {state.backgroundColor.toUpperCase()}
                </span>
                <input
                  type="color"
                  value={state.backgroundColor}
                  onChange={(e) =>
                    onChange({ backgroundColor: e.target.value.toUpperCase() })
                  }
                  className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer p-0"
                />
              </div>
            </label>
          )}

          {/* Custom Image Upload & Pixel Manipulation (shown in Imagem mode or when an image is loaded in Gradiente) */}
          {(state.backgroundMode === 'image' ||
            (state.backgroundMode === 'mosaic' && state.mosaicImageDataUrl)) && (
            <div className="space-y-3 pt-1">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleImageFile(file);
                }}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => bgImageInputRef.current?.click()}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-md bg-black hover:bg-[#16161B] border border-dashed border-[#34343D] hover:border-[#FAD6EA]/60 text-xs text-neutral-200 transition-colors cursor-pointer"
                >
                  {state.mosaicImageDataUrl ? (
                    <>
                      <ImageIcon className="w-3.5 h-3.5 text-[#FAD6EA] shrink-0" />
                      <span>Trocar Imagem de Fundo</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5 text-[#FAD6EA] shrink-0" />
                      <span>Enviar Imagem (PNG, JPG, WebP)</span>
                    </>
                  )}
                </button>
                {state.mosaicImageDataUrl && (
                  <button
                    type="button"
                    onClick={() => onChange({ mosaicImageDataUrl: null })}
                    title="Remover imagem de fundo"
                    className="p-2 rounded-md bg-black hover:bg-[#FAD6EA]/15 border border-[#26262C] text-neutral-400 hover:text-[#FAD6EA] cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {state.mosaicImageDataUrl && (
                <div className="space-y-3 p-2.5 rounded-md bg-black/60 border border-[#222228]">
                  {/* Image Size & Framing */}
                  <div className="space-y-2.5 pb-2.5 border-b border-[#1E1E24]">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-neutral-200">
                        Tamanho e Enquadramento
                      </span>
                      {(state.bgImageScale !== 1 ||
                        state.bgImageOffsetX !== 0 ||
                        state.bgImageOffsetY !== 0) && (
                        <button
                          type="button"
                          onClick={() =>
                            onChange({
                              bgImageScale: 1.0,
                              bgImageOffsetX: 0,
                              bgImageOffsetY: 0,
                            })
                          }
                          className="text-[11px] text-[#FAD6EA] hover:text-[#FDE4F2] cursor-pointer"
                        >
                          Centralizar
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-1">
                      {(
                        [
                          { id: 'cover', label: 'Cobrir Tela' },
                          { id: 'contain', label: 'Ajustar Inteira' },
                        ] as { id: BgImageFit; label: string }[]
                      ).map((fit) => (
                        <button
                          key={fit.id}
                          type="button"
                          onClick={() => onChange({ bgImageFit: fit.id })}
                          className={`py-1 px-2 text-[11px] font-medium rounded border transition-colors cursor-pointer truncate ${
                            state.bgImageFit === fit.id
                              ? 'bg-[#FAD6EA]/12 border-[#FAD6EA] text-white'
                              : 'bg-black border-[#26262C] text-neutral-400 hover:text-white'
                          }`}
                        >
                          {fit.label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-neutral-400">Tamanho da Imagem</span>
                        <span className="font-mono-tabular text-[#FAD6EA]">
                          {Math.round(state.bgImageScale * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={3.0}
                        step={0.05}
                        value={state.bgImageScale}
                        onChange={(e) =>
                          onChange({ bgImageScale: Number(e.target.value) })
                        }
                        className="w-full studio-slider"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-neutral-400">Posição X</span>
                          <span className="font-mono-tabular text-neutral-200">
                            {state.bgImageOffsetX > 0
                              ? `+${state.bgImageOffsetX}%`
                              : `${state.bgImageOffsetX}%`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-100}
                          max={100}
                          step={2}
                          value={state.bgImageOffsetX}
                          onChange={(e) =>
                            onChange({ bgImageOffsetX: Number(e.target.value) })
                          }
                          className="w-full studio-slider"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-neutral-400">Posição Y</span>
                          <span className="font-mono-tabular text-neutral-200">
                            {state.bgImageOffsetY > 0
                              ? `+${state.bgImageOffsetY}%`
                              : `${state.bgImageOffsetY}%`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-100}
                          max={100}
                          step={2}
                          value={state.bgImageOffsetY}
                          onChange={(e) =>
                            onChange({ bgImageOffsetY: Number(e.target.value) })
                          }
                          className="w-full studio-slider"
                        />
                      </div>
                    </div>

                    {state.backgroundMode === 'image' && (
                      <label className="flex items-center justify-between bg-black border border-[#26262C] rounded-md px-2 py-1 cursor-pointer">
                        <span className="text-[11px] text-neutral-400">
                          Cor de Base / Margem
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-mono-tabular text-neutral-300">
                            {state.backgroundColor.toUpperCase()}
                          </span>
                          <input
                            type="color"
                            value={state.backgroundColor}
                            onChange={(e) =>
                              onChange({
                                backgroundColor: e.target.value.toUpperCase(),
                              })
                            }
                            className="w-4 h-4 rounded border-0 bg-transparent cursor-pointer p-0"
                          />
                        </div>
                      </label>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-neutral-200">
                      Manipulação Pixel da Imagem
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onChange({ bgImageGrayscale: !state.bgImageGrayscale })
                      }
                      className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                        state.bgImageGrayscale
                          ? 'bg-[#FAD6EA]/15 border-[#FAD6EA] text-[#FAD6EA]'
                          : 'bg-black border-[#26262C] text-neutral-400 hover:text-white'
                      }`}
                    >
                      P&amp;B
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-neutral-400">Brilho</span>
                      <span className="font-mono-tabular text-neutral-200">
                        {state.bgImageBrightness > 0
                          ? `+${state.bgImageBrightness}`
                          : state.bgImageBrightness}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-50}
                      max={50}
                      step={2}
                      value={state.bgImageBrightness}
                      onChange={(e) =>
                        onChange({ bgImageBrightness: Number(e.target.value) })
                      }
                      className="w-full studio-slider"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-neutral-400">Contraste</span>
                      <span className="font-mono-tabular text-neutral-200">
                        {state.bgImageContrast.toFixed(2)}×
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={2.0}
                      step={0.05}
                      value={state.bgImageContrast}
                      onChange={(e) =>
                        onChange({ bgImageContrast: Number(e.target.value) })
                      }
                      className="w-full studio-slider"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-neutral-400">Posterizar Cores</span>
                      <span className="font-mono-tabular text-neutral-200">
                        {state.bgImageLevels === 0
                          ? 'Original'
                          : `${state.bgImageLevels} tons`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={16}
                      step={1}
                      value={state.bgImageLevels}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        onChange({ bgImageLevels: v === 1 ? 2 : v });
                      }}
                      className="w-full studio-slider"
                    />
                  </div>

                  {/* Gradient Blend with Uploaded Image */}
                  <div className="space-y-2 pt-2 border-t border-[#1E1E24]">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-neutral-300 font-medium">
                        Mescla com Gradiente
                      </span>
                      <span className="font-mono-tabular text-[#FAD6EA]">
                        {state.bgGradientMix}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={state.bgGradientMix}
                      onChange={(e) =>
                        onChange({ bgGradientMix: Number(e.target.value) })
                      }
                      className="w-full studio-slider"
                    />

                    {state.bgGradientMix > 0 && (
                      <div className="grid grid-cols-5 gap-1 pt-0.5">
                        {(
                          [
                            { id: 'normal', label: 'Normal' },
                            { id: 'multiply', label: 'Multip.' },
                            { id: 'screen', label: 'Tela' },
                            { id: 'overlay', label: 'Sobrepor' },
                            { id: 'duotone', label: 'Duotone' },
                          ] as { id: BgBlendMode; label: string }[]
                        ).map((bm) => (
                          <button
                            key={bm.id}
                            type="button"
                            onClick={() => onChange({ bgBlendMode: bm.id })}
                            className={`py-1 px-1 text-[10px] font-medium rounded border transition-colors cursor-pointer truncate ${
                              state.bgBlendMode === bm.id
                                ? 'bg-[#FAD6EA]/12 border-[#FAD6EA] text-white'
                                : 'bg-black border-[#26262C] text-neutral-400 hover:text-white'
                            }`}
                          >
                            {bm.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Manipulable Gradient Controls (active in Gradiente mode, or in Imagem mode when Gradient Mix > 0) */}
          {(state.backgroundMode === 'mosaic' ||
            (state.backgroundMode === 'image' &&
              Boolean(state.mosaicImageDataUrl) &&
              state.bgGradientMix > 0)) && (
            <div className="space-y-3 pt-1">
              {/* Gradient Style */}
              <div className="space-y-1.5">
                <span className="block text-[11px] text-neutral-400">
                  Estilo do Gradiente Pixelado
                </span>
                <div className="grid grid-cols-4 gap-1">
                  {(
                    [
                      { id: 'organic', label: 'Orgânico' },
                      { id: 'radial', label: 'Radial' },
                      { id: 'linear', label: 'Linear' },
                      { id: 'conic', label: 'Cônico' },
                    ] as { id: MosaicGradientType; label: string }[]
                  ).map((gt) => (
                    <button
                      key={gt.id}
                      type="button"
                      onClick={() => onChange({ mosaicGradientType: gt.id })}
                      className={`py-1 px-1.5 text-[11px] font-medium rounded border transition-colors cursor-pointer truncate ${
                        state.mosaicGradientType === gt.id
                          ? 'bg-[#FAD6EA]/12 border-[#FAD6EA] text-white'
                          : 'bg-black border-[#26262C] text-neutral-400 hover:text-white'
                      }`}
                    >
                      {gt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interactive 2D Focal Point Pad + Controls */}
              <div className="flex gap-3 items-stretch">
                <div className="space-y-1">
                  <span className="block text-[11px] text-neutral-400">
                    Foco XY
                  </span>
                  <div
                    ref={xyPadRef}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setDraggingPad(true);
                      updateFocalFromPointer(e.clientX, e.clientY);
                    }}
                    onPointerMove={(e) => {
                      if (!draggingPad) return;
                      updateFocalFromPointer(e.clientX, e.clientY);
                    }}
                    onPointerUp={() => setDraggingPad(false)}
                    className="relative w-20 h-20 rounded-md border border-[#26262C] bg-black cursor-crosshair overflow-hidden touch-none"
                    style={{
                      background: `radial-gradient(circle at ${state.mosaicPosX * 100}% ${state.mosaicPosY * 100}%, ${state.mosaicColorB}55, ${state.mosaicColorA} 75%)`,
                    }}
                  >
                    <div className="absolute inset-x-0 top-1/2 h-px bg-white/10 pointer-events-none" />
                    <div className="absolute inset-y-0 left-1/2 w-px bg-white/10 pointer-events-none" />
                    <div
                      style={{
                        left: `${state.mosaicPosX * 100}%`,
                        top: `${state.mosaicPosY * 100}%`,
                      }}
                      className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FAD6EA] border-2 border-black shadow pointer-events-none"
                    />
                  </div>
                </div>

                <div className="flex-1 space-y-2.5 pt-1">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-neutral-400">Escala</span>
                      <span className="font-mono-tabular text-neutral-200">
                        {state.mosaicScale.toFixed(1)}×
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.4}
                      max={2.4}
                      step={0.1}
                      value={state.mosaicScale}
                      onChange={(e) =>
                        onChange({ mosaicScale: Number(e.target.value) })
                      }
                      className="w-full studio-slider"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-neutral-400">Ângulo</span>
                      <span className="font-mono-tabular text-neutral-200">
                        {state.mosaicAngle}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      step={5}
                      value={state.mosaicAngle}
                      onChange={(e) =>
                        onChange({ mosaicAngle: Number(e.target.value) })
                      }
                      className="w-full studio-slider"
                    />
                  </div>
                </div>
              </div>

              {/* Gradient Stops */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-neutral-400">
                    Cores do Gradiente
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          mosaicColorA: state.mosaicColorB,
                          mosaicColorB: state.mosaicColorA,
                        })
                      }
                      title="Inverter cores"
                      className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white cursor-pointer"
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      <span>Inverter</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          mosaicUseThirdColor: !state.mosaicUseThirdColor,
                        })
                      }
                      className={`text-[11px] cursor-pointer ${
                        state.mosaicUseThirdColor
                          ? 'text-[#FAD6EA] font-medium'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {state.mosaicUseThirdColor ? '3 cores' : '+ 3ª cor'}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <label className="flex items-center gap-1.5 flex-1 bg-black border border-[#26262C] rounded-md px-2 py-1 cursor-pointer min-w-0">
                    <input
                      type="color"
                      value={state.mosaicColorA}
                      onChange={(e) =>
                        onChange({ mosaicColorA: e.target.value.toUpperCase() })
                      }
                      className="w-4 h-4 rounded border-0 bg-transparent cursor-pointer p-0 shrink-0"
                    />
                    <span className="text-[11px] font-mono-tabular text-neutral-300 truncate">
                      Base
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 flex-1 bg-black border border-[#26262C] rounded-md px-2 py-1 cursor-pointer min-w-0">
                    <input
                      type="color"
                      value={state.mosaicColorB}
                      onChange={(e) =>
                        onChange({ mosaicColorB: e.target.value.toUpperCase() })
                      }
                      className="w-4 h-4 rounded border-0 bg-transparent cursor-pointer p-0 shrink-0"
                    />
                    <span className="text-[11px] font-mono-tabular text-neutral-300 truncate">
                      Luz
                    </span>
                  </label>
                  {state.mosaicUseThirdColor && (
                    <label className="flex items-center gap-1.5 flex-1 bg-black border border-[#26262C] rounded-md px-2 py-1 cursor-pointer min-w-0">
                      <input
                        type="color"
                        value={state.mosaicColorC}
                        onChange={(e) =>
                          onChange({
                            mosaicColorC: e.target.value.toUpperCase(),
                          })
                        }
                        className="w-4 h-4 rounded border-0 bg-transparent cursor-pointer p-0 shrink-0"
                      />
                      <span className="text-[11px] font-mono-tabular text-neutral-300 truncate">
                        Borda
                      </span>
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      onChange({ mosaicSeed: state.mosaicSeed + 1 })
                    }
                    title="Gerar nova variação orgânica"
                    className="p-1.5 rounded-md bg-black border border-[#26262C] text-neutral-300 hover:text-white cursor-pointer shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {state.backgroundMode === 'mosaic' && !state.mosaicImageDataUrl && (
                <button
                  type="button"
                  onClick={() => bgImageInputRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-md bg-black hover:bg-[#16161B] border border-[#26262C] text-xs text-neutral-200 transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-[#FAD6EA]" />
                  <span>Combinar com Imagem de Fundo</span>
                </button>
              )}
            </div>
          )}

          <input
            ref={bgImageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUploadMosaicImage}
          />

          {/* Pixel Resolution, Grain, Texture & Motion (available on Solid & Mosaic) */}
          {state.backgroundMode !== 'transparent' && (
            <div className="space-y-3 pt-2 border-t border-[#201A1F]">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-400">Tamanho dos Pixels do Fundo</span>
                  <span className="font-mono-tabular text-[#FAD6EA] font-medium">
                    {Number(state.mosaicBlockRatio.toFixed(2))}×
                  </span>
                </div>
                <input
                  type="range"
                  min={0.25}
                  max={6}
                  step={0.25}
                  value={state.mosaicBlockRatio}
                  onChange={(e) =>
                    onChange({ mosaicBlockRatio: Number(e.target.value) })
                  }
                  className="w-full studio-slider"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-400">Granulação (Noise)</span>
                  <span className="font-mono-tabular text-neutral-200">
                    {state.bgGrain}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={2}
                  value={state.bgGrain}
                  onChange={(e) => onChange({ bgGrain: Number(e.target.value) })}
                  className="w-full studio-slider"
                />
              </div>

              <div className="space-y-1.5">
                <span className="block text-xs text-neutral-400">
                  Textura de Fundo
                </span>
                <div className="grid grid-cols-4 gap-1">
                  {(
                    [
                      { id: 'none', label: 'Lisa' },
                      { id: 'bayer', label: 'Bayer' },
                      { id: 'scanlines', label: 'Linhas' },
                      { id: 'grid', label: 'Malha' },
                    ] as { id: TextureType; label: string }[]
                  ).map((tx) => (
                    <button
                      key={tx.id}
                      type="button"
                      onClick={() => onChange({ bgTexture: tx.id })}
                      className={`py-1 px-1.5 text-[11px] font-medium rounded border transition-colors cursor-pointer truncate ${
                        state.bgTexture === tx.id
                          ? 'bg-[#FAD6EA]/12 border-[#FAD6EA] text-white'
                          : 'bg-black border-[#26262C] text-neutral-400 hover:text-white'
                      }`}
                    >
                      {tx.label}
                    </button>
                  ))}
                </div>
              </div>

              {state.bgTexture !== 'none' && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Intensidade da Textura</span>
                    <span className="font-mono-tabular text-neutral-200">
                      {state.bgTextureIntensity}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    step={5}
                    value={state.bgTextureIntensity}
                    onChange={(e) =>
                      onChange({ bgTextureIntensity: Number(e.target.value) })
                    }
                    className="w-full studio-slider"
                  />
                </div>
              )}

              {/* Motion Controls */}
              <div className="space-y-2.5 pt-2 border-t border-[#201A1F]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-200">
                    Motion do Fundo
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({ motionEnabled: !state.motionEnabled })
                    }
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                      state.motionEnabled
                        ? 'bg-[#FAD6EA] border-[#FAD6EA] text-black font-semibold'
                        : 'bg-black border-[#26262C] text-neutral-300 hover:text-white'
                    }`}
                  >
                    {state.motionEnabled ? (
                      <>
                        <Pause className="w-3 h-3" />
                        <span>Ativo</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3" />
                        <span>Ativar</span>
                      </>
                    )}
                  </button>
                </div>

                {state.motionEnabled && (
                  <>
                    <div className="grid grid-cols-4 gap-1">
                      {(
                        [
                          { id: 'drift', label: 'Deriva' },
                          { id: 'pulse', label: 'Pulso' },
                          { id: 'rotate', label: 'Giro' },
                          { id: 'flicker', label: 'Grão' },
                        ] as { id: MotionMode; label: string }[]
                      ).map((mm) => (
                        <button
                          key={mm.id}
                          type="button"
                          onClick={() => onChange({ motionMode: mm.id })}
                          className={`py-1 px-1.5 text-[11px] font-medium rounded border transition-colors cursor-pointer truncate ${
                            state.motionMode === mm.id
                              ? 'bg-[#FAD6EA]/12 border-[#FAD6EA] text-white'
                              : 'bg-black border-[#26262C] text-neutral-400 hover:text-white'
                          }`}
                        >
                          {mm.label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-neutral-400">Velocidade</span>
                        <span className="font-mono-tabular text-neutral-200">
                          {state.motionSpeed.toFixed(1)}×
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.2}
                        max={3.0}
                        step={0.2}
                        value={state.motionSpeed}
                        onChange={(e) =>
                          onChange({ motionSpeed: Number(e.target.value) })
                        }
                        className="w-full studio-slider"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>

        <div className="h-px bg-[#201A1F]" />

        {/* Quick Export Actions */}
        <section className="space-y-2.5 pb-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-neutral-200">
              Exportação Direta
            </h2>
          </div>

          <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={state.exportTransparent}
              onChange={(e) => onChange({ exportTransparent: e.target.checked })}
              className="rounded border-[#33333A] bg-black accent-[#FAD6EA] cursor-pointer"
            />
            <span>Exportar com fundo transparente</span>
          </label>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={onQuickExportPNG}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-white hover:bg-neutral-200 text-xs font-semibold text-black transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PNG {state.exportTransparent ? 'Transp.' : ''}</span>
            </button>
            <button
              type="button"
              onClick={onQuickExportSVG}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-[#FAD6EA] hover:bg-[#FDE4F2] text-xs font-semibold text-black transition-colors cursor-pointer whitespace-nowrap"
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Vetor SVG</span>
            </button>
          </div>
        </section>
      </div>
    </aside>
  );
}
