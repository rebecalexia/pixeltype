import { useCallback, useEffect, useState } from 'react';
import { CanvasViewport } from './components/CanvasViewport';
import { ExportModal } from './components/ExportModal';
import { PixelStylePanel } from './components/PixelStylePanel';
import { TopBar } from './components/TopBar';
import { TypographyPanel } from './components/TypographyPanel';
import {
  DEFAULT_EDITOR_STATE,
  GOOGLE_FONTS_CATALOG,
} from './data/googleFontsCatalog';
import { EditorState, FontItem, PixelMatrix, PresetDefinition } from './types/editor';
import { downloadSVG, exportPNG } from './utils/exportEngine';
import { loadGoogleFont } from './utils/fontLoader';
import { rasterizeTextToMatrix } from './utils/pixelEngine';

export default function App() {
  const [state, setState] = useState<EditorState>(DEFAULT_EDITOR_STATE);
  const [activePresetId, setActivePresetId] = useState<string | null>('pixel-limpo');
  const [customFonts, setCustomFonts] = useState<FontItem[]>([]);
  const [matrix, setMatrix] = useState<PixelMatrix | null>(null);
  const [fontRevision, setFontRevision] = useState(0);
  const [mosaicBgImage, setMosaicBgImage] = useState<HTMLImageElement | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const handleStateChange = useCallback((patch: Partial<EditorState>) => {
    setState((prev) => ({ ...prev, ...patch }));
    if (
      patch.text !== undefined ||
      patch.fontFamily !== undefined ||
      patch.pixelSize !== undefined
    ) {
      setActivePresetId(null);
    }
  }, []);

  const handleAddCustomFont = useCallback((font: FontItem) => {
    setCustomFonts((prev) => {
      if (prev.some((f) => f.family.toLowerCase() === font.family.toLowerCase())) {
        return prev;
      }
      return [font, ...prev];
    });
  }, []);

  const handleSelectPreset = useCallback(async (preset: PresetDefinition) => {
    setActivePresetId(preset.id);
    const nextFont = preset.state.fontFamily || DEFAULT_EDITOR_STATE.fontFamily;
    const catalogMeta = GOOGLE_FONTS_CATALOG.find((f) => f.family === nextFont);
    await loadGoogleFont(
      nextFont,
      catalogMeta?.weights,
      catalogMeta?.hasItalic,
      preset.state.fontWeight ?? 400,
      preset.state.fontItalic ?? false
    );
    setState((prev) => ({
      ...prev,
      ...preset.state,
    }));
    setFontRevision((r) => r + 1);
  }, []);

  useEffect(() => {
    if (!state.mosaicImageDataUrl) {
      setMosaicBgImage(null);
      return;
    }
    const img = new Image();
    img.onload = () => setMosaicBgImage(img);
    img.src = state.mosaicImageDataUrl;
  }, [state.mosaicImageDataUrl]);

  useEffect(() => {
    let active = true;
    const initFont = async () => {
      await loadGoogleFont(
        DEFAULT_EDITOR_STATE.fontFamily,
        [DEFAULT_EDITOR_STATE.fontWeight],
        DEFAULT_EDITOR_STATE.fontItalic,
        DEFAULT_EDITOR_STATE.fontWeight,
        DEFAULT_EDITOR_STATE.fontItalic
      );
      await document.fonts.ready;
      if (active) setFontRevision((r) => r + 1);
    };
    initFont();
    return () => {
      active = false;
    };
  }, []);

  // Re-rasterize typography matrix only when typography/pixelation properties change
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const nextMatrix = rasterizeTextToMatrix(state);
      setMatrix(nextMatrix);
    });
    return () => cancelAnimationFrame(raf);
  }, [
    state.text,
    state.fontFamily,
    state.fontWeight,
    state.fontItalic,
    state.fontSize,
    state.letterSpacing,
    state.lineHeight,
    state.textAlign,
    state.preStroke,
    state.padding,
    state.aspectRatio,
    state.pixelSize,
    state.threshold,
    state.quantizationMode,
    state.levelsCount,
    state.textGrain,
    state.effectMode,
    state.mosaicSeed,
    fontRevision,
  ]);

  const handleQuickExportPNG = () => {
    if (!matrix) return;
    exportPNG(
      matrix,
      state,
      state.exportScale,
      state.exportTransparent,
      mosaicBgImage
    );
  };

  const handleQuickExportSVG = () => {
    if (!matrix) return;
    downloadSVG(matrix, state, state.exportTransparent, mosaicBgImage);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-black text-white overflow-hidden">
      <TopBar
        activePresetId={activePresetId}
        onSelectPreset={handleSelectPreset}
        onOpenExport={() => setIsExportOpen(true)}
      />

      <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        <TypographyPanel
          state={state}
          customFonts={customFonts}
          onChange={handleStateChange}
          onAddCustomFont={handleAddCustomFont}
          onFontReady={() => setFontRevision((r) => r + 1)}
        />

        <CanvasViewport
          matrix={matrix}
          state={state}
          mosaicBgImage={mosaicBgImage}
          onChange={handleStateChange}
        />

        <PixelStylePanel
          state={state}
          onChange={handleStateChange}
          onQuickExportPNG={handleQuickExportPNG}
          onQuickExportSVG={handleQuickExportSVG}
        />
      </div>

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        matrix={matrix}
        state={state}
        mosaicBgImage={mosaicBgImage}
        onChange={handleStateChange}
      />
    </div>
  );
}
